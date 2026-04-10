# 🚨 HATA SENARYOLARI VE KURTARMA PROSEDÜRLERI (ERROR SCENARIOS)

Bu belge, sistemde oluşabilecek **tüm hata senaryolarını**, her birinin **kök nedenini**, **AI'ın davranışını** ve **kurtarma prosedürünü** tanımlar.

> ⚠️ **KRİTİK:** Bu dosya AI prompt'una dahil edilir. Bot hangi hata durumunda nasıl tepki vereceğini buradan öğrenir.

---

## 1. AI HALÜSİNASYON HATALARI

### 1.1 İsim Uydurma Hatası (ZERO TOLERANCE)

**Tanım:** AI, misafirin adını bilmeden "Ahmet Bey", "Mehmet Hanım" gibi uydurma isimler kullanması.

| Özellik | Değer |
|---|---|
| **Kök Neden** | AI modeli, bağlamdan tahmin yaparak isim uyduruyor |
| **Tespit Yöntemi** | Post-processing regex kontrolü (genericNames pattern) |
| **Önlem** | temperature: 0.0 + explicit prompt kuralları + regex filtre |
| **Kurtarma** | Uydurma isim tespit edilirse "Sayın Misafirimiz" ile değiştirilir |

**Engelleme Katmanları:**
1. **Prompt Katmanı:** "ASLA isim kullanma" kuralı
2. **Post-Processing:** Regex ile yaygın isim kalıplarını yakalama
3. **Extraction Guard:** extractGuestInfo sonucunun orijinal mesajda geçip geçmediğini kontrol

### 1.2 Sahte Onay Hatası (FALSE CONFIRMATION)

**Tanım:** AI, doğrulama yapılmadan "talebiniz iletildi" demesi.

| Özellik | Değer |
|---|---|
| **Kök Neden** | AI'ın talep akışını yanlış anlaması, boşta onay üretmesi |
| **Tespit Yöntemi** | isRequest: true olduğunda replyToUser içinde "iletildi/gönderildi" aranması |
| **Önlem** | Prompt'ta "ASLA talebiniz iletildi deme" kuralı |
| **Kurtarma** | Sahte onay yakalanırsa genel mesajla değiştirilir |

**Post-Processing Kontrolü:**
```javascript
// AI isRequest: true döndürüp "iletildi" diyorsa → düzelt
if (parsed.isRequest && /iletti|gönder|yolla/i.test(parsed.replyToUser)) {
    parsed.replyToUser = "Talebinizi aldım, bilgilerinizi doğruladıktan sonra hemen ileteceğim. 🙏";
    console.warn('⚠️ [FALSE_CONFIRM_BLOCKED] AI sahte onay verdi, düzeltildi.');
}
```

### 1.3 Oda Numarası Uydurma Hatası

**Tanım:** AI, mesajda geçmeyen bir oda numarasını uydurması.

| Özellik | Değer |
|---|---|
| **Kök Neden** | extractGuestInfo model halüsinasyonu |
| **Tespit Yöntemi** | Çıkarılan room değerinin orijinal mesajda geçip geçmediği kontrol |
| **Önlem** | temperature: 0.0 + regex doğrulaması |
| **Kurtarma** | Doğrulama reddedilir, misafirden tekrar bilgi istenir |

---

## 2. VERİTABANI HATALARI

### 2.1 Supabase Bağlantı Hatası

**Tanım:** Supabase'e erişilemiyor (ağ sorunu, servis kesintisi).

| Özellik | Değer |
|---|---|
| **Kök Neden** | Network timeout, Supabase servis arızası |
| **Tespit Yöntemi** | `supabase === null` veya query error |
| **AI Davranışı** | Talep ALINAMAZ |
| **Misafire Yanıt** | "Şu an teknik bir aksaklık yaşıyoruz, lütfen resepsiyonumuzu arayın: 📞 +90 242 824 00 00" |
| **Log** | `[SUPABASE_CONNECTION_ERROR] timestamp, error_message` |

### 2.2 In-House Tablosu Boş/Yok

**Tanım:** `in_house_guests` tablosu boş veya Excel yüklemesi yapılmamış.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Front Office Excel yüklememiş veya tablo silinmiş |
| **Tespit Yöntemi** | SELECT COUNT(*) FROM in_house_guests = 0 |
| **AI Davranışı** | Doğrulama yapılamaz, talep işlenemez |
| **Misafire Yanıt** | "Sistemimizde şu an bir güncelleme yapılmaktadır. Lütfen birkaç dakika sonra tekrar deneyin veya resepsiyonumuzu arayın." |
| **Aksiyon** | Yöneticiye alert gönder |

### 2.3 Çift Kayıt (Duplicate Guest)

**Tanım:** Aynı oda numarasında birden fazla misafir kaydı.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Aile konaklaması veya Excel yükleme hatası |
| **Tespit Yöntemi** | Sorgu birden fazla sonuç döndürür |
| **AI Davranışı** | İLK eşleşen kaydı kullan |
| **Kurtarma** | Soyadı ile ek filtreleme yap |

---

## 3. API HATALARI

### 3.1 OpenAI API Hatası

**Tanım:** OpenAI API'ye ulaşılamıyor veya rate limit aşıldı.

| Özellik | Değer |
|---|---|
| **Kök Neden** | API anahtarı geçersiz, bakiye bitmiş, rate limit |
| **HTTP Kod** | 401, 429, 500, 503 |
| **Misafire Yanıt** | "Şu an teknik bir aksaklık yaşıyoruz, lütfen resepsiyonumuzu arayın: 📞 +90 242 824 00 00" |
| **Kurtarma** | Otomatik retry (max 2 deneme), ardından fallback mesajı |
| **Log** | `[OPENAI_API_ERROR] status_code, error_message` |

