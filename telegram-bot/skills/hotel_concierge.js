/**
 * SKILL 2: Hotel Concierge
 * ─────────────────────────────────────────────────────────
 * Otel haritası/krokisi gönderme ve tesis bilgi servisleri.
 * Misafir "harita", "kroki", "nerede" gibi anahtar kelimeler
 * kullandığında veya /harita komutu verdiğinde çalışır.
 *
 * Kullanım:
 *   const { sendHotelMap } = require('./skills/hotel_concierge');
 *   await sendHotelMap(ctx);
 */

const fs = require('fs');
const path = require('path');

// Otel haritası dosya yolu (assets klasöründen)
const MAP_PATH = path.resolve(__dirname, '..', 'assets', 'hotel_harita.png');

/**
 * Otel haritasını/krokisini misafire gönderir.
 * Dosya yoksa bilgilendirme mesajı gösterir.
 * 
 * @param {object} ctx - Telegraf context nesnesi
 */
async function sendHotelMap(ctx) {
    try {
        if (fs.existsSync(MAP_PATH)) {
            await ctx.replyWithPhoto(
                { source: fs.createReadStream(MAP_PATH) },
                {
                    caption: '🗺️ *The Green Park Gaziantep — Otel Krokisi*\n\n'
                        + 'Tesisin genel yerleşim haritası yukarıdadır.\n'
                        + 'Herhangi bir sorunuz olursa çekinmeden sorabilirsiniz! 😊\n\n'
                        + '_İyi konaklamalar dileriz!_ 🏨',
                    parse_mode: 'Markdown'
                }
            );
            console.log(`🗺️ [CONCIERGE] Otel haritası gönderildi → chatId: ${ctx.chat.id}`);
        } else {
            await ctx.replyWithMarkdown(
                '🗺️ Otel haritamız şu an güncelleniyor.\n\n'
                + 'Tesis içinde yönlendirme için resepsiyonumuza ulaşabilirsiniz:\n'
                + '📞 *+90 (850) 222 72 75*\n\n'
                + '_Yardımcı olmaktan memnuniyet duyarız!_'
            );
            console.warn(`⚠️ [CONCIERGE] Harita dosyası bulunamadı: ${MAP_PATH}`);
        }
    } catch (e) {
        console.error(`[CONCIERGE] Harita gönderim hatası:`, e.message);
        await ctx.reply('Harita gönderilirken bir sorun oluştu. Lütfen tekrar deneyiniz.');
    }
}

module.exports = { sendHotelMap };
