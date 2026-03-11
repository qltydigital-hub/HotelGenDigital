// src/lib/telegram-service.ts

const GUEST_BOT_TOKEN = process.env.TELEGRAM_GUEST_BOT_TOKEN;
const MANAGER_BOT_TOKEN = process.env.TELEGRAM_MANAGER_BOT_TOKEN;

// Telegram API'sine HTTP POST isteği atan çekirdek fonksiyon
async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
    if (!token || !chatId) {
        console.warn("Telegram Token veya ChatId eksik! Mesaj gönderilmedi:", text);
        return false;
    }

    try {
        const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text,
                parse_mode: 'HTML',
                reply_markup: replyMarkup
            })
        });

        const result = await response.json();
        if (!result.ok) {
            console.error("Telegram API Hatası:", result.description);
            return false;
        }
        return true;
    } catch (error) {
        console.error("Telegram gönderim hatası:", error);
        return false;
    }
}

/**
 * Yeni bir talep açıldığında (ör: Teknik, Housekeeping) departman grubuna mesaj atar ve 
 * personele "İlgileniyorum (ACK)" butonu sunar.
 */
export async function notifyDepartment(
    departmentChatId: string,
    ticketId: string,
    roomNo: string,
    guestName: string,
    message: string,
    isAlerjen: boolean
) {
    const alerjenWarning = isAlerjen ? "🚨 <b>DİKKAT! ALERJEN ŞÜPHESİ/BİLDİRİMİ! (F&B/GASTRO)</b> 🚨\n\n" : "";
    const text = `${alerjenWarning}🏨 <b>YENİ ODA TALEBİ</b>\n\n<b>Talep ID:</b> #${ticketId}\n<b>Oda No:</b> ${roomNo}\n<b>Misafir:</b> ${guestName}\n\n<b>Talep/Şikayet:</b>\n<i>${message}</i>\n\nLütfen talebi üstlenip 15 dakika içinde aksiyon alınız.`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: "👍 İlgileniyorum (Hemen)", callback_data: `ACK_${ticketId}_NOW` },
                { text: "⏳ İlgileneceğim (15 Dk)", callback_data: `ACK_${ticketId}_15M` }
            ]
        ]
    };

    return await sendTelegramMessage(GUEST_BOT_TOKEN || "", departmentChatId, text, replyMarkup);
}

/**
 * 5 Dakika içinde departmandan yanıt (ACK) gelmezse yöneticilere ve resepsiyona ACİL bildirimi.
 */
export async function escalateToManagement(
    managerChatId: string,
    ticketId: string,
    departmentName: string
) {
    const text = `⚠️ <b>SLA İHLALİ (ESKALASYON)</b> ⚠️\n\n<b>Talep:</b> #${ticketId}\n<b>Departman:</b> ${departmentName}\n\nBu talep 5 dakikadır hiçbir personel tarafından üstlenilmedi (ACK yapılmadı). Resepsiyonun acil müdahalesi ve açıklama girmesi zorunludur!`;

    // SLA İhlallerini Yönetici botundan gönderelim
    return await sendTelegramMessage(MANAGER_BOT_TOKEN || "", managerChatId, text);
}
