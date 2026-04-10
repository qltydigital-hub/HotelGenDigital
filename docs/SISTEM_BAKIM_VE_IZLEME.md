# 🔧 SİSTEM BAKIM VE İZLEME (SYSTEM MAINTENANCE & MONITORING)

Bu belge, HotelGen Digital bot ekosisteminin bakım prosedürlerini, izleme mekanizmalarını, sağlık kontrol (health-check) kurallarını ve deploy prosedürlerini tanımlar.

---

## 1. BOT ÇALIŞMA DURUMU İZLEME

### 1.1 PM2 ile Süreç Yönetimi

```bash
# Bot durumu kontrol
pm2 status

# Bot logları izle
pm2 logs telegram-bot --lines 100

# Bot restart
pm2 restart telegram-bot

# Bot durdur
pm2 stop telegram-bot
```

### 1.2 ecosystem.config.js Yapılandırması

```javascript
module.exports = {
    apps: [{
        name: 'telegram-bot',
        script: 'index.js',
        cwd: './telegram-bot',
        instances: 1,
        autorestart: true,
        watch: false, // Production'da false
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production'
        },
        error_file: '../logs/bot-error.log',
        out_file: '../logs/bot-out.log',
        merge_logs: true,
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
    }]
};
```

---

## 2. SAĞLIK KONTROLÜ (HEALTH CHECK)

### 2.1 Periyodik Kontrol Listesi

| # | Kontrol | Periyot | Otomatik? | Aksiyon |
|---|---|---|---|---|
| 1 | Bot process çalışıyor mu? | Her 1 dk | ✅ PM2 | autorestart |
| 2 | Supabase bağlantısı aktif mi? | Her 5 dk | 🔜 Planlanan | Alert |
| 3 | OpenAI API yanıt veriyor mu? | Her 5 dk | 🔜 Planlanan | Alert + fallback |
| 4 | Telegram Bot API aktif mi? | Her 1 dk | ✅ Telegraf | autoreconnect |
| 5 | In-House tablosu boş mu? | Her 1 saat | 🔜 Planlanan | Alert |
| 6 | SLA timer'lar çalışıyor mu? | Her 10 dk | 🔜 Planlanan | DB tarama |
| 7 | Disk alanı yeterli mi? | Her 12 saat | 🔜 Planlanan | Alert |
| 8 | Express API çalışıyor mu? | Her 5 dk | 🔜 Planlanan | restart |

### 2.2 Health Check Endpoint (Express)

```javascript
app.get('/api/health', async (req, res) => {
    const health = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        bot: bot.telegram ? 'RUNNING' : 'DOWN',
        supabase: supabase ? 'CONNECTED' : 'DISCONNECTED',
        openai: openai ? 'CONFIGURED' : 'NOT_CONFIGURED',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 + ' MB',
        activeSessions: Object.keys(guestSessions).length,
        pendingTickets: Object.keys(pendingTickets).length,
        docsLoaded: Object.values(DOCS).filter(d => d.length > 0).length
    };
    res.json(health);
});
```

---

## 3. LOG YÖNETİMİ

### 3.1 Log Seviyeleri

| Seviye | Emoji | Kullanım | Örnek |
|---|---|---|---|
| INFO | 📨 | Normal işlem | `📨 [chatId] Müşteri: mesaj` |
| SUCCESS | ✅ | Başarılı işlem | `✅ [DOĞRULANDI] Misafir: X, Oda: Y` |
| WARNING | ⚠️ | Dikkat gereken | `⚠️ Dashboard API ulaşılamıyor` |
| ERROR | ❌ | Hata | `❌ [OPENAI] API hatası: rate_limit` |
| SECURITY | 🚫 | Güvenlik olayı | `🚫 [BLOCKED] chatId: X - bloke edildi` |
| HALÜSINASYON | 🛑 | AI hatası | `🛑 [HALÜSİNASYON] AI isim uydurdu` |

### 3.2 Log Dosya Yapısı

```
hotel_proje/
└── logs/
    ├── bot-out.log        # Genel bot çıktıları
    ├── bot-error.log      # Hata logları
    ├── sla-escalation.log # SLA eskalasyon logları
    └── security.log       # Güvenlik olayları
```

