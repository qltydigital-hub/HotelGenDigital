// src/app/api/webhook/telegram/route.ts
// Tüm Telegram botlarının update'lerini bu endpoint alır.
// Telegram'a şu komutu kaydetmeniz gerekir:
//   setWebhook?url=https://SIZIN-DOMAIN/api/webhook/telegram&secret_token=GUESTFLOW2026
//
// Lokal geliştirme için ngrok kullanın:
//   ngrok http 3000  →  https://xxxx.ngrok.io/api/webhook/telegram

import { NextResponse } from 'next/server';
import { analyzeGuestMessage } from '@/lib/openai-service';
import {
    saveMessageToSupabase,
    upsertTicket,
    writeLog
} from '@/lib/supabase-client';

// Webhook güvenlik token'ı (isteğe bağlı doğrulama)
const WEBHOOK_SECRET = 'GUESTFLOW2026';

// Bot token → isim eşleştirmesi
const BOT_MAP: Record<string, string> = {
    [process.env.TELEGRAM_GUEST_BOT_TOKEN || '']: 'hotelmisafiri_bot',
    [process.env.TELEGRAM_MANAGER_BOT_TOKEN || '']: 'hotel_yonetici_bot',
    [process.env.TELEGRAM_GA_HOTEL_BOT_TOKEN || '']: 'ga_hotel_bot',
};

// Varsayılan bot (gelen mesajlara yanıt atılacak bot)
const DEFAULT_REPLY_TOKEN = process.env.TELEGRAM_GUEST_BOT_TOKEN || '';

async function sendTelegramReply(token: string, chatId: string | number, text: string) {
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
}

export async function POST(req: Request) {
    try {
        // Güvenlik doğrulaması (isteğe bağlı)
        const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
        if (secretHeader && secretHeader !== WEBHOOK_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();

        // Telegram Update objesi
        const message = body?.message || body?.edited_message;
        if (!message) {
            // Callback query vs. — şimdilik yoksay
            return NextResponse.json({ ok: true });
        }

        const chatId = String(message.chat?.id || '');
        const text = message.text || message.caption || '';
        const firstName = message.from?.first_name || 'Misafir';
        const lastName = message.from?.last_name || '';
        const guestName = `${firstName} ${lastName}`.trim();
        const botName = 'hotelmisafiri_bot'; // Webhook tek endpoint olduğu için varsayılan

        if (!text || !chatId) {
            return NextResponse.json({ ok: true });
        }

        console.log(`📨 Telegram webhook: chatId=${chatId} | text="${text.substring(0, 60)}"`);

        // 1. Gelen mesajı Supabase'e kaydet
        await saveMessageToSupabase({
            chat_id: chatId,
            bot_name: botName,
            role: 'user',
            text,
            platform: 'Telegram',
        });

        await writeLog('INFO', 'GuestBot', `Yeni mesaj — chat_id=${chatId} | "${text.substring(0, 50)}"`);

        // 2. OpenAI ile analiz et
        let aiResult;
        try {
            aiResult = await analyzeGuestMessage(text);
            console.log('🧠 AI Sonuç:', aiResult.intent, '|', aiResult.department);
        } catch (e) {
            console.error('OpenAI hatası:', e);
            aiResult = null;
        }

        // 3. AI yanıtını kaydet ve misafire gönder
        if (aiResult?.ai_safe_reply) {
            // Misafire yanıt gönder
            await sendTelegramReply(DEFAULT_REPLY_TOKEN, chatId, aiResult.ai_safe_reply);

            // Yanıtı Supabase'e kaydet
            await saveMessageToSupabase({
                chat_id: chatId,
                bot_name: botName,
                role: 'assistant',
                text: aiResult.ai_safe_reply,
                platform: 'Telegram',
                intent: aiResult.intent,
                department: aiResult.department,
            });

            await writeLog('SUCCESS', 'OpenAI', `AI yanıt gönderildi — intent=${aiResult.intent} | chat=${chatId}`);
        }

        // 4. Talep/Şikayet ise ticket oluştur
        if (aiResult && (aiResult.intent === 'REQUEST' || aiResult.intent === 'COMPLAINT')) {
            const ticketId = `HTL-${Date.now().toString().slice(-5)}`;
            const status = aiResult.is_alerjen ? 'CRITICAL' : 'OPEN';

            await upsertTicket({
                ticket_id: ticketId,
                chat_id: chatId,
                guest_name: guestName,
                department: aiResult.department || 'Resepsiyon',
                status,
                priority: aiResult.is_alerjen ? 'CRITICAL' : 'NORMAL',
                description: text,
                is_alerjen: aiResult.is_alerjen,
            });

            // Departman botu üzerinden bildirim
            const deptChatId = getDeptChatId(aiResult.department || '');
            if (deptChatId) {
                const deptMsg = aiResult.is_alerjen
                    ? `🚨 <b>ALERJEN UYARISI!</b> 🚨\n\n<b>Ticket:</b> #${ticketId}\n<b>Misafir:</b> ${guestName}\n<b>Mesaj:</b> <i>${text}</i>`
                    : `🏨 <b>YENİ TALEP</b>\n\n<b>Ticket:</b> #${ticketId}\n<b>Misafir:</b> ${guestName}\n<b>Departman:</b> ${aiResult.department}\n<b>Talep:</b> <i>${text}</i>`;

                await sendTelegramReply(process.env.TELEGRAM_GA_HOTEL_BOT_TOKEN || '', deptChatId, deptMsg);
            }

            // Misafire onay
            const ackMsg = aiResult.language === 'tr'
                ? `✅ Talebinizi aldık! #${ticketId} numaralı bilet oluşturuldu. En kısa sürede ilgilenilecektir.`
                : `✅ Your request has been received! Ticket #${ticketId} created. We will attend shortly.`;
            await sendTelegramReply(DEFAULT_REPLY_TOKEN, chatId, ackMsg);

            await saveMessageToSupabase({
                chat_id: chatId,
                bot_name: botName,
                role: 'assistant',
                text: ackMsg,
                platform: 'Telegram',
                intent: aiResult.intent,
                department: aiResult.department,
                ticket_id: ticketId,
                is_alerjen: aiResult.is_alerjen,
            });

            await writeLog('SUCCESS', 'n8n', `Ticket oluşturuldu — #${ticketId} | dept=${aiResult.department}`);
            if (aiResult.is_alerjen) {
                await writeLog('WARNING', 'SLA', `🚨 ALERJEN bildirimi — #${ticketId} | ${aiResult.department}`);
            }
        }

        return NextResponse.json({ ok: true });

    } catch (error: any) {
        console.error('Telegram Webhook Hatası:', error);
        await writeLog('ERROR', 'Telegram', `Webhook hatası: ${error?.message || 'Bilinmeyen hata'}`);
        return NextResponse.json({ ok: true }); // Telegram 200 bekler, hata alsak bile
    }
}

// GET: webhook doğrulama (Telegram bazı durumlarda GET atar)
export async function GET() {
    return NextResponse.json({ status: 'GuestFlow AI Telegram Webhook aktif ✅' });
}

// Departman → Telegram chat_id eşleştirmesi (.env veya settings'ten çekilebilir)
function getDeptChatId(dept: string): string | null {
    const map: Record<string, string> = {
        'Housekeeping': '-100192837471',
        'Teknik Servis': '-100148819233',
        'F&B (Gastro)': '-10011223344',
        'Resepsiyon': '-100993881231',
        'Guest Relation': '-100993881231',
        'Room Servis': '-100993881231',
    };
    return map[dept] || null;
}
