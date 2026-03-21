import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';
import { setManyChatCustomField, sendManyChatFlow } from '@/lib/manychat-client';
import { MANYCHAT_CONFIG } from '@/lib/manychat-config';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        
        // Sadece callback_query varsa işlem yap (Inline butona tıklanması)
        if (!payload.callback_query) {
            return NextResponse.json({ success: true, message: 'Not a callback query' });
        }

        const callbackQuery = payload.callback_query;
        const data = callbackQuery.data as string; // ACK_${ticketId}_NOW veya LATER
        const messageId = callbackQuery.message?.message_id;
        const chatId = callbackQuery.message?.chat?.id;

        if (data && data.startsWith('ACK_')) {
            const parts = data.split('_');
            const ticketId = parts[1];
            const action = parts[2]; // NOW or LATER

            const supabase = getServiceSupabase();

            // Bileti veritabanından bul
            const { data: ticket, error } = await supabase
                .from('active_tickets')
                .select('*')
                .eq('ticket_id', ticketId)
                .single();

            if (error || !ticket) {
                console.error("Ticket bulunamadı veya hata:", error);
                return updateTelegramMessage(chatId, messageId, "❌ HATA: Bu bilet sistemde bulunamadı veya daha önce kapanmış.");
            }

            if (ticket.status !== 'PENDING') {
                return updateTelegramMessage(chatId, messageId, `⚠️ Bu talep daha önce ACKNOWLEDGE edildi (Durum: ${ticket.status})`);
            }

            // Durumu güncelle
            await supabase.from('active_tickets').update({ status: 'ACKNOWLEDGED', updated_at: new Date().toISOString() }).eq('ticket_id', ticketId);

            // Müşteriye ManyChat üzerinden gönderilecek mesajı belirle
            const replyMsg = action === 'NOW' ? ticket.reply_immediate_lang : ticket.reply_later_lang;

            // ManyChat isteği
            if (ticket.subscriber_id && ticket.subscriber_id !== "unknown") {
                await setManyChatCustomField(ticket.subscriber_id, MANYCHAT_CONFIG.fields.ai_cevap, replyMsg);
                await setManyChatCustomField(ticket.subscriber_id, MANYCHAT_CONFIG.fields.n8n_cevap, replyMsg);
                
                const flowId = ticket.channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink;
                await sendManyChatFlow(ticket.subscriber_id, flowId);
            }

            // Telegram'daki Orijinal mesajı güncelle (Butonları kaldır, üstlendi bilgisini yaz)
            const staffName = callbackQuery.from?.first_name || "Bir Personel";
            const actionText = action === 'NOW' ? "Hemen İlgileniyor🚀" : "Sonra İlgilenecek⏳";
            const newText = callbackQuery.message.text + `\n\n✅ <b>ÜSTLENİLDİ</b>\nPersonel: ${staffName}\nDurum: ${actionText}`;

            await updateTelegramMessage(chatId, messageId, newText);

            // İsteğe bağlı: Telegram'a callback yanıtı gönder (yukarıda popup çıkması için)
            await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_GUEST_BOT_TOKEN}/answerCallbackQuery`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ callback_query_id: callbackQuery.id, text: "Talebi başarıyla üstlendiniz!" })
            });

            return NextResponse.json({ success: true, action: "ACKNOWLEDGED", message: "Success" });
        }

        return NextResponse.json({ success: true, message: 'Ignored' });

    } catch (error) {
        console.error("Telegram Callback Error:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}

// Helper: Mesajı butonları silip günceller
async function updateTelegramMessage(chatId: string, messageId: number, text: string) {
    if (!chatId || !messageId) return NextResponse.json({ success: false });
    
    await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_GUEST_BOT_TOKEN}/editMessageText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            message_id: messageId,
            text: text,
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [] } // Butonları temizle
        })
    });
    return NextResponse.json({ success: true });
}