### 3.3 Log Rotasyonu
- Günlük log dosyaları 7 gün saklanır
- 7 günden eski loglar otomatik silinir veya sıkıştırılır
- Hata logları 30 gün saklanır

---

## 4. DEPLOY PROSEDÜRÜ

### 4.1 Pre-Deploy Kontrol Listesi

- [ ] Tüm test senaryoları başarılı (6.1 ve 6.2 - GELISTIRICI_KILAVUZU.md)
- [ ] `.env` dosyası güncel ve production değerleri doğru
- [ ] `.md` dosyaları ile kod arasında tutarsızlık yok
- [ ] `console.log` ifadeleri uygun (gereksiz debug kaldırıldı)
- [ ] Supabase tabloları güncel (migration çalıştırıldı)
- [ ] PM2 `ecosystem.config.js` doğru yapılandırılmış
- [ ] knowledge/ klasöründeki tüm dosyalar güncel
- [ ] README.md dokümantasyon haritası güncel

### 4.2 Deploy Adımları

```bash
# 1. Kod güncellemelerini çek
cd hotel_proje
git pull origin main

# 2. Bağımlılıkları güncelle (değişiklik varsa)
cd telegram-bot
npm install

# 3. Bot'u yeniden başlat
pm2 restart telegram-bot

# 4. Log kontrol
pm2 logs telegram-bot --lines 20

# 5. Sağlık kontrolü
curl http://localhost:3005/api/health
```

### 4.3 Rollback Prosedürü

```bash
# Sorun varsa önceki versiyona dön
git log --oneline -5    # Son 5 commit'i gör
git revert HEAD         # Son commit'i geri al
pm2 restart telegram-bot
```

---

## 5. VERİTABANI BAKIMI

### 5.1 Günlük Bakım Görevleri

| Görev | SQL | Otomatik? |
|---|---|---|
| Check-out geçmiş misafirleri temizle | `DELETE FROM in_house_guests WHERE check_out < CURRENT_DATE - 1` | 🔜 Planlanan |
| Eski session verilerini temizle | `DELETE FROM guest_memory WHERE last_interaction < NOW() - INTERVAL '7 days'` | 🔜 Planlanan |
| Eski mesajları arşivle | `DELETE FROM conversation_messages WHERE created_at < NOW() - INTERVAL '30 days'` | 🔜 Planlanan |

### 5.2 Haftalık Bakım

| Görev | Açıklama |
|---|---|
| İstatistik güncelle | `ANALYZE live_tickets; ANALYZE in_house_guests;` |
| İndex kontrol | Sorgu performansını izle |
| Disk kullanımı | Supabase storage kullanımını kontrol et |

---

## 6. ALERT VE BİLDİRİM SİSTEMİ

### 6.1 Alert Seviyeleri

| Seviye | Durum | Bildirim |
|---|---|---|
| 🔴 CRITICAL | Bot çöktü, Supabase DOWN | Anında SMS + Telegram |
| 🟡 WARNING | API rate limit, yüksek gecikme | Telegram bildirimi |
| 🟢 INFO | Deploy, restart, konfigürasyon değişikliği | Log kaydı |

### 6.2 Alert Alıcıları

| Rol | Alert Seviyesi |
|---|---|
| Sistem Yöneticisi (Admin) | 🔴 + 🟡 + 🟢 |
| Genel Müdür (GM) | 🔴 |
| Front Office Yöneticisi | 🔴 + 🟡 |

---

## 7. PERFORMANS OPTİMİZASYONU

### 7.1 Bot Performans Metrikleri

| Metrik | Hedef | İzleme |
|---|---|---|
| Bellek kullanımı | < 500 MB | PM2 |
| Yanıt süresi (AI) | < 3 saniye | Log analizi |
| Supabase sorgu süresi | < 200 ms | Log analizi |
| Concurrent session | < 1000 | guestSessions.length |

### 7.2 Optimizasyon Önerileri

1. **Prompt boyutunu kontrol et:** AI_RULES_FROM_DOCS substring limiti (3000 karakter)
2. **Session temizleme:** İnaktif session'ları periyodik temizle
3. **Supabase bağlantı havuzu:** Connection pooling aktif
4. **Resim/dosya cache:** hotel_harita.png'yi belleğe al

---

*Son güncelleme: 2026-04-09*
