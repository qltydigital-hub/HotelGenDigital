// src/app/api/webhook/telegram/route.ts
// Tüm Telegram botlarının update'lerini bu endpoint alır.
// Telegram'a şu komutu kaydetmeniz gerekir:
//   setWebhook?url=https://SIZIN-DOMAIN/api/webhook/telegram&secret_token=GUESTFLOW2026
//
// Lokal geliştirme için ngrok kullanın:
//   ngrok http 3000  →  https://xxxx.ngrok.io/api/webhook/telegram

import { NextResponse } from 'next/server';
import { analyzeGuestMessage, removeTurkishAccents } from '@/lib/openai-service';
import {
    saveMessageToSupabase,
    upsertTicket,
    writeLog
} from '@/lib/supabase-client';
import { getActiveBotTokens } from '@/lib/bot-tokens';

// Webhook güvenlik token'ı (isteğe bağlı doğrulama)
const WEBHOOK_SECRET = 'GUESTFLOW2026';

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
        const botTokens = await getActiveBotTokens();
        
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
        let text = message.text || message.caption || '';
        const firstName = message.from?.first_name || 'Misafir';
        const lastName = message.from?.last_name || '';
        let guestName = `${firstName} ${lastName}`.trim();
        const botName = 'hotelmisafiri_bot'; // Webhook tek endpoint olduğu için varsayılan

        // No longer applying accent removal as DB supports UTF-8
        // if (text) text = removeTurkishAccents(text);
        // if (guestName) guestName = removeTurkishAccents(guestName);

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

        // Yönetici Rapor Talebi Kontrolü (Teknik Servis)
        const reportRegex = /(bugün|günlük|haftalık|aylık|bugünün|bu haftanın|bu ayın).*teknik servis.*(rapor|talep|durum)/i;
        const alternativeRegex = /teknik servis.*(bugün|günlük|haftalık|aylık|bugünün|bu haftanın|bu ayın).*(rapor|talep|durum)/i;

        if (reportRegex.test(text) || alternativeRegex.test(text)) {
            console.log("Yönetici Teknik Servis Raporu İstedi:", text);
            
            // Tarih filtrelemesi belirleme
            let startDate = new Date();
            let periodText = "Günlük";
            if (text.toLowerCase().includes('hafta')) {
                startDate.setDate(startDate.getDate() - 7);
                periodText = "Haftalık";
            } else if (text.toLowerCase().includes('ay')) {
                startDate.setMonth(startDate.getMonth() - 1);
                periodText = "Aylık";
            }
            startDate.setHours(0, 0, 0, 0);

            // DB'den Teknik Servis ticketlarını çek ('Teknik Servis' veya 'T/S')
            const { getServiceSupabase } = require('@/lib/supabase-client');
            const supabase = getServiceSupabase();
            
            const { data: tickets, error } = await supabase
                .from('active_tickets')
                .select('*')
                .or('department.ilike.%teknik%,department.ilike.%technical%,department.eq.T/S')
                .gte('created_at', startDate.toISOString())
                .order('created_at', { ascending: false });

            let replyText = `📊 <b>TEKNİK SERVİS ${periodText.toUpperCase()} RAPORU</b> 📊\n\n`;
            
            if (error || !tickets || tickets.length === 0) {
                replyText += "Bu dönem için herhangi bir teknik servis talebi bulunamadı.";
            } else {
                const pending = tickets.filter((t: any) => t.status === 'PENDING').length;
                const completed = tickets.length - pending;
                
                replyText += `<b>Toplam Talep:</b> ${tickets.length}\n`;
                replyText += `✅ <b>Çözülen:</b> ${completed}\n`;
                replyText += `⏳ <b>Bekleyen:</b> ${pending}\n\n`;
                replyText += `<b>Son Gelen Talepler:</b>\n`;
                
                // En son 5 bileti göster
                tickets.slice(0, 5).forEach((t: any, idx: number) => {
                    replyText += `${idx+1}. <b>Oda ${t.room_no}</b> - <i>${t.original_message}</i> [Durum: ${t.status}]\n`;
                });
            }

            await sendTelegramReply(botTokens.MANAGER_BOT || botTokens.GUEST_BOT, chatId, replyText);
            return NextResponse.json({ ok: true });
        }

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
            await sendTelegramReply(botTokens.GUEST_BOT, chatId, aiResult.ai_safe_reply);

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

                const deptBotToken = botTokens.getDepartmentBot(aiResult.department || '');
                await sendTelegramReply(deptBotToken, deptChatId, deptMsg);
            }

            // Misafire onay
            const ackMsg = aiResult.language === 'tr'
                ? `✅ Talebinizi aldık! #${ticketId} numaralı bilet oluşturuldu. En kısa sürede ilgilenilecektir.`
                : `✅ Your request has been received! Ticket #${ticketId} created. We will attend shortly.`;
            await sendTelegramReply(botTokens.GUEST_BOT, chatId, ackMsg);

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
