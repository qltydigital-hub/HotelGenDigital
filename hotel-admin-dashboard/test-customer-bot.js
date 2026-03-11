const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

// Using the key you pasted in standard code
const token = process.env.TELEGRAM_GUEST_BOT_TOKEN || '8525541333:AAFlgjZezQBY9ao77JqABKGMS3Znq5g0uRw';
// Fallback if .env not loaded 

const bot = new TelegramBot(token, { polling: true });

// Read the Hotel Info (Knowledge Base)
const hotelInfoPath = path.join(__dirname, '..', 'hotel.md');
let hotelInfo = '';
try {
    hotelInfo = fs.readFileSync(hotelInfoPath, 'utf8');
} catch (e) {
    console.error("Knowledge Base 'hotel.md' okunamadı! Lütfen dosya yolunu kontrol edin.");
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

console.log(`🤖 Müşteri (Misafir) Telegram Botu Başlatıldı!`);
console.log(`Knowledge base (hotel.md) başarıyla yüklendi.`);
console.log(`Telegram'dan gelecek mesajlar bekleniyor... token:${token.substring(0, 8)}...`);

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const user = msg.from.first_name || 'Misafir';

    if (!text) return; // Ignore non-text messages
    console.log(`[Yeni Mesaj] ${user} (${chatId}): ${text}`);

    if (text === '/start') {
        const hello = `Merhaba ${user}, ben otelimizin yapay zeka destekli sanal asistanıyım. Size doğrudan ${hotelInfoPath.split("\\").pop()} belgesindeki bilgilerle yardımcı olacağım. İstediğiniz dilde soru sorabilirsiniz! (Mesela: "Oda fiyatlarınız nedir?" veya "What time is breakfast?")`;
        return bot.sendMessage(chatId, hello);
    }

    bot.sendChatAction(chatId, 'typing');

    try {
        if (!process.env.OPENAI_API_KEY) {
            bot.sendMessage(chatId, `[AI SIMULASYONU: OpenAI API Key bulunamadı] Sorduğunuz soru: "${text}". Cevap simüle edildi.`);
            return;
        }

        const systemPrompt = `Sen lüks ve kurumsal bir otelin yetkili, yapay zeka destekli müşteri hizmetleri asistanısın. Aşağıdaki ana otel bilgilerini referans alarak kullanıcının sorularını yanıtla.
Müzakereci, ikna edici ve otelin marka değerini koruyan profesyonel bir ton kullan.
Hangi dilde soru sorulursa kesinlikle o dilde cevap ver.
Bilgiler arasında olmayan bir şey sorulursa nazikçe resepsiyon ile görüşmesi gerektiğini söyle.

-- OTEL BILGE BANKASI BAŞLANGICI --\n${hotelInfo}\n-- OTEL BILGE BANKASI SONU --`;

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ],
            temperature: 0.7,
            max_tokens: 500
        });

        const replyMessage = response.choices[0].message.content;
        bot.sendMessage(chatId, replyMessage);
        console.log(`[Yanıt Gönderildi -> ${user}]: Cevap uzunluğu ${replyMessage.length} karakter.`);
    } catch (error) {
        console.error("OpenAI Hatası:", error.message);
        bot.sendMessage(chatId, "Üzgünüm, şu anda sistemim yoğun. Lütfen birkaç dakika sonra tekrar deneyin.");
    }
});
