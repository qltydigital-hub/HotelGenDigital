import { NextResponse } from 'next/server';

import { MANYCHAT_CONFIG } from '@/lib/manychat-config';
import { analyzeGuestMessage, removeTurkishAccents } from '@/lib/openai-service';
import { getServiceSupabase } from '@/lib/supabase-client';
import { notifyDepartment, notifyMismatchToReception, sendTelegramMessage } from '@/lib/telegram-service';
import { setManyChatCustomField, sendManyChatFlow, sendManyChatTextMessage, sendManyChatInteractiveMessage } from '@/lib/manychat-client';
import { performLiveSearch } from '@/lib/external-apis';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const requestUrl = request.url;
        
        // Vercel serverless freeze issue: Background tasks might be killed silently.
        // We will execute synchronously. ChatGPT 4o is fast enough to answer within ManyChat's 10s timeout.
        const result = await processWebhookBackground(requestUrl, payload);
        return result || NextResponse.json({ success: true });
    } catch (e) {
        console.error("Webhook istek okuma hatası:", e);
        return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 });
    }
}

async function processWebhookBackground(requestUrl: string, payload: any) {
    try {
        console.log("📨 ManyChat / n8n Webhook Arka Planda İşleniyor...");

        const url = new URL(requestUrl);
        const channel = url.searchParams.get('channel') || 'instagram'; // ?channel=whatsapp veya instagram

        // 1. Gelen Veriyi Al
        const subscriberId = payload.subscriber_id || payload.chat_id || payload.contact_id || "unknown";
        let incomingText = payload.message || payload.text || payload.custom_fields?.[MANYCHAT_CONFIG.fields.pending_text];
        
        // No longer applying accent removal as DB supports UTF-8
        // if (incomingText) incomingText = removeTurkishAccents(incomingText);

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

        // Acentaları DB'den çek — Telegram ile aynı kaynak: hotel_settings.hotel_agencies
        // Sıralama panelden yönetilir; otel web sitesi her zaman 1. sıra (sabit kural)
        let agenciesPayload: Array<{name: string, url: string, priceText: string, isDirect: boolean}> = [];
        let hotelDirectLink = 'https://www.thegreenpark.com/gaziantep/';
        try {
            const { data: agencySettings } = await supabase
                .from('hotel_settings')
                .select('value')
                .eq('key', 'hotel_agencies')
                .single();
            if (agencySettings?.value) {
                const av = agencySettings.value;
                if (av.hotelReservationLink) hotelDirectLink = av.hotelReservationLink;
                // Otel kendi linki her zaman 1. sıra
                agenciesPayload = [
                    { name: 'The Green Park (Direkt)', url: hotelDirectLink, priceText: 'En iyi fiyat garantisi', isDirect: true },
                    ...(av.agencies || []).map((a: any) => ({
                        name: a.name,
                        url: a.url,
                        priceText: a.priceText || '',
                        isDirect: false
                    }))
                ];
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

        let hotelSettings: any = { escalation_email: null, escalation_telegram_id: null, minibar_note: null, dnd_rooms: [] };
        try {
            const { data } = await supabase.from('hotel_settings').select('escalation_email, escalation_telegram_id, minibar_note').limit(1).maybeSingle();
            if (data) hotelSettings = { ...hotelSettings, ...data };
            
            // DND Odaları
            const { data: dndData } = await supabase.from('hotel_settings').select('value').eq('key', 'DND_LIST').maybeSingle();
            if (dndData && dndData.value) {
                hotelSettings.dnd_rooms = dndData.value.split(',').map((r: string) => r.trim());
            }
        } catch(e) { console.warn("Hotel settings DB'den çekilemedi."); }
        // ------------------------------------------------------------------

        // ----------- KRİTİK KELİME & İNSAN MÜDAHALESİ KONTROLÜ -----------
        const escalationRegex = /(?:^|\W)(haram|beni arayın|açmıyorlar|şikayet|sikayet|iade|berbat|arıyorum|beğenmedim|ara)(?:$|\W)/i;
        const isEscalation = escalationRegex.test(incomingText);

        if (isEscalation) {
            console.log("🚨 İnsan Müdahalesi (Eskalasyon) Kelimesi Yakalandı! Yapay Zeka Durduruluyor.");
            
            const escalationEmail = hotelSettings.escalation_email;
            const escalationTelegram = hotelSettings.escalation_telegram_id;

            const waitMsg = "Talebinizi aldık. Konunun hassasiyeti sebebiyle durumu anında otel yönetimine aktarıyoruz, lütfen kısa bir süre bekleyiniz.";
            
            // Not: ManyChat API (sendManyChatTextMessage) Inbox Seat hatası verdiği için kaldırıldı.
            // Bunun yerine ManyChat flow'unda External Request içindeki "Response Mapping" kullanılmalıdır.
            // "$.reply_text" -> n8n_cevap, "$.status" -> n8n_status olarak maplendiğinde sorunsuz çalışır.

            // Telegram Bildirimi (F/O Panelinden Girilen ID'ye Gidiyor)
            if (escalationTelegram) {
                const alertMsg = `🚨 <b>ACİL İNSAN MÜDAHALESİ GEREKİYOR (OTOMATİK ASİSTAN DURDURULDU)</b> 🚨\n\n<b>Oda:</b> ${roomNo}\n<b>İsim:</b> ${guestName}\n\n<b>Müşterinin Yazdığı:</b>\n<i>${incomingText}</i>\n\nLütfen duruma ivedilikle müdahale ediniz.`;
                const botToken = process.env.TELEGRAM_MANAGER_BOT_TOKEN || process.env.TELEGRAM_GUEST_BOT_TOKEN || "";
                await sendTelegramMessage(botToken, escalationTelegram, alertMsg);
            }

            // E-Posta Bildirimi
            // Şu aşamada mail entegrasyonu (Resend/Nodemailer) olmadığından konsola log düşülüyor
            if (escalationEmail) {
                console.log(`[ESCALATION EMAIL SEND TRIGGER] -> To: ${escalationEmail} | Msg: ${incomingText}`);
            }

            return NextResponse.json({ success: true, action: "ESCALATION_TRIGGERED", reply_text: waitMsg, status: "completed_escalation" });
        }
        // ------------------------------------------------------------------

        // 2. OpenAI Niyet Sınıflandırması (Intent Classification)
        console.log("🧠 Yapay Zeka motoru cümleyi analiz ediyor...");
        const aiAnalysis = await analyzeGuestMessage(incomingText, isAudio, {
            guestName: guestName,
            roomNo: roomNo,
            minibarNote: hotelSettings.minibar_note, // Pass minibar rules to AI
            dndRooms: hotelSettings.dnd_rooms // Pass DND list to AI
        });
        
        console.log("📊 Yapay Zeka Sonucu:", JSON.stringify(aiAnalysis, null, 2));

        // 3. Duruma Göre İş Akışı (Orkestrasyon)

        const isAwaitingInfo = sessionData && sessionData.status === 'AWAITING_INFO';
        const directIntents = ["QUESTION", "GREETING", "RESERVATION", "EXTERNAL_QUERY", "CANCEL", "CONFIRMATION", "DENIAL"];
        
        // EĞER AWAITING_INFO beklentisindeysek, ama gelen niyet bir Soru ya da Dış İstekse (Yastık isteyip sonra 
        // "kurlar nedir" diye sorulması gibi), bekleyen işlemi iptal edip soruya cevap vermeliyiz. (SADECE ODA ve İSİM olmayan durumlar)
        let overrideToDirect = false;
        // AI isim veya oda numarası yakaladıysa bu bir iptal/direkt soru DEĞİLDİR, misafir bilgi veriyordur, session silinmemeli.
        const isProvidingInfo = !!(aiAnalysis.extracted_room_no || aiAnalysis.extracted_guest_name);
        
        if (isAwaitingInfo && !isProvidingInfo && ["QUESTION", "EXTERNAL_QUERY", "CANCEL", "GREETING", "CONFIRMATION", "DENIAL"].includes(aiAnalysis.intent)) {
            overrideToDirect = true;
            // Eski session'ı temizle
            if (subscriberId !== "unknown") {
                await supabase.from('guest_sessions').delete().eq('subscriber_id', subscriberId);
            }
        }

        // --- ALERJİ / SAĞLIK GÜVENLİK KONTROLÜ ---
        // Alerji bildirildiyse ve departmana yönlendirilmesi gerekiyorsa, bunu doğrudan REQUEST ve Guest Relation yapalım.
        if (aiAnalysis.is_alerjen) {
            aiAnalysis.intent = "REQUEST";
            aiAnalysis.department = "Guest Relation";
            overrideToDirect = false; // DURUM B (Ticket Açma) sürecine yönlendir
        }
        // ----------------------------------------

        // DURUM A: Sadece Soru, Selamlama, Rezervasyon, Dış Sorgu, vb...
        if ((!isAwaitingInfo || overrideToDirect) && directIntents.includes(aiAnalysis.intent)) {
            
            // Eğer GREETING gibi basit şeylerse, info extraction'ları resetleyebiliriz ama gerek kalmıyor zaten DurumA'dayız.
            const currentRoomNo = aiAnalysis.extracted_room_no || roomNo;
            
            if (aiAnalysis.intent === "EXTERNAL_QUERY") {
                // Konaklayıp konaklamadığı önemsiz kılınarak, botun "Kurları verebilirim" hissi vermesini engellemek isterseniz:
                // Şimdilik konaklayan misafir (oda numarası olan) VEYA oda no zorunlu değil deyip Perplexity'e atıyoruz.
                // Müşterinin "ben burdayım" demesine rağmen oda veremediği için Perplexity çalışmıyordu.
                // Bu yüzden, "EXTERNAL_QUERY" ise HER ZAMAN Perplexity çalışsın.
                console.log("🌐 Dış arama (Perplexity) başlatılıyor...");
                const liveQuery = `Misafir şu soruyu sordu: "${incomingText}". Lütfen en güncel veriyi internetten araştırarak yanıtla. Soru altın fiyatları, döviz kurları veya merkez bankasıyla ilgiliyse 'https://www.tcmb.gov.tr/wps/wcm/connect/tr/tcmb+tr/main+page+site+area/bugun' verisini dikkate alarak cevap ver. Yanıtı misafirin dilinde ('${aiAnalysis.language}') çok kibar, profesyonel ve sadece tek paragraf (net bilgi) olacak şekilde ver. Oda Numarası var mı boşver, sadece cevapla.`;
                const liveAnswer = await performLiveSearch(liveQuery);
                if (liveAnswer) {
                    aiAnalysis.ai_safe_reply = liveAnswer;
                }
            }

            if (subscriberId && subscriberId !== "unknown") {
                // ManyChat API call kaldırıldı. Yanıtı HTTP üzerinden döneceğiz.
                console.log(`📲 ManyChat (${channel}) HTTP senkron yanıtı sunuluyor...`);
            }
            // ai_safe_reply artık openai-service.ts içinde her zaman dolu dönüyor (fallback dahil)
            const replyText = aiAnalysis.ai_safe_reply || (
                aiAnalysis.language === 'en' || aiAnalysis.language === 'english'
                    ? 'Hello! Welcome to The Green Park Gaziantep. How can I help you?'
                    : 'Merhaba! The Green Park Gaziantep\'e hoş geldiniz. Size nasıl yardımcı olabilirim?'
            );
            return NextResponse.json({
                success: true, 
                action: "AI_REPLY_DIRECTLY", 
                reply_text: replyText,
                status: "completed"
            });
        }

        // DURUM B: Oda Talebi / Şikayet VEYA AWAITING_INFO durumunda devam eden talep
        if (
            aiAnalysis.intent === "REQUEST" || aiAnalysis.intent === "COMPLAINT" || 
            (isAwaitingInfo && !overrideToDirect)
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
            // ANCAK sağlık/alerji söz konusu ise konaklayan/dış kullanıcı fark etmeksizin acilen bildirim yapılmalıdır.
            if ((finalRoomNo === "Bilinmiyor" || finalRoomNo === null) && !aiAnalysis.is_alerjen) {
                const missingInfoReply = "Talebinizi işleme alabilmemiz için lütfen isim, soyisim ve oda numaranızı yazınız. (Örn: 305 Ali Yılmaz)";
                
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

                    // API mesaji kaldirildi. Map işleminden çekilecek.
                }

                return NextResponse.json({ success: true, action: "MISSING_GUEST_INFO", reply_text: missingInfoReply, status: "completed_waiting_info" });
            }

            // IN-HOUSE LISTESI ÜZERİNDEN DOĞRULAMA (Oda No ve İsim)
            let isVerified = false;
            
            // Eğer misafir "Demo Tipi" (yani 102 Mehmet Kaya) fallback kullanıyorsa direkt true yap
            if (finalRoomNo === "102" && finalGuestName && finalGuestName.includes("Mehmet")) {
                isVerified = true;
            } else {
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
            }

            if (!isVerified && !aiAnalysis.is_alerjen) {
                // ACİL DURUM BİLDİRİMİ: Sistemde olmayan oda ve isim ile talep oluşturmaya çalışıldı
                const alertChatId = process.env.TELEGRAM_MANAGER_CHAT_ID || (process.env.TELEGRAM_GUEST_BOT_TOKEN ? "YOUR_RECEPTION_CHAT_ID_TBD" : null);
                if (alertChatId) {
                    try {
                        await notifyMismatchToReception(alertChatId, finalRoomNo, finalGuestName || "Belirtilmedi", incomingText);
                    } catch (err) {
                        console.error("Mismatch bildirim hatası:", err);
                    }
                }

                // Doğrulama başarısızsa FALLBACK butonları sun
                const mismatchHoldMsg = aiAnalysis.reply_mismatch_lang || "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz.";
                const failedFallbackReply = `${mismatchHoldMsg}\n\n(Test Oteli Notu: Sistemdeki kayıtlarda eşleşme bulunamadı. Demo Hesabı '102 Mehmet Kaya' ile devam etmek ister misiniz?)`;
                
                if (subscriberId && subscriberId !== "unknown") {
                    // Oturum kaydını silmeyelim ki bir sonraki "Evet" veya butonda "102 Mehmet Kaya" girdiğinde devam edebilsin!
                    
                    // Fallback JSON payload üzerinden sağlanacak:
                    // Kullanıcı Flow içinde if 'status' === 'completed_fallback_ask' ise butonu kendi UI'ı ile göstersin.
                }
                return NextResponse.json({ success: true, action: "VERIFICATION_FAILED_FALLBACK", reply_text: failedFallbackReply, status: "completed_fallback_ask" });
            }

            // DOĞRULAMA BAŞARILIYSA -> Session'ı temizle, SÜRECİ BAŞLAT (Departmana yönlendir)
            if (subscriberId && subscriberId !== "unknown") {
                await supabase.from('guest_sessions').delete().eq('subscriber_id', subscriberId);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.oda_no, finalRoomNo);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.misafir_adi, finalGuestName);
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

                // YENİ: Alerjik misafirleri doğrudan özel SQL tablosuna (Guest Relations Listesi için) kaydet
                if (aiAnalysis.is_alerjen) {
                    try {
                        await supabase.from('guest_allergies').insert({
                            room_no: finalRoomNo === "Bilinmiyor" ? null : finalRoomNo,
                            guest_name: finalGuestName === "Misafir" || finalGuestName === "Bilinmiyor" ? null : finalGuestName,
                            allergy_details: currentTranslation || currentRequestMsg,
                            status: 'ACTIVE'
                        });
                    } catch (allergyErr) {
                        console.error("Alerji DB Insert Error:", allergyErr);
                    }
                }

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
                    incomingUrl,
                    currentDept
                );
            }

            const guestAcknowledgeMsg = aiAnalysis.reply_routing_lang || "İsteğinizi ilgili departmana hızlıca iletiyoruz.";

            if (subscriberId && subscriberId !== "unknown") {
                // API Messages disabled.
            }

            return NextResponse.json({ success: true, action: "ROUTE_TO_DEPARTMENT", ticket_id: ticketId, reply_text: guestAcknowledgeMsg, status: "completed" });
        }

        // Varsayılan / Yakalanamayan durum
        return NextResponse.json({ success: true, status: "UNMAPPED_INTENT", details: aiAnalysis });

    } catch (error) {
        console.error("Webhook Middleware Hatası:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}
