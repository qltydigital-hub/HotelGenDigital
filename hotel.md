# Premium Otel Misafir Yazışma + Talep Otomasyonu (Windows)
**Teknik Tasarım + Ürün Gereksinimi (PRD) – v0.1**  
Tarih: **1 Mart 2026 (Europe/Istanbul)**

> Bu doküman, “Google Antigravity” ile agent-first geliştirme yaklaşımını kullanarak **Windows için** çok gelişmiş bir otel otomasyonu (misafir yazışma + talep yönetimi) geliştirmek isteyen ekipler için kapsamlı bir başlangıç çerçevesidir.

---

## İçindekiler
1. [Ürün Tanımı](#1-ürün-tanımı)  
2. [Hedefler](#2-hedefler-goals)  
3. [Kullanıcı Rolleri ve Yetkiler](#3-kullanıcı-rollerı-ve-yetkiler-rbac)  
4. [Kol-1: Çok Dilli Misafir İletişimi](#4-kanal-1-kol-1-çok-dilli-misafir-iletişimi)  
5. [Kol-2: Talep Yönetimi İş Akışı](#5-kanal-2-kol-2-talep-yönetimi--iş-akışı)  
6. [Sistem Mimarisi](#6-sistem-mimarisi-önerilen)  
7. [Veri Modeli](#7-veri-modeli-özet)  
8. [Excel Entegrasyonu ve Raporlama](#8-excel-entegrasyonu-ve-raporlama)  
9. [AI/Agent Tasarımı](#9-aia-agent-tasarımı-uygulama-içinde)  
10. [Windows UI (Ekranlar)](#10-windows-ui-ekranlar)  
11. [Güvenlik, KVKK/GDPR, Denetim](#11-güvenlik-kvkkgdpr-denetim)  
12. [Operasyonel Dayanıklılık](#12-operasyonel-dayanıklılık)  
13. [Antigravity ile Geliştirme Akışı](#13-antigravity-ile-geliştirme-akışı-pratik-rehber)  
14. [Test Planı](#14-test-planı-özet)  
15. [MVP Kapsam Önerisi](#15-mvp-kapsam-önerisi-ilk-sürüm)  
16. [Açık Noktalar](#16-açık-noktalar-sizden-gelen-bilgi-olmadan-varsayım-yaptıklarım)  
17. [Kaynaklar](#17-kaynaklar)

---

## 1) Ürün Tanımı

Bu sistem, oteldeki misafirlerden gelen tüm yazışmaları tek merkezde toplayan ve iki ana “kol” üzerinden yöneten **premium bir iletişim + talep otomasyonu**dur:

- **Kol-1: Çok dilli misafir iletişimi (bilgilendirme/sohbet)**
  - Misafir hangi dilde yazdıysa **aynı dilde** yanıt verir.
  - Otelin bilgi tabanı (check-in/out, kahvaltı saatleri, spa, Wi‑Fi, vb.) üzerinden doğru ve tutarlı bilgi sağlar.
  - Gerekirse resepsiyona yönlendirir.

- **Kol-2: Talep yönetimi (departman yönlendirme + eskalasyon + raporlama)**
  - Misafirin mesajı bir **talep** içeriyorsa (yastık, arıza, housekeeping, gastronomy vb.) talep akışına alınır.
  - Talebi ilerletmek için **kimlik/oda doğrulama** yapar:
    - Oda numarası + Ad Soyad yoksa, **oda numarası + soyadı** tekrar ister.
    - Hafızadaki önceki konuşmalar + (varsa) PMS verisi ile **slot doldurma** yapar (misafire aynı soruyu tekrar tekrar sormaz).
  - Talebi ilgili departmana iletir; ayrıca **resepsiyona bilgi amaçlı** kopyalar.
  - Departman yanıtlamaz/uygun değilse/zamanında görmezse resepsiyona **ACİL** bildirim düşer: “Departman yanıt vermedi, ilgilenin.”
  - Resepsiyon konuyu üstlenir, çözüm açıklaması yazar; bu kayıt **Excel’e** düşer.
  - Yönetici/GM/patron belirli tarih aralığı seçerek Excel’den rapor alır.

---

## 2) Hedefler (Goals)

1. Misafir mesajlarının %95+’ini **doğru dile** ve **doğru akışa** (Kol-1 / Kol-2) otomatik yönlendirmek.  
2. Talep akışında “oda+soyad” doğrulamasını standartlaştırmak; **veri eksikse otomatik tamamlatmak**.  
3. Departman SLA’larını görünür kılmak (yanıt/aksiyon süreleri) ve otomatik eskalasyon ile **kaçan talepleri** minimize etmek.  
4. Excel raporlamasını tek tuşla üretmek; tarih aralığı/filtreleme ile yönetici raporlarını kolaylaştırmak.  
5. KVKK/GDPR uyumlu veri işleme, loglama ve erişim kontrolü.

---

## 3) Kullanıcı Rollerı ve Yetkiler (RBAC)

- **Misafir (Guest)**: Mesaj gönderir, yanıt alır, talep açar, talep durumunu görür.
- **Resepsiyon (Front Office)**: Tüm talepleri görür; eskalasyonları alır; çözüm notu girer; gerektiğinde talebi devralır.
- **Departman Personeli (HK/Tech/F&B/Spa/IT vb.)**: Kendi departman kuyruğunu görür; “Aldım/İşlemde/Tamamlandı” statüsü verir; not girer.
- **Yönetici (Manager/GM/Owner)**: Raporlar, SLA metrikleri, trendler, performans dashboard’u; yetkiyle tüm kayıtları görür.
- **Sistem Yöneticisi (Admin)**: Entegrasyonlar, ayarlar, yetkiler, şablonlar, bilgi tabanı yönetimi.

---

## 4) Kanal-1 (Kol-1): Çok Dilli Misafir İletişimi

### 4.1 Dil Algılama ve Yanıt
- Her mesaj için:
  - `language = detect(message_text)`  
  - Yanıt dili: **language**
- “Hotel tone of voice” (premium, nazik, kısa, net) ve otelin hazır şablonları uygulanır.

### 4.2 Bilgi Tabanı (Hotel Knowledge Base)
- SSS (FAQ), hizmet saatleri, politika, menüler, acil durum prosedürü, konum bilgisi.
- Kaynaklar:
  - Otel dokümanları (PDF/Word), web sayfası, iç prosedürler.
- Yanıt üretimi:
  - “Retrieve-then-generate”: önce ilgili bilgi çekilir, sonra cevap yazılır.
  - Halüsinasyonu azaltmak için: “Emin değilse resepsiyona yönlendir.”

### 4.3 Kol-1 Örnek Akış
**Misafir (EN):** “What time is breakfast?”  
**Sistem:** Breakfast hours + yer + rezervasyon gereksinimi + kısa ek yardım.

---

## 5) Kanal-2 (Kol-2): Talep Yönetimi – İş Akışı

### 5.1 Talep Tespiti (Classification)
Mesaj şu kategorilerden birine atanır:

- `INFO/CHAT` → Kol‑1
- `REQUEST` → Kol‑2
- `COMPLAINT` → Kol‑2 (departmana + resepsiyon)
- `EMERGENCY` → Kol‑2 (anında resepsiyon + güvenlik)

Önerilen yaklaşım:
- İlk katman: kural tabanlı anahtar kelimeler (arıza, bozuk, yastık, towel, broken…)
- İkinci katman: LLM tabanlı sınıflandırma (çok dilli + bağlam duyarlı)

### 5.2 Slot Doldurma (Oda/İsim Doğrulama)
**Zorunlu minimum:**  
- `room_number`
- `last_name` (veya tam ad soyad)

**Slot doldurma kaynakları:**
1. Aynı konuşma thread’inde daha önce verilmiş bilgi (hafıza)
2. PMS entegrasyonu (varsa): telefon/e‑posta/rezervasyon eşleştirme
3. Misafire kısa soru: “Oda numaranızı ve soyadınızı paylaşır mısınız?”

> “Kullanıcı ailesinden analiz” pratik yorum: Aynı oda numarası ile birden fazla misafir olabilir. PMS’ten “room occupancy / guest list” çekilebiliyorsa, soyadı doğrulaması + konuşma geçmişi ile doğru kişiyi bağlamak mümkündür. Aksi durumda, minimum doğrulama sorusu sorulur.

### 5.3 Departman Yönlendirme (Routing)
Talep türü → departman:

- Yastık/havlu/temizlik → **Housekeeping**
- Klima/TV/elektrik/su/kapı kilidi → **Technical Service**
- Yiyecek‑içecek/oda servisi/restoran rezervasyonu → **Gastronomy (F&B)**
- Wi‑Fi/TV kanal/uygulama sorunları → **IT**
- Gürültü/şüpheli durum → **Security**
- Belirsiz → Resepsiyon triage

### 5.4 Bildirim Kuralları
- Departmana iletildiğinde: **departman kanalı + resepsiyon bilgilendirme**
- Departman:
  - “Aldım (ACK)” verirse: resepsiyon “takipte” görür.
  - Belirlenen süre içinde yanıt yoksa: resepsiyona **ACİL eskalasyon**.

### 5.5 Eskalasyon Mantığı (SLA)
Örnek SLA (oteliniz belirler):
- Teknik acil: ACK 3 dk / çözüm 30 dk
- Housekeeping: ACK 5 dk / çözüm 45 dk
- F&B: ACK 5 dk / çözüm 30 dk

**Eskalasyon kuralı:**
- `now - request.created_at > ACK_SLA` ve `request.status in [NEW, SENT_TO_DEPT]` ise  
  → `reception_alert = "Departman yanıt vermedi, ilgilenin"`

### 5.6 Resepsiyon Devralma ve Çözüm Notu
- Resepsiyon, talebi “DEVRALDI” yapabilir.
- Çözüm açıklaması zorunlu alan:
  - “Ne yapıldı?”
  - “Ne zaman yapıldı?”
  - “Kim yaptı?”
- Bu açıklama **Excel log’una** yazılır.

---

## 6) Sistem Mimarisi (Önerilen)

### 6.1 Yüksek Seviye Bileşenler
**(A) Windows Uygulaması (Staff Console)**
- WinUI 3 veya WPF (.NET 8)
- Modüller:
  - Inbox (tüm konuşmalar)
  - Talep Kuyrukları (departman bazlı)
  - Resepsiyon Eskalasyon Paneli
  - Raporlar (tarih aralığı → Excel)
  - Ayarlar / Şablonlar / Bilgi Tabanı

**(B) Backend API (Hotel Automation Server)**
- ASP.NET Core Web API
- Auth/RBAC
- Konuşma & talep veritabanı
- Entegrasyon servisleri

**(C) AI Orkestrasyon Servisi**
- Router (Kol-1/Kol-2)
- Dil algılama + özetleme
- Talep çıkarımı (intent + entity extraction)
- Yanıt üretimi (guest-facing)

**(D) Mesajlaşma Entegrasyon Katmanı**
- WhatsApp/SMS/Email/Chat widget (otelinizin kullandığı sağlayıcıya göre)
- Departman bildirim kanalları:
  - Microsoft Teams / Slack / Email / Dahili panel

**(E) Raporlama & Excel Servisi**
- Excel’e yazma (append) + export üretimi

### 6.2 Neden Kuyruk (Queue) Önerilir?
Departmanlara iletim ve eskalasyon kritik olduğu için:
- Mesaj kaybını önlemek
- Retry/backoff yapmak
- “En az bir kez” teslimat sağlamak  
için RabbitMQ / Azure Service Bus / Kafka gibi bir kuyruk kullanmak iyi pratiktir.

---

## 7) Veri Modeli (Özet)

### 7.1 Temel Tablolar
- `Guests`
  - `guest_id`, `first_name`, `last_name`, `phone`, `email`, `language_pref`
- `Rooms`
  - `room_number`, `pms_room_id`, `status`
- `Conversations`
  - `conversation_id`, `channel`, `guest_id?`, `room_number?`, `created_at`
- `Messages`
  - `message_id`, `conversation_id`, `sender_type` (guest/staff/system), `language`, `text`, `created_at`
- `Requests`
  - `request_id`, `conversation_id`, `room_number`, `last_name`, `category`, `department`, `priority`
  - `status` (NEW, NEEDS_INFO, SENT_TO_DEPT, ACKED, IN_PROGRESS, DONE, ESCALATED, CANCELLED)
  - `created_at`, `acked_at?`, `done_at?`
- `RequestEvents` (audit trail)
  - `event_id`, `request_id`, `event_type`, `payload_json`, `created_at`, `actor`
- `Notifications`
  - `notification_id`, `request_id`, `target` (dept/reception), `channel`, `status`, `sent_at`

### 7.2 Hafıza (Memory) Tasarımı
- “Konuşma hafızası” = son N mesajın özeti + doğrulanmış slotlar:
  - `room_number`, `last_name`, `preferences` (yastık tipi vb.)
- Kural: Kişisel veri saklama süreleri + maskeleme.

---

## 8) Excel Entegrasyonu ve Raporlama

### 8.1 Excel’e Yazılacak Kolonlar (Öneri)
`RequestsLog.xlsx` (tek dosya veya aylık dosyalar)

- `RequestId`
- `CreatedAt`
- `Channel` (WhatsApp/Email/InApp)
- `RoomNumber`
- `LastName`
- `Language`
- `Category`
- `Department`
- `Priority`
- `Status`
- `AckedAt`
- `DoneAt`
- `FirstResponseMinutes`
- `ResolutionMinutes`
- `ReceptionOwner` (devraldıysa)
- `DepartmentOwner`
- `ReceptionNote` (çözüm açıklaması)
- `DepartmentNote`
- `Tags` (VIP, complaint, repeat issue)
- `ExportedAt`

> Öneri: Excel’i “tek kaynak” yapmak yerine **DB’yi tek kaynak**, Excel’i “çıktı/rapor” olarak konumlandırın. Böylece bozulma/çakışma riskleri azalır.

### 8.2 Yönetici Raporu (Tarih Aralığı)
- UI’da tarih aralığı seç:
  - Başlangıç: `from`
  - Bitiş: `to`
- Filtreler:
  - Departman, kategori, öncelik, oda, VIP
- Çıktı:
  - Excel export
  - Özet KPI sayfası (pivot):
    - Talep adedi (dept bazlı)
    - Ortalama ilk yanıt süresi
    - Ortalama çözüm süresi
    - SLA ihlali sayısı
    - En çok tekrar eden konu

---

## 9) AI/Agent Tasarımı (Uygulama İçinde)

### 9.1 Agent’lar
1. **RouterAgent**
   - Girdi: misafir mesajı
   - Çıktı: `intent_class`, `language`, `urgency`, `needs_human?`

2. **GuestReplyAgent (Kol-1)**
   - Bilgi tabanından içerik çeker, aynı dilde cevap yazar.

3. **RequestAgent (Kol-2)**
   - `request_category`, `department`, `priority`
   - Slot doldurma: `room_number`, `last_name`
   - Departmana “ticket” oluşturur, resepsiyona CC geçer.

4. **EscalationAgent**
   - SLA timer; departman ACK yoksa resepsiyona acil.

5. **SummarizerAgent**
   - Uzun konuşmaları resepsiyon ekranında 3 satır özetler.

### 9.2 Prompt/Policy İlkeleri
- **Aynı dilde yanıt** (guest-facing).
- **Kesin bilgi yoksa uydurma yok** → resepsiyona yönlendirme.
- Kişisel veri maskesi: “telefon/e-posta” loglarda kısmi.
- “Acil durum” anahtar kelime/pattern seti ile direkt resepsiyon + güvenlik.

---

## 10) Windows UI (Ekranlar)

### 10.1 Resepsiyon Paneli
- “Acil” sekmesi (eskalasyonlar)
- “Yeni talepler”
- “Benim üzerimde”
- Talep detay kartı:
  - Oda/soyad/dil
  - Mesaj geçmişi (özet + tam görüntü)
  - Durum değiştir
  - Çözüm notu (zorunlu)
  - “Excel’e yaz” (otomatik de olabilir)

### 10.2 Departman Paneli
- Kendi kuyruğu
- “Aldım” (ACK) butonu
- Durum + not + foto (opsiyonel)

### 10.3 Konuşmalar (Inbox)
- Tüm kanallar birleşik görünüm
- Etiketleme (VIP / complaint / repeat)

### 10.4 Raporlar
- Tarih aralığı seç
- Filtre seç
- “Excel oluştur” + indir / paylaşım klasörüne kaydet

---

## 11) Güvenlik, KVKK/GDPR, Denetim

- RBAC + audit log
- Hassas veri şifreleme (at rest + in transit)
- Log maskeleme
- Veri saklama politikası:
  - Mesaj içeriği: X gün
  - Talep kayıtları: Y ay/yıl (otel politikası)
- Admin işlemleri: “kim, neyi, ne zaman değiştirdi?”

---

## 12) Operasyonel Dayanıklılık

- Retry mekanizması (departman bildirimi başarısızsa)
- Offline senaryosu:
  - Windows client cache + tekrar gönderim
- İzleme:
  - SLA ihlali metriği
  - “Departman cevaplamadı” sayacı
- Yedekleme:
  - DB yedeği
  - Excel dosyalarının versiyonlanması

---

## 13) Antigravity ile Geliştirme Akışı (Pratik Rehber)

Bu bölüm, Antigravity’yi “geliştirme sürecini hızlandıran agent-first bir ortam” gibi konumlayarak pratik bir iş bölümü önerir. **Güncel özellikler için resmi dokümantasyonu baz alın.**

### 13.1 Proje İçin Önerilen Antigravity Düzeni
- 1 agent: **PM/Analyst** → PRD, acceptance criteria, kullanıcı senaryoları
- 1 agent: **Backend** → ASP.NET API, DB şema, queue
- 1 agent: **Windows UI** → WinUI/WPF ekranları
- 1 agent: **QA** → test senaryoları, edge-case listesi

### 13.2 “Skill” Mantığı ile Kuralları Paketleme (Opsiyonel)
- `hotel-domain-glossary` (departman adları, kategori sözlüğü)
- `excel-export-standards` (kolon isimleri, tarih formatı)
- `kvkk-logging-policy` (masking kuralları)
- `ui-style-guide` (premium UI yönergeleri)

### 13.3 Güvenli Çalışma Ayarları
- Terminal execution: “Request review”
- Riskli komut denylist
- Browser allowlist (dokümantasyon siteleri vs.)

---

## 14) Test Planı (Özet)

### 14.1 Fonksiyonel Testler
- TR/EN/DE/AR/RU mesajları → doğru dilde yanıt
- “Yastık istiyorum” → HK talebi + oda/soyad yoksa sor
- Oda+soyad alındı → departmana ilet + resepsiyon CC
- Departman ACK yok → X dk sonra resepsiyona acil
- Resepsiyon çözüm notu → Excel satırı oluştu

### 14.2 Edge Case
- Misafir oda numarasını yanlış yazdı
- Aynı odadan iki kişi yazıyor (soyad farklı)
- Mesaj hem bilgi hem talep içeriyor (“Spa saatleri nedir + 2 havlu gönderin”)
- Acil durum ifadeleri → güvenlik protokolü

---

## 15) MVP Kapsam Önerisi (İlk Sürüm)

### MVP-1
- Tek kanal (ör. WhatsApp veya In‑App Chat)
- Kol‑1 + Kol‑2 temel sınıflandırma
- Oda+soyad doğrulama
- 3 departman (HK/Tech/F&B)
- Eskalasyon (ACK SLA)
- Excel log + tarih aralığı export

### MVP-2
- PMS entegrasyonu
- Çoklu kanal
- Yönetici dashboard + pivot raporlar
- VIP/sentiment/complaint otomasyonları

---

## 16) Açık Noktalar (Sizden Gelen Bilgi Olmadan Varsayım Yaptıklarım)
- Misafir mesajları hangi kanaldan gelecek? (WhatsApp/Email/SMS/In‑App)
- Departmanlar hangi araçla bildirilecek? (Teams/Slack/Email/Panel)
- PMS var mı? Varsa hangisi? (Opera/Protel/ElektraWeb vb.)
- Eskalasyon süreleri ve öncelik kuralları (SLA tabloları)

---

## 17) Kaynaklar
- Antigravity genel: https://developers.googleblog.com/  
- Antigravity codelab: https://codelabs.developers.google.com/

---
