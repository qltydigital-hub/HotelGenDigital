# 👨‍💻 GELİŞTİRİCİ KILAVUZU (DEVELOPER GUIDE)

Bu belge, HotelGen Digital projesine katkıda bulunan tüm geliştiricilerin ve AI asistanların, geliştirme sürecinde uyması gereken kuralları, mimari kararları ve kod standartlarını tanımlar.

> ⚠️ Bu dosyayı okumadam projeye kod yazmaya başlama!

---

## 1. PROJE MİMARİSİ

### 1.1 Bileşenler

```
hotel_proje/
├── telegram-bot/          # Ana AI Bot (Node.js / Telegraf)
│   ├── index.js           # Bot ana dosyası
│   ├── .env               # Ortam değişkenleri (GİZLİ)
│   ├── assets/            # Medya dosyaları (harita vs.)
│   └── package.json
│
├── hotel-admin-dashboard/  # Yönetim Paneli (Next.js)
│   ├── src/
│   │   ├── app/           # App router sayfaları
│   │   ├── lib/           # Yardımcı fonksiyonlar
│   │   └── providers/     # Context provider'lar
│   └── package.json
│
├── whatsapp-bot/          # WhatsApp Bot (Faz 2)
├── rapor-bot/             # Rapor Bot (Faz 2)
│
├── ─── KURAL .MD DOSYALARI ───
├── README.md              # 📜 Proje Anayasası
├── AI_DAVRANIS_KURALLARI.md    # 🤖 AI Davranış Kuralları
├── TALEP_YONETIMI.md           # 📋 Talep İş Akışı
├── MISAFIR_DOGRULAMA.md        # 🔐 Misafir Doğrulama
├── DEPARTMAN_SLA_YONETIMI.md   # 🏢 Departman & SLA
├── HAFIZA_YONETIMI.md          # 🧠 Hafıza & Context
├── GUVENLIK_VE_ERISIM.md       # 🛡️ Güvenlik & KVKK
├── OTEL_BILGI_BANKASI.md       # 🏨 Otel Bilgi Bankası
├── ZAMAN_YONETIMI.md           # 🕰️ Zaman Yönetimi
├── GELISTIRICI_KILAVUZU.md     # 👨‍💻 Bu dosya
│
├── ─── SQL ŞEMALARI ───
├── hotel_base_schema.sql       # Ana DB şeması
├── migration_revision_v1.sql   # Revizyon migrasyonu
├── authorized_managers_schema.sql
├── ticket_rapor_schema.sql
├── setup_personnel.sql
│
└── ─── SKILL DOSYALARI ───
    ├── api_management_skill.md
    ├── hotelstratejisti_skill.md
    └── digital_marketing_funnel_skill.md
```

### 1.2 Teknoloji Yığını

| Katman | Teknoloji | Versiyon |
|---|---|---|
| Bot Framework | Telegraf (Node.js) | 4.x |
| AI Model | OpenAI GPT-4o | Latest |
| Veritabanı | Supabase (PostgreSQL) | - |
| Dashboard | Next.js + TailwindCSS | 14.x |
| Deployment | PM2 + Netlify | - |
| Ses İşleme | ffmpeg + Whisper | - |

---

## 2. GELİŞTİRME PRENSİPLERİ

### 2.1 Altın Kurallar (MUTLAKA UY)

1. **Context'i Koru:** Her bileşen birbiriyle bağlıdır. Bir yeri değiştirirken diğer bileşenlerin etkilenip etkilenmediğini kontrol et.

2. **Single Source of Truth:** Hiçbir veri hard-coded yazılmaz. Her şey ya Supabase'den ya da .md bilgi bankasından gelir.

3. **Triple Check:** Her talebin 3 noktada kontrol edildiğinden emin ol:
   - ✅ Misafire yanıt döndü mü?
   - ✅ Departmana bildirim gitti mi?
   - ✅ SLA zamanlayıcısı başladı mı?

