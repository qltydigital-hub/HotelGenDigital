import { NextResponse } from 'next/server';
import { MANYCHAT_CONFIG } from '@/lib/manychat-config';
import { analyzeGuestMessage } from '@/lib/openai-service';
import { getServiceSupabase } from '@/lib/supabase-client';
import { notifyDepartment } from '@/lib/telegram-service';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        console.log("📨 ManyChat / n8n Webhook Alındı");

        // 1. Gelen Veriyi Al
        const subscriberId = payload.subscriber_id || payload.chat_id || "unknown";
        const incomingText = payload.custom_fields?.[MANYCHAT_CONFIG.fields.pending_text] || payload.message;
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
            const guestAcknowledgeMsg = aiAnalysis.language === 'tr'
                ? "Talebinizi aldık, ilgili departmana ilettik. En kısa sürede odanızla ilgileneceğiz."
                : "We have received your request and forwarded it to the relevant department. We will attend to your room shortly. (Auto-translated)";

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
