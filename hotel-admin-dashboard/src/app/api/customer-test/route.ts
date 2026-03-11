import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        const { chatId, manychatId, message } = await req.json();

        if (!chatId || !message) {
            return NextResponse.json({ error: 'Chat ID ve Mesaj zorunludur.' }, { status: 400 });
        }

        const TELEGRAM_TOKEN = process.env.TELEGRAM_GUEST_BOT_TOKEN || process.env.TELEGRAM_MANAGER_BOT_TOKEN;
        const MANYCHAT_API_KEY = process.env.MANYCHAT_API_KEY;

        let telegramSuccess = false;
        let manychatSuccess = false;
        let manychatResponse = null;

        // 1. Telegram Gönderimi
        if (TELEGRAM_TOKEN) {
            const telegramUrl = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
            const telegramRes = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: `🔔 *YENİ TEST MESAJI*\n\nMüşteri Diyor ki:\n"${message}"`,
                    parse_mode: 'Markdown'
                })
            });

            const tgData = await telegramRes.json();
            if (tgData.ok) {
                telegramSuccess = true;
            } else {
                console.error("Telegram API Hatası:", tgData);
            }
        }

        // 2. ManyChat Gönderimi
        if (MANYCHAT_API_KEY && manychatId) {
            const manychatUrl = `https://api.manychat.com/fb/sending/sendContent`;
            const mcRes = await fetch(manychatUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${MANYCHAT_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    subscriber_id: parseInt(manychatId, 10) || manychatId,
                    data: {
                        version: "v2",
                        content: {
                            messages: [
                                {
                                    type: "text",
                                    text: `🔔 TEST MESAJI: ${message}`
                                }
                            ]
                        }
                    },
                    message_tag: "NON_PROMOTIONAL_SUBSCRIPTION"
                })
            });

            manychatResponse = await mcRes.json();
            if (mcRes.ok && manychatResponse.status === 'success') {
                manychatSuccess = true;
            } else {
                console.error("ManyChat API Hatası:", manychatResponse);
            }
        }

        return NextResponse.json({
            success: true,
            telegram: telegramSuccess,
            manychat: manychatSuccess ? true : (manychatId ? 'Failed/Check Logs' : 'Not Requested (No ManyChat ID)')
        });

    } catch (error: any) {
        console.error("API Error: ", error);
        return NextResponse.json({ error: error.message || 'Sunucu hatası' }, { status: 500 });
    }
}