### 3.2 Telegram API Hatası

**Tanım:** Telegram bot API'sine mesaj gönderilemedi.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Bot token geçersiz, kullanıcı botu engellemiş, ağ hatası |
| **HTTP Kod** | 403 (blocked by user), 429 (too many requests) |
| **Kurtarma** | 403 → kullanıcıyı pasif işaretle; 429 → exponential backoff |
| **Log** | `[TELEGRAM_SEND_ERROR] chatId, error_code, error_message` |

### 3.3 Departmana Mesaj Gönderilemedi

**Tanım:** Departman yetkilisine talep mesajı iletilemedi.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Yetkili botu engellemiş, chat ID hatalı |
| **AI Davranışı** | Misafire "talebiniz alındı" denir, ama departmana ulaşılamadı |
| **Kurtarma** | .env fallback ID dene → hala başarısızsa resepsiyon CC'ye eskalasyon |
| **Log** | `[DEPT_DELIVERY_FAILED] department, contact_id, error` |

---

## 4. SESSION (OTURUM) HATALARI

### 4.1 Session Sıfırlanması (Bot Restart)

**Tanım:** Bot yeniden başlatıldığında tüm RAM oturumları kaybolur.

| Özellik | Değer |
|---|---|
| **Kök Neden** | PM2 restart, deploy, crash |
| **Etki** | Tüm doğrulanmış misafirler tekrar doğrulama yapmak zorunda |
| **Önlem** | Supabase'e session kaydetme (guest_memory tablosu) |
| **Kurtarma** | Misafir yeni mesaj gönderdiğinde doğrulama akışı başlar |

### 4.2 Session Çakışması (Blocked + Yeni Talep)

**Tanım:** Bloke edilmiş session'dan yeni talep geldiğinde.

| Özellik | Değer |
|---|---|
| **Kök Neden** | 3 başarısız doğrulama sonrası bloke |
| **AI Davranışı** | Bilgi soruları yanıtlanır, talepler resepsiyona yönlendirilir |
| **Kurtarma** | /start komutu ile session sıfırlanır |
| **Süre** | 30 dakika sonra otomatik bloke kaldırma |

### 4.3 Cross-Session Bilgi Sızıntısı

**Tanım:** Bir misafirin bilgisinin başka bir misafir için kullanılması.

| Özellik | Değer |
|---|---|
| **Kök Neden** | chatId bazlı ayrımın bozulması (çok nadir) |
| **Önlem** | Her chatId için tamamen bağımsız session objesi |
| **Tespit** | Log'da farklı chatId'lerin aynı oda numarasıyla işlem yapması |
| **Kurtarma** | Session'ları sıfırla, güvenlik logu oluştur |

---

## 5. SLA VE ESKALASYON HATALARI

### 5.1 SLA Timer Çalışmıyor

**Tanım:** SLA zamanlayıcısı başlatılmadı veya çalışmıyor.

| Özellik | Değer |
|---|---|
| **Kök Neden** | setTimeout bozuk, bot restart sırasında timer kaybolması |
| **Tespit** | Supabase'de OPEN statüsünde SLA süresi geçmiş ticket'lar |
| **Kurtarma** | Periyodik DB tarama ile "geçmiş SLA" ticket'larını tespit + eskalasyon |

### 5.2 Eskalasyon Mesajı Gönderilemedi

**Tanım:** Resepsiyona eskalasyon bildirimi ulaşmadı.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Resepsiyon chat ID hatalı, telegram API hatası |
| **Kurtarma** | .env fallback, son çare: yöneticiye bildirim |
| **Log** | `[ESCALATION_FAILED] ticketId, target, error` |

---

## 6. WEBHOOK VE ENTEGRASYON HATALARI

### 6.1 Instagram Webhook Payload Eksik

**Tanım:** ManyChat/n8n'den gelen payload'da zorunlu alanlar eksik.

| Özellik | Değer |
|---|---|
| **Zorunlu Alanlar** | `text`, `contact_id` |
| **Opsiyonel** | `full_name`, `room_number`, `platform` |
| **Kurtarma** | 400 Bad Request döndür, eksik alan belirt |

### 6.2 Dashboard API Ulaşılamıyor

**Tanım:** Next.js dashboard API'sine mesaj kaydedilemedi.

| Özellik | Değer |
|---|---|
| **Kök Neden** | Dashboard kapalı, port çakışması, ağ hatası |
| **Etki** | Mesaj geçmişi dashboard'da görünmez (bot çalışmaya devam eder) |
| **AI Davranışı** | Bot ÇALIŞMAYA DEVAM EDER (non-blocking) |
| **Log** | `Dashboard API ulaşılamıyor (Timeout)` |

---

## 7. HATA ÖNCELİK MATRİSİ

| Öncelik | Hata Türü | Etki | Otomatik Kurtarma |
|---|---|---|---|
| 🔴 P0 | Supabase DOWN | TÜM talepler durur | Misafiri resepsiyona yönlendir |
| 🔴 P0 | OpenAI DOWN | BOT yanıt veremez | Fallback mesajı + resepsiyon |
| 🟡 P1 | In-House tablosu boş | Doğrulama yapılamaz | Alert + resepsiyona yönlendir |
| 🟡 P1 | Dept mesaj gönderilemedi | SLA tetiklenmez | Fallback ID + eskalasyon |
| 🟢 P2 | Dashboard API DOWN | Mesaj kaydedilmez | Non-blocking, log yaz |
| 🟢 P2 | Session sıfırlanma | Tekrar doğrulama gerekir | Normal akış devam eder |

---

*Bu belge, tüm hata durumlarının sıfır hata payı ile yönetilmesini sağlar.*
*Son güncelleme: 2026-04-09*