4. **Halüsinasyon Sıfır:** AI'ın ürettiği her yanıt, somut verilere dayanmalı. Belirsizlikte uydurma yerine "bilmiyorum" de veya resepsiyona yönlendir.

5. **Test Et:** Her değişiklikten sonra en azından şu senaryoları test et:
   - Bilgi sorusu (saat, restoran)
   - Talep (yastık, arıza)
   - Doğrulama akışı (ad/oda sor → doğrula)
   - SLA eskalasyonu

### 2.2 Kod Yazım Standartları

```javascript
// ✅ DOĞRU: Açıklayıcı değişken isimleri
const guestValidation = await validateGuestInHouse(fullName, roomNo);

// ❌ YANLIŞ: Belirsiz isimler
const x = await check(n, r);

// ✅ DOĞRU: Hata yönetimi
try {
    const result = await supabase.from('in_house_guests').select('*');
    if (result.error) throw result.error;
} catch (e) {
    console.error('[MODULE_NAME] Hata:', e.message);
    // Fallback davranışı tanımla
}

// ❌ YANLIŞ: Sessiz hata yutma
try { await something(); } catch(e) {}
```

### 2.3 Commit Mesaj Formatı
```
[BİLEŞEN] Değişiklik açıklaması

Örnekler:
[BOT] Misafir doğrulama akışı eklendi
[DASHBOARD] SLA widget bileşeni güncellendi
[DB] in_house_guests tablosuna vip_status kolonu eklendi
[DOCS] AI_DAVRANIS_KURALLARI.md güncellendi
```

---

## 3. .MD DOSYALARININ KULLANIMI

### 3.1 Dosya Referans Haritası

Herhangi bir geliştirme yaparken hangi .md dosyalarını oku:

| Geliştirme Alanı | Referans .md Dosyaları |
|---|---|
| AI prompt değişikliği | `AI_DAVRANIS_KURALLARI.md`, `OTEL_BILGI_BANKASI.md` |
| Talep akışında değişiklik | `TALEP_YONETIMI.md`, `MISAFIR_DOGRULAMA.md` |
| Departman/SLA değişikliği | `DEPARTMAN_SLA_YONETIMI.md` |
| Hafıza/session değişikliği | `HAFIZA_YONETIMI.md` |
| Güvenlik değişikliği | `GUVENLIK_VE_ERISIM.md` |
| Otel bilgisi güncelleme | `OTEL_BILGI_BANKASI.md` |
| Zaman/tarih problemi | `ZAMAN_YONETIMI.md` |
| Genel mimari kararları | `README.md` (Anayasa) |

### 3.2 .md Dosyası Güncelleme Kuralı
- Kod değişikliği yapıldığında ilgili .md dosyası da GÜNCELLENMELİDİR
- .md dosyası ve kod arasında TUTARSIZLIK olmamalı
- Her .md dosyasının sonundaki "Son güncelleme" tarihi güncellenmelidir

---

## 4. SUPABASE VERİTABANI

### 4.1 Aktif Tablolar

