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

        // DURUM B: Oda Talebi / Şikayet
        if (aiAnalysis.intent === "REQUEST" || aiAnalysis.intent === "COMPLAINT") {
            
            // EĞER ODA NUMARASI BİLİNMİYORSA: Bilet açma, önce adama sor!
            if (roomNo === "Bilinmiyor" || guestName === "Misafir") {
                const missingInfoReply = aiAnalysis.ai_safe_reply || "Lütfen talebinizi işleme alabilmemiz için oda numaranızı ve isim-soyisminizi yazar mısınız?";
                
                if (subscriberId && subscriberId !== "unknown") {
                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, missingInfoReply);
                    await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, missingInfoReply);
                    const flowId = channel === 'whatsapp' 
                        ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap 
                        : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                    await sendManyChatFlow(subscriberId, flowId); 
                }

                return NextResponse.json({
                    success: true, action: "MISSING_GUEST_INFO", reply_text: missingInfoReply
                });
            }

            // ODA VE İSİM BİLİNİYORSA -> SÜRECİ BAŞLAT (Departmana yönlendir)
            const ticketId = `HTL-${Math.floor(Math.random() * 10000)}`;

            const mockDeptChatId = process.env.TELEGRAM_GUEST_BOT_TOKEN ? "YOUR_DEPT_CHAT_ID_TBD" : null;
            if (mockDeptChatId) {
                await notifyDepartment(
                    mockDeptChatId, ticketId, roomNo, guestName, incomingText, aiAnalysis.is_alerjen
                );
            }

            const guestAcknowledgeMsg = aiAnalysis.ai_safe_reply || "Talebinizi aldık, ilgili departmana ilettik.";

            if (subscriberId && subscriberId !== "unknown") {
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, guestAcknowledgeMsg);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, guestAcknowledgeMsg);
                const flowId = channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                await sendManyChatFlow(subscriberId, flowId); 
            }

            return NextResponse.json({
                success: true, action: "ROUTE_TO_DEPARTMENT", ticket_id: ticketId, reply_text: guestAcknowledgeMsg
            });
        }

        // Varsayılan / Yakalanamayan durum
        return NextResponse.json({ success: true, status: "UNMAPPED_INTENT", details: aiAnalysis });

    } catch (error) {
        console.error("Webhook Middleware Hatası:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}
