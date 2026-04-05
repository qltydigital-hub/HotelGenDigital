import { NextResponse } from 'next/server';
import { analyzeGuestMessage } from '@/lib/openai-service';

// Basic helper to send a message via Telegram API
async function sendTelegramMessage(chatId: string | number, text: string) {
    const token = process.env.TELEGRAM_GUEST_BOT_TOKEN;
    if (!token) {
        console.error("TELEGRAM_GUEST_BOT_TOKEN is missing!");
        return;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
            }),
        });
        
        if (!response.ok) {
            console.error("Telegram error:", await response.text());
        }
    } catch (error) {
        console.error("Fetch error sending Telegram message:", error);
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // Check if there is a message and it contains text
        if (body.message && body.message.text) {
            const chatId = body.message.chat.id;
            const text = body.message.text;
            const firstName = body.message.from.first_name || "Misafir";

            console.log(`[Telegram IN] ${firstName} (${chatId}): ${text}`);

            // 1) /getid komutu ile departman gruplarının kimliğini bulma
            if (text.trim() === '/getid') {
                await sendTelegramMessage(chatId, `📌 Bu sohbetin/grubun Chat ID'si:\n\`${chatId}\`\n\nLütfen bu ID'yi ilgili "TELEGRAM_GROUP_..." değişkenine kaydedin.`);
                return NextResponse.json({ success: true });
            }

            // To-Do for Production: Fetch actual room/reservation info from DB using chatId
            // For now, testing with mocked context
            const mockContext = {
                roomNo: "Bilinmiyor", 
                guestName: firstName
            };

            // Call our AI layer with the strict system prompt we just created
            const aiResult = await analyzeGuestMessage(text, false, mockContext);

            console.log(`[Telegram AI Result] Intent: ${aiResult.intent}, Dept: ${aiResult.department}`);

            // Send the response back to the guest
            const reply = aiResult.ai_safe_reply || "Lütfen bekleyiniz, ilgili birime aktarıyorum...";
            await sendTelegramMessage(chatId, reply);

            // 2) Departmanlara Yönlendirme (Routing) Mantığı
            if (['REQUEST', 'COMPLAINT'].includes(aiResult.intent)) {
                let targetChatId = null;
                const dept = aiResult.department?.toUpperCase() || "";

                if (dept.includes("HOUSEKEEPING") || dept.includes("H/K")) targetChatId = process.env.TELEGRAM_GROUP_HK;
                else if (dept.includes("TEKNIK") || dept.includes("T/S") || dept.includes("TEKNİK")) targetChatId = process.env.TELEGRAM_GROUP_TS;
                else if (dept.includes("F&B") || dept.includes("YIYECEK") || dept.includes("YİYECEK")) targetChatId = process.env.TELEGRAM_GROUP_FB;
                else if (dept.includes("RESEPSIYON") || dept.includes("ÖNBÜRO") || dept.includes("ONBURO")) targetChatId = process.env.TELEGRAM_GROUP_FO;
                else if (dept.includes("GUEST") || dept.includes("G/R") || dept.includes("MİSAFİR")) targetChatId = process.env.TELEGRAM_GROUP_GR;
                else if (dept.includes("REZERVASYON")) targetChatId = process.env.TELEGRAM_GROUP_REZ;

                if (targetChatId) {
                    const notifyText = `🔔 *YENİ ${aiResult.intent === 'COMPLAINT' ? 'ŞİKAYET' : 'TALEP'}*\n\n` +
                                       `🛏️ *Oda:* ${mockContext.roomNo}\n` +
                                       `👤 *Misafir:* ${firstName}\n` +
                                       `📝 *Açıklama:* ${aiResult.summary}\n` +
                                       `🤖 *AI Notu:* ${aiResult.turkish_translation}\n` +
                                       `💬 *Orjinal:* _${text}_`;
                    
                    await sendTelegramMessage(targetChatId, notifyText);
                } else {
                    console.log(`[ROUTING] Gidecek hedef bulunamadı. Departman: ${dept}`);
                }
            }
        }

        // Always return 200 OK so Telegram knows we received the message
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Telegram Webhook Webhook Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
