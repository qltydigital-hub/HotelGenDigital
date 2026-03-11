# WhatsApp Bot Aktivasyon Rehberi

## Şu An: PASIF ⏸️

WhatsApp botu hazır ama aktif değil. Aktif etmek için aşağıdaki adımları izle.

---

## Aktif Etme Adımları

### 1. Twilio Hesabı Aç
- https://www.twilio.com/try-twilio adresinden ücretsiz hesap aç
- WhatsApp Sandbox'ı aktif et (Messaging > Try it Out > WhatsApp)

### 2. `.env` Dosyasını Doldur
```env
WHATSAPP_ACTIVE=true
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
WHATSAPP_PORT=3001
DASHBOARD_PUBLIC_URL=https://senin-domain.com
```

### 3. Bağımlılıkları Kur
```bash
cd whatsapp-bot
npm install
```

### 4. Ngrok ile Test Et
```bash
npx ngrok http 3001
```
Ngrok URL'ini Twilio Sandbox Webhook alanına gir:
`https://xxxx.ngrok.io/webhook/whatsapp`

### 5. PM2'ye Ekle
`ecosystem.config.js` dosyasına şunu ekle:
```js
{
  name: 'hotel-whatsapp-bot',
  cwd: './whatsapp-bot',
  script: 'index.js',
  autorestart: true
}
```

---

## QR Check-in Entegrasyonu

### Seçenek A — QR → WhatsApp Deep Link
QR kodu şu URL'ye yönlendir:
```
https://wa.me/+905XXXXXXXXX?text=CHECKIN
```
Misafir QR'ı okutunca WhatsApp açılır, "CHECKIN" yazısı hazır gelir, gönderince bot hoş geldiniz + harita yollar.

### Seçenek B — Reception Panelinden Tetikle
Check-in anında reception paneli bu endpoint'i çağırır:
```
POST http://localhost:3001/api/checkin
Body: { "phoneNumber": "+905551234567", "guestName": "Ahmet Yılmaz", "roomNumber": "214" }
```
Bot otomatik olarak misafirin WhatsApp'ına hoşgeldiniz + harita mesajı gönderir.

---

## Durum
- [x] Kod hazır
- [x] Twilio entegrasyonu yazıldı  
- [x] Hoş geldiniz mesajı + harita gönderimi
- [x] Check-in API endpoint
- [ ] Twilio hesabı açılacak
- [ ] .env doldurulacak
- [ ] PM2'ye eklenecek