| Tablo | Amaç |
|---|---|
| `hotel_personnel` | Departman personeli (kim, hangi kanal, hangi departman) |
| `live_tickets` | Canlı talep/görev takibi |
| `ticket_events` | Talep hareket logları |
| `in_house_guests` | Otelde konaklayan misafir listesi (Excel'den yüklenir) |
| `hotel_settings` | Otel ayarları (JSON) |
| `departments` | Departman tanımları ve SLA süreleri |
| `allergy_alerts` | Alerji bildirim logları |
| `rooms` | Oda durumları (temiz/kirli/arızalı) |
| `staff_users` | Personel giriş bilgileri |

### 4.2 Kritik Sorgular

```sql
-- Aktif konaklayan kontrol
SELECT * FROM in_house_guests 
WHERE room_number = '305' 
AND first_name ILIKE '%Mehmet%'
AND check_out >= CURRENT_DATE;

-- Departman personeli çek
SELECT * FROM hotel_personnel 
WHERE department = 'HOUSEKEEPING' AND is_active = true;

-- SLA süresi çek
SELECT sla_timeout_min FROM departments 
WHERE name = 'TEKNIK';

-- Açık ticket'ları listele
SELECT * FROM live_tickets 
WHERE status IN ('OPEN', 'ESCALATED') 
ORDER BY created_at DESC;
```

---

## 5. ORTAM DEĞİŞKENLERİ (.env)

### 5.1 Zorunlu Değişkenler

```env
# AI
OPENAI_API_KEY=sk-...

# Telegram
TELEGRAM_TOKEN=...

# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=...

# Dashboard
DASHBOARD_API_URL=http://localhost:3000
```

### 5.2 Opsiyonel Değişkenler

```env
# Departman Telegram ID'leri (Fallback)
DEPT_HOUSEKEEPING_ID=
DEPT_TEKNIK_ID=
DEPT_RESEPSIYON_ID=
DEPT_FB_ID=
DEPT_GUEST_RELATIONS_ID=

# Express Port
EXPRESS_PORT=3005
```

---

## 6. TEST SENARYOLARI (ZORUNLU)

Her deploy öncesi şu senaryolar test EDİLMELİDİR:

### 6.1 Temel Fonksiyon Testleri

| # | Test | Beklenen Sonuç |
|---|---|---|
| 1 | "Merhaba" yaz | Karşılama mesajı gelir, isim UYDURMAZ |
| 2 | "Saat kaç?" yaz | Anında doğru saat verilir, "araştırıyorum" DEMEZ |
| 3 | "Odama yastık istiyorum" yaz | Bilgi ister (ad, oda), direkt "iletildi" DEMEZ |
| 4 | Ad ve oda ver (doğru) | In-House doğrular, departmana iletir |
| 5 | Ad ve oda ver (yanlış) | "Eşleşmedi" der, tekrar ister |
| 6 | İkinci talep yap (session var) | Tekrar bilgi sormaz, direkt iletir |
| 7 | Departman ACK vermezse | SLA sonrası eskalasyon tetiklenir |
| 8 | İngilizce mesaj yaz | İngilizce yanıt gelir |
| 9 | Acil durum mesajı | Anında güvenlik + resepsiyon bildirimi |
| 10 | Sesli mesaj gönder | Whisper ile çözümlenir, metin gibi işlenir |

### 6.2 Edge Case Testleri

| # | Test | Beklenen Sonuç |
|---|---|---|
| 1 | "Yaztık isiyorım" (typo) | Yastık istediği anlaşılır, talebi oluşturulur |
| 2 | "Havuz saati + 2 havlu" (karma mesaj) | Soru yanıtlanır + talep oluşturulur |
| 3 | Aynı talebi 2 kez gönder | Tekrar uyarısı verilir |
| 4 | Supabase kapalıyken talep | Hata mesajı + resepsiyona yönlendirme |
| 5 | Çok uzun mesaj gönder | AI makul yanıt verir, çökmez |

---

## 7. DEPLOY KONTROLÜ

### 7.1 Pre-Deploy Checklist

- [ ] Tüm test senaryoları başarılı
- [ ] .env dosyası güncel ve production değerleri doğru
- [ ] .md dosyaları ile kod arasında tutarsızlık yok
- [ ] console.log'lar production-uygun (gereksiz debug logları kaldırıldı)
- [ ] Supabase tabloları güncel (migration çalıştırıldı)
- [ ] PM2 ecosystem.config.js doğru

### 7.2 Deploy Komutları

```bash
# Bot deploy
cd telegram-bot
pm2 restart ecosystem.config.js

# Dashboard deploy
cd hotel-admin-dashboard
npm run build
# Netlify otomatik deploy (git push)
```

---

*Son güncelleme: 2026-04-09*
