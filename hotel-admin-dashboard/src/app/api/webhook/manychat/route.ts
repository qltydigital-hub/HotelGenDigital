import { NextResponse } from 'next/server';
import { MANYCHAT_CONFIG } from '@/lib/manychat-config';
import { analyzeGuestMessage } from '@/lib/openai-service';
import { getServiceSupabase } from '@/lib/supabase-client';
import { notifyDepartment } from '@/lib/telegram-service';
import { setManyChatCustomField, sendManyChatFlow } from '@/lib/manychat-client';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        console.log("📨 ManyChat / n8n Webhook Alındı");

        const url = new URL(request.url);
        const channel = url.searchParams.get('channel') || 'instagram'; // ?channel=whatsapp veya instagram

        // 1. Gelen Veriyi Al
        const subscriberId = payload.subscriber_id || payload.chat_id || payload.contact_id || "unknown";
        const incomingText = payload.custom_fields?.[MANYCHAT_CONFIG.fields.pending_text] || payload.message || payload.text;
        const isAudio = payload.custom_fields?.[MANYCHAT_CONFIG.fields.cuf_audio_url] ? true : false;
        // ManyChat'ten veya external sistemden gelebilecek olası resim URL'leri
        const incomingUrl = payload.url || payload.image_url || payload.custom_fields?.image_url || payload.custom_fields?.[MANYCHAT_CONFIG.fields.ai_urun_gorsel_url] || null;

        // (Simüle Edilmiş Misafir Bilgileri - Normalde custom_fields'den / DB'den eşleştirilir)
        const roomNo = payload.custom_fields?.[MANYCHAT_CONFIG.fields.oda_no] || "Bilinmiyor";
        const guestName = payload.custom_fields?.[MANYCHAT_CONFIG.fields.misafir_adi] || "Misafir";

        if (!incomingText) {
            return NextResponse.json({ success: false, error: "Mesaj metni yok." }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // Acentaları DB'den dinamik çek.
        let agenciesPayload: Array<{name: string, url: string, priceText: string, isDirect: boolean}> = [];
        try {
            const { data: dbAgencies, error } = await supabase.from('agencies').select('*');
            if (dbAgencies && !error) {
                agenciesPayload = dbAgencies.map(a => ({
                    name: a.name,
                    url: a.url,
                    priceText: a.price_text,
                    isDirect: a.is_direct
                }));
            }
        } catch (e) {
            console.error("Acenta bilgileri çekilemedi:", e);
        }

        // ------------------ (YENİ EKLEME) STATE KONTROLÜ ------------------
        let sessionData = null;
        if (subscriberId !== "unknown") {
            try {
                const { data } = await supabase.from('guest_sessions').select('*').eq('subscriber_id', subscriberId).single();
                sessionData = data;
            } catch (e) { /* Tablo yoksa vs */}
        }
        // ------------------------------------------------------------------

        // 2. OpenAI Niyet Sınıflandırması (Intent Classification)
        console.log("🧠 Yapay Zeka motoru cümleyi analiz ediyor...");
        const aiAnalysis = await analyzeGuestMessage(incomingText, isAudio, {
            roomNo: roomNo,
            guestName: guestName,
            agencies: agenciesPayload
        });
        console.log("📊 Yapay Zeka Sonucu:", aiAnalysis);

        // 3. Duruma Göre İş Akışı (Orkestrasyon)

        // DURUM A: Sadece Soru, Selamlama ve Rezervasyon ise (Direkt AI cevaplasın)
        if (aiAnalysis.intent === "QUESTION" || aiAnalysis.intent === "GREETING" || aiAnalysis.intent === "RESERVATION") {
            if (subscriberId && subscriberId !== "unknown") {
                console.log(`📲 ManyChat (${channel}) kullanıcısına doğrudan mesaj gönderiliyor...`);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, aiAnalysis.ai_safe_reply || "Üzgünüm, şu an yanıt veremiyorum.");
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, aiAnalysis.ai_safe_reply || "Üzgünüm, şu an yanıt veremiyorum.");
                const flowId = channel === 'whatsapp' 
                    ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap 
                    : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                await sendManyChatFlow(subscriberId, flowId);
            }
            return NextResponse.json({
                success: true, action: "AI_REPLY_DIRECTLY", reply_text: aiAnalysis.ai_safe_reply
            });
        }

        // DURUM B: Oda Talebi / Şikayet VEYA AWAITING_INFO durumunda devam eden talep
        if (
            aiAnalysis.intent === "REQUEST" || aiAnalysis.intent === "COMPLAINT" || 
            (sessionData && sessionData.status === 'AWAITING_INFO')
        ) {
            
            // Eğer session'dan geliyorsa orijinal olayı hatırlayalım
            let currentIntent = aiAnalysis.intent;
            let currentRequestMsg = incomingText;
            let currentDept = aiAnalysis.department || 'Resepsiyon';
            let currentTranslation = aiAnalysis.turkish_translation;
            let currentLang = aiAnalysis.language;

            if (sessionData && sessionData.status === 'AWAITING_INFO') {
                currentIntent = sessionData.pending_intent;
                currentRequestMsg = sessionData.pending_request;
                currentDept = sessionData.pending_department;
                currentTranslation = sessionData.turkish_translation;
                currentLang = sessionData.language;
                // AI'nın şimdiki analizi, kullanıcının adını/oda numarasını içeriyor mu diye bakacağız.
            }

            // Nihai Oda No ve İsim tespiti (AI yakaladıysa AI'yi kullan, yoksa ManyChat Custom Field'ını)
            const finalRoomNo = aiAnalysis.extracted_room_no || roomNo;
            const finalGuestName = aiAnalysis.extracted_guest_name || guestName;

            // EĞER ODA NUMARASI BİLİNMİYORSA: Session'a yaz, adama sor!
            if (finalRoomNo === "Bilinmiyor" || finalRoomNo === null) {
                const missingInfoReply = aiAnalysis.ai_safe_reply || "Lütfen talebinizi işleme alabilmemiz için oda numaranızı ve isim-soyisminizi yazar mısınız?";
                
                if (subscriberId && subscriberId !== "unknown") {
                    await supabase.from('guest_sessions').upsert({
                        subscriber_id: subscriberId,
                        channel: channel,
                        status: 'AWAITING_INFO',
                        pending_request: currentRequestMsg,
                        pending_intent: currentIntent,
                        pending_department: currentDept,
                        language: aiAnalysis.language,
                        turkish_translation: aiAnalysis.turkish_translation || currentRequestMsg
                    }, { onConflict: 'subscriber_id' });

                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, missingInfoReply);
                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, missingInfoReply);
                    await sendManyChatFlow(subscriberId, channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink); 
                }

                return NextResponse.json({ success: true, action: "MISSING_GUEST_INFO", reply_text: missingInfoReply });
            }

            // IN-HOUSE LISTESI ÜZERİNDEN DOĞRULAMA (Oda No ve İsim)
            let isVerified = false;
            try {
                // Sadece oda numarasıyla kayıt arayalım (Basit Doğrulama)
                const { data: inhouseMatch } = await supabase.from('in_house_guests')
                    .select('*')
                    .eq('room_number', finalRoomNo)
                    .limit(1)
                    .maybeSingle();

                if (inhouseMatch) {
                    isVerified = true;
                }
            } catch (e) { console.error("Inhouse DB doğrulama hatası:", e); }

            if (!isVerified) {
                // Doğrulama başarısızsa adama sor ama session'ı da AWAITING_INFO'da tut ki düzeltince işlemi bitirsin.
                const failedVerifyReply = "Kayıtlarımızda bu oda numarası eşleşmedi. Acaba oda numaranızı hatalı mı yazdınız? Lütfen tekrar kontrol ederek yazınız.";
                
                if (subscriberId && subscriberId !== "unknown") {
                    await supabase.from('guest_sessions').upsert({
                        subscriber_id: subscriberId,
                        status: 'AWAITING_INFO',
                        pending_request: currentRequestMsg,
                        pending_intent: currentIntent,
                        pending_department: currentDept,
                        language: currentLang,
                        turkish_translation: currentTranslation
                    }, { onConflict: 'subscriber_id' });

                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, failedVerifyReply);
                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, failedVerifyReply);
                    await sendManyChatFlow(subscriberId, channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink); 
                }
                return NextResponse.json({ success: true, action: "VERIFY_FAILED", reply_text: failedVerifyReply });
            }

            // DOĞRULAMA BAAŞARILIYSA -> Session'ı temizle, SÜRECİ BAŞLAT (Departmana yönlendir)
            if (subscriberId && subscriberId !== "unknown") {
                await supabase.from('guest_sessions').delete().eq('subscriber_id', subscriberId);
            }

            const ticketId = `HTL-${Math.floor(Math.random() * 100000)}`;

            let timeoutMinutes = 15;
            try {
                const { data: settingsData } = await supabase.from('hotel_settings').select('value').eq('key', 'departments').single();
                if (settingsData && settingsData.value) {
                    const depts = settingsData.value;
                    const matchedDept = depts.find((d: any) => currentDept && d.name.includes(currentDept));
                    if (matchedDept && matchedDept.timeout_minutes) {
                        timeoutMinutes = matchedDept.timeout_minutes;
                    }
                }
            } catch(e) { console.warn("SLA fetch error", e); }

            try {
                await supabase.from('active_tickets').insert({
                    ticket_id: ticketId,
                    status: 'PENDING',
                    department: currentDept,
                    guest_name: finalGuestName,
                    room_no: finalRoomNo,
                    subscriber_id: subscriberId,
                    channel: channel,
                    guest_language: currentLang || 'tr',
                    original_message: currentRequestMsg,
                    turkish_translation: currentTranslation || currentRequestMsg,
                    image_url: incomingUrl,
                    reply_immediate_lang: aiAnalysis.reply_immediate_lang || "Talebinizi aldık, hemen ilgileniyorum.",
                    reply_later_lang: aiAnalysis.reply_later_lang || "Talebinizi aldım, sonrasında ilgileneceğim.",
                    timeout_minutes: timeoutMinutes
                });
            } catch(e) { console.error("Ticket DB Insert Error:", e); }

            const mockDeptChatId = process.env.TELEGRAM_GUEST_BOT_TOKEN ? "YOUR_DEPT_CHAT_ID_TBD" : null;
            if (mockDeptChatId) {
                await notifyDepartment(
                    mockDeptChatId, 
                    ticketId, 
                    finalRoomNo, 
                    finalGuestName, 
                    currentRequestMsg, 
                    currentTranslation || currentRequestMsg,
                    aiAnalysis.is_alerjen,
                    incomingUrl
                );
            }

            const guestAcknowledgeMsg = aiAnalysis.reply_routing_lang || "İsteğinizi ilgili departmana hızlıca iletiyoruz.";

            if (subscriberId && subscriberId !== "unknown") {
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, guestAcknowledgeMsg);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, guestAcknowledgeMsg);
                await sendManyChatFlow(subscriberId, channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink); 
            }

            return NextResponse.json({ success: true, action: "ROUTE_TO_DEPARTMENT", ticket_id: ticketId, reply_text: guestAcknowledgeMsg });
        }

        // Varsayılan / Yakalanamayan durum
        return NextResponse.json({ success: true, status: "UNMAPPED_INTENT", details: aiAnalysis });

    } catch (error) {
        console.error("Webhook Middleware Hatası:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}
