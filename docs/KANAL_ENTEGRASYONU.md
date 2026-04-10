# 📡 KANAL ENTEGRASYONU (CHANNEL INTEGRATION)

Bu belge, HotelGen Digital sisteminin farklı iletişim kanallarında (Telegram, WhatsApp, Instagram) nasıl çalışacağını, her kanalın özel kurallarını ve entegrasyon detaylarını tanımlar.

---

## 1. KANAL YAPISI

### 1.1 Aktif Kanallar

| # | Kanal | Durum | Teknoloji | Session Yöntemi |
|---|---|---|---|---|
| 1 | Telegram | ✅ Aktif (Faz 1) | Telegraf (Node.js) | chatId bazlı |
| 2 | Instagram DM | ✅ Aktif (Faz 1) | ManyChat + n8n webhook | contact_id bazlı |
| 3 | WhatsApp | 🔜 Planlanan (Faz 2) | Twilio / ManyChat API | telefon numarası bazlı |
| 4 | Web Chat | 🔜 Planlanan (Faz 3) | WebSocket / REST API | session token bazlı |

---

## 2. TELEGRAM KANALI (ANA KANAL)

### 2.1 Özellikler
- **Bot Framework:** Telegraf (Node.js)
- **Özellikler:** Metin, sesli mesaj (Whisper), inline butonlar
- **Session:** `chatId` bazlı RAM oturumu
- **Doğrulama:** Sohbet içi bilgi toplama + In-House kontrolü
- **Departman İletişimi:** Butonlu mesajlar (ACK / BUSY)

### 2.2 Telegram Özel Kuralları
1. **Profil bilgisi kullanma YASAK:** `ctx.from.first_name` misafir adı DEĞİLDİR
2. **Sesli mesaj desteği:** OGG → MP3 → Whisper → metin olarak işle
3. **Dosya/Resim:** Şimdilik desteklenmez (Faz 2'de foto talep)
4. **Konum paylaşımı:** Desteklenmez (güvenlik gereği)
5. **Inline butonlar:** Departman yanıt butonları (ACK/BUSY/NOTE)

### 2.3 Telegram Mesaj Limitleri
- Maksimum mesaj uzunluğu: 4096 karakter
- Uzun mesajlar otomatik bölünmeli
- Markdown parse_mode kullanılır

### 2.4 Telegram Komutları

| Komut | İşlev |
|---|---|
| `/start` | Session sıfırla, karşılama mesajı göster |
| `/harita` | Otel krokisini gönder |

---

## 3. INSTAGRAM KANALI (WEBHOOK)

### 3.1 Entegrasyon Yapısı

```
Misafir Instagram DM'den yazar
    → ManyChat mesajı algılar
    → n8n (veya doğrudan) webhook tetiklenir
    → POST /api/webhook/instagram
    → Bot mesajı işler
    → JSON yanıt ManyChat'e döner
    → ManyChat yanıtı misafire gönderir
```

### 3.2 Webhook Payload Formatı

```json
{
    "contact_id": "instagram_user_id",
    "text": "Misafirin mesajı",
    "full_name": "Instagram Profil Adı (veya boş)",
    "room_number": "Oda numarası (varsa)",
    "platform": "instagram"
}
```

### 3.3 Instagram Özel Kuralları
1. **Session YOK:** Her istek bağımsız (stateless)
2. **full_name güvenilmez:** Instagram profil adı ≠ check-in ismi
3. **Her istekte doğrulama:** Session olmadığı için her seferinde ad+oda gerekir
4. **Webhook payload'da oda/isim zorunlu:** ManyChat flow'unda önce bu bilgiler toplanmalı

### 3.4 Instagram Yanıt Formatı

```json
{
    "success": true,
    "action": "ROUTED_TO_DEPARTMENT | REPLIED_BY_AI | REJECTED_NOT_IN_HOUSE",
    "department": "HOUSEKEEPING",
    "reply_text": "Misafire gönderilecek yanıt"
}
```

---

## 4. WHATSAPP KANALI (FAZ 2)

### 4.1 Planlanan Yapı
- **Sağlayıcı:** Twilio WhatsApp API veya ManyChat WhatsApp
- **Session:** Telefon numarası bazlı
- **Avantaj:** Telefon numarası ile PMS eşleştirme imkanı

### 4.2 WhatsApp Özel Kuralları (Planlanan)
1. Telefon numarası ile otomatik misafir eşleştirme
2. Multimedya destek (foto, video — arıza kanıtı)
3. Template mesajlar (24 saat kuralı — WhatsApp Business Policy)
4. Opt-in/Opt-out yönetimi

---

## 5. KANAL BAĞIMSIZ KURALLAR (TÜM KANALLARDA GEÇERLİ)

### 5.1 Evrensel Kurallar

| Kural | Açıklama |
|---|---|
| **Dil algılama** | Her kanalda otomatik dil algıla, aynı dilde yanıtla |
| **Doğrulama zorunlu** | Talep işlenmeden önce ad+oda+in-house kontrolü |
| **İsim uydurma yasak** | Hiçbir kanalda, hiçbir koşulda isim uydurulamaz |
| **Departman dili Türkçe** | Departmanlara giden mesajlar her zaman Türkçe |
| **SLA aktif** | Her kanalda SLA zamanlayıcısı çalışır |

### 5.2 Cross-Platform Session

Şu an her platform bağımsız oturum tutar:
- Telegram chatId ≠ Instagram contact_id ≠ WhatsApp telefon
- Aynı misafir farklı kanaldan yazarsa → Yeni doğrulama gerekir
- Gelecekte: Oda numarası bazlı birleştirme planlanıyor

---

## 6. DEPARTMAN MESAJ KANALLARI

### 6.1 Departmandan Misafire (ONE-WAY)

Departman personeli misafirle **ASLA** doğrudan iletişim kurmaz:
- Personel sadece butonlara tıklar (ACK / BUSY / NOTE)
- Misafirle iletişim her zaman AI/Bot üzerinden olur
- Bu kural TÜM kanallarda geçerlidir

### 6.2 Departmana Mesaj Gönderim Önceliği

```
1. Supabase hotel_personnel tablosu → İlgili departman yetkililerine gönder
2. .env DEPT_xxx_ID → Fallback olarak environment değişkeninden gönder
3. Mock Fallback → Test modunda misafirin kendi chatine gönder
```

---

## 7. KANAL PERFORMANS İZLEME

### 7.1 Kanal Bazlı KPI'lar

| Metrik | Telegram | Instagram | WhatsApp |
|---|---|---|---|
| Ortalama yanıt süresi | < 3 sn | < 10 sn (webhook) | < 5 sn |
| Mesaj başarı oranı | > %99 | > %95 | > %98 |
| Doğrulama başarı oranı | Takip edilir | Takip edilir | Takip edilir |

---

*Son güncelleme: 2026-04-09*
