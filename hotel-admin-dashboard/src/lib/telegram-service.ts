// src/lib/telegram-service.ts

const GUEST_BOT_TOKEN = process.env.TELEGRAM_GUEST_BOT_TOKEN;
const MANAGER_BOT_TOKEN = process.env.TELEGRAM_MANAGER_BOT_TOKEN;

// Telegram API'sine HTTP POST isteği atan çekirdek fonksiyon
export async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
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
    turkishTranslation: string,
    isAlerjen: boolean,
    imageUrl?: string | null
) {
    const alerjenWarning = isAlerjen ? "🚨 <b>DİKKAT! ALERJEN ŞÜPHESİ/BİLDİRİMİ! (F&B/GASTRO)</b> 🚨\n\n" : "";
    const text = `${alerjenWarning}🏨 <b>YENİ ODA TALEBİ</b>\n\n<b>Talep ID:</b> #${ticketId}\n<b>Oda No:</b> ${roomNo}\n<b>Misafir:</b> ${guestName}\n\n<b>Talep (Orijinal):</b>\n<i>${message}</i>\n\n<b>Çeviri (Türkçe):</b>\n<b>${turkishTranslation}</b>\n\nLütfen talebi üstlenip süreniz dolmadan aksiyon alınız.`;

    const replyMarkup = {
        inline_keyboard: [
            [
                { text: "👍 Talebi Aldım (Hemen İlgileniyorum)", callback_data: `ACK_${ticketId}_NOW` },
            ],
            [
                { text: "⏳ Talebi Aldım (Sonra İlgileneceğim)", callback_data: `ACK_${ticketId}_LATER` }
            ]
        ]
    };

    if (imageUrl) {
        // Resimli gönderme
        try {
            const resp = await fetch(`https://api.telegram.org/bot${GUEST_BOT_TOKEN}/sendPhoto`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: departmentChatId,
                    photo: imageUrl,
                    caption: text.substring(0, 1024), // Telegram caption max 1024
                    parse_mode: 'HTML',
                    reply_markup: replyMarkup
                })
            });
            const result = await resp.json();
            if (!result.ok) {
                console.error("Telegram sendPhoto ok null:", result);
                return await sendTelegramMessage(GUEST_BOT_TOKEN || "", departmentChatId, text + "\n(Görsel Yüklenemedi)", replyMarkup);
            }
            return true;
        } catch (e) {
            console.error("Görsel gönderilirken hata oluştu", e);
            return await sendTelegramMessage(GUEST_BOT_TOKEN || "", departmentChatId, text, replyMarkup);
        }
    } else {
        return await sendTelegramMessage(GUEST_BOT_TOKEN || "", departmentChatId, text, replyMarkup);
    }
}

/**
 * 5 Dakika içinde departmandan yanıt (ACK) gelmezse yöneticilere ve resepsiyona ACİL bildirimi.
 */
export async function escalateToManagement(
    managerChatId: string,
    ticketId: string,
    departmentName: string
) {
    const text = `⚠️ <b>SLA İHLALİ (ESKALASYON)</b> ⚠️\n\n<b>Talep:</b> #${ticketId}\n<b>Departman:</b> ${departmentName}\n\nBu talep için verilen süre içerisinde departman personeli tarafından aksiyon alınmadı (Yanıt Butonlarına Tıklanmadı). Resepsiyonun acil müdahalesi ve açıklama girmesi zorunludur!`;

    // SLA İhlallerini Yönetici botundan gönderelim
    return await sendTelegramMessage(MANAGER_BOT_TOKEN || "", managerChatId, text);
}

/**
 * Misafir oda numarası ve ismini verdiğinde, in-house sistemde eşleşme bulunamazsa
 * Resepsiyona anında acil durum bildirimi gönderilir.
 */
export async function notifyMismatchToReception(
    managerChatId: string,
    providedRoomNo: string,
    providedGuestName: string,
    message: string
) {
    const text = `🚨 <b>ACİL DOĞRULAMA UYARISI</b> 🚨\n\nSistemde kaydı bulunmayan biri otel içinden talepte bulunmaya çalıştı!\n\n<b>Beyan Edilen Oda:</b> ${providedRoomNo}\n<b>Beyan Edilen İsim:</b> ${providedGuestName}\n\n<b>Gelen Mesaj:</b>\n<i>${message}</i>\n\nLütfen bu durumu acilen kontrol ediniz.`;

    // Yönetici/Resepsiyon botundan gönderelim
    return await sendTelegramMessage(MANAGER_BOT_TOKEN || GUEST_BOT_TOKEN || "", managerChatId, text);
}
