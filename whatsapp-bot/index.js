require('dotenv').config({ path: '.env' });
const express = require('express');
const twilio = require('twilio');
const { OpenAI } = require('openai');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════════════
//  THE GREEN PARK GAZİANTEP — WhatsApp Bot (Twilio)
//  DURUM: HAZIR — Aktif etmek için README.md'yi okuyun
// ══════════════════════════════════════════════════════════════════

const WHATSAPP_ACTIVE = process.env.WHATSAPP_ACTIVE === 'true'; // .env'den kontrol

if (!WHATSAPP_ACTIVE) {
    console.log('⏸️  WhatsApp Bot PASIF. Aktif etmek için .env dosyasında WHATSAPP_ACTIVE=true yapın.');
    process.exit(0);
}

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
);
const WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_NUMBER; // whatsapp:+14155238886

let openai;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// ── Karşılama Mesajı Gönder (Check-in QR'dan tetiklenince) ────────
async function sendWelcomeMessage(toNumber) {
    const welcomeText = `🏨 *The Green Park Gaziantep'e Hoş Geldiniz!*

Sayın misafirimiz, otelimizdeki konaklamanızı keyifli ve konforlu hale getirmek için buradayız.

Memnuniyetiniz bizim için son derece önemlidir. Herhangi bir sorunuz ya da talebiniz olduğunda lütfen buradan bize bildirin — ekibimiz en kısa sürede ilgilenecektir. 🙏

📞 +90 (850) 222 72 75
📧 info@thegreenpark.com`;

    // Metin mesajı
    await twilioClient.messages.create({
        from: WHATSAPP_FROM,
        to: `whatsapp:${toNumber}`,
        body: welcomeText
    });

    // Otel haritası gönder
    const mapUrl = process.env.DASHBOARD_PUBLIC_URL
        ? `${process.env.DASHBOARD_PUBLIC_URL}/assets/hotel_harita.png`
        : null;

    if (mapUrl) {
        await twilioClient.messages.create({
            from: WHATSAPP_FROM,
            to: `whatsapp:${toNumber}`,
            body: '🗺️ The Green Park Gaziantep — Otel Krokisi\nTesisin genel yerleşim haritası:',
            mediaUrl: [mapUrl]
        });
    }
}

// ── Gelen Mesajları İşle ───────────────────────────────────────────
app.post('/webhook/whatsapp', async (req, res) => {
    const from = req.body.From?.replace('whatsapp:', '');
    const body = req.body.Body?.trim();

    console.log(`📱 [WhatsApp] ${from}: ${body}`);

    // Check-in QR kodu tespiti (QR kodu "CHECKIN" ile başlıyorsa)
    if (body?.toUpperCase().startsWith('CHECKIN') || body === 'Merhaba' || body === 'Hi') {
        await sendWelcomeMessage(from);
        return res.status(200).send('<Response></Response>');
    }

    // Normal mesajları AI ile işle
    // TODO: Telegram botundaki aynı AI mantığını buraya entegre et
    res.status(200).send('<Response><Message>Mesajınız alındı, en kısa sürede yanıtlanacaktır.</Message></Response>');
});

// ── Check-in Sistemi Endpoint (Reception panelinden tetiklenir) ────
// Misafir check-in yaptığında resepsiyon masasından bu endpoint çağrılır
app.post('/api/checkin', async (req, res) => {
    const { phoneNumber, guestName, roomNumber } = req.body;

    if (!phoneNumber) {
        return res.status(400).json({ error: 'phoneNumber zorunlu' });
    }

    try {
        await sendWelcomeMessage(phoneNumber);
        console.log(`✅ Check-in karşılama gönderildi: ${guestName} (${phoneNumber})`);
        res.json({ success: true, message: `Karşılama mesajı ${phoneNumber} adresine gönderildi.` });
    } catch (err) {
        console.error('WhatsApp gönderim hatası:', err.message);
        res.status(500).json({ error: err.message });
    }
});

const PORT = process.env.WHATSAPP_PORT || 3001;
app.listen(PORT, () => {
    console.log(`📱 WhatsApp Bot aktif — Port: ${PORT}`);
    console.log(`🔗 Webhook: POST http://localhost:${PORT}/webhook/whatsapp`);
    console.log(`🏨 Check-in API: POST http://localhost:${PORT}/api/checkin`);
});
