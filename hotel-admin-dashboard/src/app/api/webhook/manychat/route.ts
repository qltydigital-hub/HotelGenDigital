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

        // 2. OpenAI Niyet Sınıflandırması (Intent Classification)
        console.log("🧠 Yapay Zeka motoru cümleyi analiz ediyor...");
        const aiAnalysis = await analyzeGuestMessage(incomingText, isAudio);
        console.log("📊 Yapay Zeka Sonucu:", aiAnalysis);

        const supabase = getServiceSupabase();

        // 3. Duruma Göre İş Akışı (Orkestrasyon)

        // DURUM A: Sadece Soru/Bilgi talebiyse (Departmana gitmesine gerek yok, direkt yapay zeka cevaplasın)
        if (aiAnalysis.intent === "QUESTION" || aiAnalysis.intent === "GREETING") {
            // Arka planda doğrudan misafire mesaji ManyChat üzerinden gönder
            if (subscriberId && subscriberId !== "unknown") {
                console.log(`📲 ManyChat (${channel}) kullanıcısına doğrudan mesaj gönderiliyor...`);
                
                // AI Cevabını kaydet (Hem geri uyumluluk için n8n_cevap hem de yeni ai_cevap)
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, aiAnalysis.ai_safe_reply || "Üzgünüm, şu an yanıt veremiyorum.");
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, aiAnalysis.ai_safe_reply || "Üzgünüm, şu an yanıt veremiyorum.");
                
                // 2. Ardından doğru platform akışını tetikle
                const flowId = channel === 'whatsapp' 
                    ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap 
                    : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                
                await sendManyChatFlow(subscriberId, flowId);
            }

            // N8n veya ManyChat'e geri dönüş JSON'u hazırla
            return NextResponse.json({
                success: true,
                action: "AI_REPLY_DIRECTLY",
                reply_text: aiAnalysis.ai_safe_reply,
                update_manychat_fields: {
                    [MANYCHAT_CONFIG.fields.n8n_reply]: aiAnalysis.ai_safe_reply,
                    [MANYCHAT_CONFIG.fields.n8n_status]: "RESOLVED_BY_AI"
                }
            });
        }

        // DURUM B: Oda Talebi / Şikayet (SLA Süreci Başlar)
        if (aiAnalysis.intent === "REQUEST" || aiAnalysis.intent === "COMPLAINT") {

            // Benzersiz Bilet ID Üret
            const ticketId = `HTL-${Math.floor(Math.random() * 10000)}`;

            // Supabase DB'ye Kayıt At (Talep oluştu!)
            // (Gerçek ortamda hotel_id, guest_id vb FK ilişkilendirmeleriyle atılır)
            /*
            await supabase.from('requests').insert({
                ticket_id: ticketId,
                topic: aiAnalysis.summary,
                description: incomingText,
                status: 'OPEN',
                priority: aiAnalysis.is_alerjen ? 'CRITICAL' : 'NORMAL'
            });
            */

            // 4. Telegram Üzerinden İlgili Departmanı Uyar
            // NOT: Prod'da departmanın chat_id'sini DB'den, "departments" veya "staff_users" tablosundan çekeceğiz.
            // Şimdilik demo chat id (Yönetici bot id'sini proxy olarak kullanıyoruz vs / ya da terminal log)
            const mockDeptChatId = process.env.TELEGRAM_GUEST_BOT_TOKEN ? "YOUR_DEPT_CHAT_ID_TBD" : null;

            if (mockDeptChatId) {
                await notifyDepartment(
                    mockDeptChatId,
                    ticketId,
                    roomNo,
                    guestName,
                    incomingText, // Misafirin orjinal mesajı veya çevirisi
                    aiAnalysis.is_alerjen
                );
            }

            // MANYCHAT'e / N8N'e departmana yönlendirildiğini haber veren onay dönüşü
            const guestAcknowledgeMsg = aiAnalysis.ai_safe_reply || "Talebinizi aldık, ilgili departmana ilettik. En kısa sürede odanızla ilgileneceğiz.";

            // Arka planda misafire bilgilendirme mesajını ManyChat'ten gönder
            if (subscriberId && subscriberId !== "unknown") {
                console.log(`📲 ManyChat (${channel}) kullanıcısına departman yönlendirme bildirimi gönderiliyor...`);
                // Talebin aldığını bildiren cevabı AI_Cevap alanına kaydet ve flow'u tetikle
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.ai_cevap, guestAcknowledgeMsg);
                await setManyChatCustomField(subscriberId, MANYCHAT_CONFIG.fields.n8n_cevap, guestAcknowledgeMsg);
                
                const flowId = channel === 'whatsapp' 
                    ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap 
                    : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                
                await sendManyChatFlow(subscriberId, flowId); 
            }

            return NextResponse.json({
                success: true,
                action: "ROUTE_TO_DEPARTMENT",
                ticket_id: ticketId,
                department: aiAnalysis.department,
                reply_text: guestAcknowledgeMsg,
                is_critical: aiAnalysis.is_alerjen,
                update_manychat_fields: {
                    [MANYCHAT_CONFIG.fields.n8n_reply]: guestAcknowledgeMsg,
                    [MANYCHAT_CONFIG.fields.n8n_status]: "ROUTED_TO_DEPT",
                    [MANYCHAT_CONFIG.fields.otel_ticket_id]: ticketId
                }
            });
        }

        // Varsayılan / Yakalanamayan durum
        return NextResponse.json({ success: true, status: "UNMAPPED_INTENT", details: aiAnalysis });

    } catch (error) {
        console.error("Webhook Middleware Hatası:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}
