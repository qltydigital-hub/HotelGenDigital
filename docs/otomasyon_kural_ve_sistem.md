# HotelGen — Otomasyon Kural ve Sistem Dokümanı

> Tek kaynak (single source of truth). Antigravity, Supabase, Vercel ve GitHub akışı bu dosyayı referans alır. Çelişki olursa bu dosya geçerlidir.

---

## 0. GENEL PRENSİPLER (TÜM SİSTEM İÇİN GEÇERLİ)

1. **Dil Kuralı:** Misafir hangi dilde yazarsa sistem **aynı dilde** cevap verir. Aksi belirtilmedikçe dil değiştirilmez.
2. **Kanal Bağımsızlığı:** WhatsApp, Instagram, Telegram — hangi kanaldan gelirse aynı kurallar geçerlidir.
3. **Sallama Yasağı:** Emin olunmayan hiçbir bilgi verilmez. Bilinmeyen sorularda kibarca "Google'dan veya [ilgili site] üzerinden bakabilirsiniz" denir.
4. **Kaynak Hiyerarşisi (bilgi çekme sırası):**
   1. Otelin Supabase'e yüklediği belgeler (fact sheet, konsept, fiyat, menü vb.)
   2. Perplexity / web araştırması (genel/çevre/güncel bilgiler için)
   3. Hiçbiri yetmiyorsa → kibar yönlendirme
5. **Yazım/Şive Toleransı:** Yazım hataları ve şive farkları olabildiğince anlaşılmaya çalışılır. Tam emin olunamazsa: *"Bunu mu demek istediniz? Sizi tam anlayamadım."*
6. **Sesli & Görsel Giriş:** Sesli mesajlar metne çevrilir, sonra işlenir. Görseller (özellikle teknik servis için) analiz edilir.
7. **Oturum Güvenliği:** Tüm panel hesaplarında 5 dakika işlem yoksa otomatik logout.
8. **Veri Saklama:** Misafir check-out yaptıktan sonra hafızada tutulmaz; sadece raporlama için Supabase'te kalır.

---

## 1. MİSAFİR İLE İLETİŞİM KISIMLARI

### 1.1. Bilgi Verme (Sohbet) Modu
Sistem şu konularda otelin yüklediği belgelere bakarak cevap verir:
- Otel genel bilgisi, konsept, oda kategorileri
- Bölge, çevre, gezilecek yerler
- Yiyecek & içecek, eğlence, animasyon
- Evcil hayvan kuralları
- Periyodik fiyat bilgisi (ön büronun yüklediği)
- Tatil ile ilgili genel sorular

Alakasız sorular (döviz kuru, altın fiyatı vb.) → Perplexity/web ile araştır, bulamazsan kibarca yönlendir.

### 1.2. KESİN KURALLAR (Asla esnetilmez)
- **Geç çıkış (late check-out):** Otelin belirttiği saat söylenir + **"Kesin onay için resepsiyondan teyit almanız gereklidir"** uyarısı zorunlu.
- **Çocuk yaş/ücret:** Sadece rezervasyon ve konsept belgelerinde yazan bilgi verilir. Israr edilse bile dışına çıkılmaz.
- **Standart rezervasyon bilgisi dışına çıkılmaz.**

---

## 2. TALEP YÖNETİMİ (İstek/Şikayet)

### 2.1. Zorunlu Alanlar
Bir talep işleme alınmadan önce 3 alan zorunlu:
1. **Talep** (ne istendiği)
2. **Oda Numarası**
3. **İsim Soyisim**

Eksik olan varsa sistem misafirin dilinde sırayla sorar.

### 2.2. Doğrulama Akışı
1. Bilgiler alınır → Supabase **in-house listesi** ile eşleştirilir.
2. **Eşleşme varsa:** Misafire kendi dilinde "Talebinizi ilgili departmana iletiyorum" denir.
3. **Eşleşme yoksa:** Resepsiyona anında bildirim gider. Resepsiyon panelindeki **R/C bölümünden** düzeltme yapar (örn. oda değişikliği) → Supabase anında güncellenir.

### 2.3. Departmana İletim
- Talep ilgili departman sorumlusunun WhatsApp/Telegram ID'sine düşer.
- **Departmana her zaman Türkçe çevirilir** (misafir hangi dilde yazmış olursa olsun).
- Departman 2 butondan birini seçer:
  1. ✅ Talebinizi aldık, **hemen** ilgileniyoruz
  2. ⏳ Talebinizi aldık, **birazdan** ilgileniyoruz

### 2.4. SLA (Cevap Süresi) Kontrolü
- Her departmanın SLA süresi panelden manuel ayarlanır (3/5/10 dk vb.).
- Talep düşer düşmez geri sayım başlar.
- Süre dolar ve cevap gelmezse → **resepsiyona eskalasyon bildirimi** düşer.
- Resepsiyon **zorunlu açıklama yazar** (boş geçilemez, uyarı metni çıkar).
- Açıklama Supabase'e kaydedilir, yönetici raporlarında görünür.

### 2.5. Departman Çalışma Saatleri
- Her departmanın çalışma saat/günü panelden ayarlanır (örn. Guest Relation 08:00–16:00 / 16:00–24:00).
- Mesai dışında talep gelirse → sebep belirtilerek resepsiyona düşer.

### 2.6. Süre Raporlaması (ZORUNLU)
Her talep için kaydedilir:
- Talep zamanı (tarih + saat + dakika)
- Departman cevap zamanı
- Çözüm zamanı
- **Aradaki süre farkı** (dakika bazında)

Örnek rapor: *"101 nolu odadan 14:23'te havlu talebi geldi. Housekeeping 7 dakikada yanıtladı, çözüldü."*

---

## 3. VIP YÖNETİCİ RAPORLAMA

- VIP yöneticiler sesli veya yazılı tarih aralığı verir → Sistem Supabase'ten rapor çeker.
- Tarih aralığı belirtilmezse sistem sorar.
- Yönetici WhatsApp/Telegram ID'leri her otelin kendi panelinden eklenir.

---

## 4. PANEL YAPISI

### 4.1. Giriş Ekranı
- 6–7 bölümlük tanıtım slider'ı
- **Sisteme Giriş** + **VIP Yönetici Giriş** butonları
- Hotel Sistem Ayarları & VIP Yönetici Giriş şifre korumalı

### 4.2. VIP Yönetici Paneli
**En üst yetki:** Özgür ÖZEN & Kemal KUYUCU

İki ana buton:

#### A) Master Hub
- Yeni otel açma & paket atama
- **Paket 1:** Talep yönetimi YOK (sadece bilgi/sohbet). Departman ID girilmez.
- **Paket 2 (Full):** Tüm özellikler aktif.
- Paket özellikleri tek tek açılıp kapatılabilir.
- Toplam otel sayısı + toplam ciro ($) gösterimi
- Anlaşma süresi gösterimi (örn. "A oteli – 12 Ay")
- Yeni otel açıldığında: kendi Supabase + ManyChat hesabı bağlanır.

#### B) Hotel Sistem Ayarları
- HotelGen Digital Resort Yönetim Paneli
- Ajans SaaS Veritabanı Simülasyonu
- "Giriş Yapan Otel" dropdown → seçilen otelin: Adı, İletişim, Adres, Genel Kurallar, Ekstra Bilgi
- **Hızlı Departman Erişimi** → seçilen otelin departmanlarına direkt geçiş

### 4.3. Departman Sorumlu Yönetimi
Her departman için **çoklu sorumlu** eklenebilir (WhatsApp / Telegram ID):
- Resepsiyon (Ön Büro)
- Misafir İlişkileri (Guest Relation)
- Kat Hizmetleri (Housekeeping)
- Yiyecek & İçecek (F&B)
- Teknik Servis

Her departman için: **Çalışma Düzeni** + **SLA Süresi (dk)**

---

## 5. DEPARTMAN PANELLERİ

### 5.1. ÖN BÜRO (Resepsiyon)

#### In-House Listesi
- Excel sürükle-bırak yükleme → Supabase'e kayıt
- Filtrelenen alanlar: Oda No, İsim Soyisim, Acente, Voucher, Kişi Sayısı, Giriş/Çıkış Tarihi
- "Son yüklenen liste" dropdown
- **Çıkış filtresi:** Bugün / Yarın / Tarih aralığı
- **Otomatik çıkış mesajı:** Çıkış yapacak misafirlere otelin belirlediği saatte uygun mesaj
- **Geç çıkış seçimi:** Checkbox ile seçilen odalara "Seçili Odaya Çıkış Mesajı Gönder"

#### R/C Bölümü ⚠️ (KRİTİK – EKLENECEK)
- Resepsiyon, in-house ile uyuşmayan talepleri düzeltir
- "Bu kişi şu numaralı odada kalıyor" yazıp gönderir → Supabase anında güncellenir

#### Direkt Rezervasyon / IBAN
- Manuel IBAN girişi
- Görsel/PDF/JPEG yükleme
- Excel yükleme (sürükle-bırak)
- Otelin kendi DB'sinde saklanır

#### İnsan Müdahalesi Eskalasyon
- Acil bildirim e-posta + WhatsApp/Telegram ID
- Kritik kelime tespiti: *"haram", "beni arayın", "şikayet", "iade", "berbat"* vb.
- Tespit edilirse → tanımlı yetkiliye anında bildirim

#### Dosya Yükleme Alanları (PDF/Word/Excel)
- Konsept dosyası
- Fact Sheet
- Fiyat listesi
- Day-Use fiyat & aralık
- Otel krokisi & harita
- Rezervasyon & acente linkleri

> Her dosyanın altında **yüklenme tarihi** görünür.

#### Dijital Asistan Karşılama
- Otel krokisi teklifi
- 7/24 hizmet modu
- Bölge & tesis tanımı

---

### 5.2. F&B (Yiyecek & İçecek)
- Bar menüsü Excel yükleme (içki çeşitleri vb. sorulara cevap için)
- Room Service & Minibar listesi (yükleme tarihi + format belirtimi)
- Room Service istek listesi → Supabase tablosu: `fb_room_service_requests`
- Çalışma saatleri **fact sheet'ten çekilir** (mükerrer giriş engellenir)

---

### 5.3. HOUSEKEEPING (HK)
- **Günlük DND Listesi:** Excel/PDF toplu yükleme veya manuel giriş
- "Kaydet ve Onayla" → Supabase
- **DND Yanıt Mantığı:**
  - Mesai içi: *"Bugün odanızda DND kartı asılıydı, ekibimiz giremedi. Çalışma saatleri içinde (örn. 08:00–16:00 / 16:00–24:00) bize bildirebilirsiniz."*
  - Mesai dışı: *"Bugün DND nedeniyle giriş yapılamamış. Yarın sabah ilk iş ileteceğim."*
- Oda Temizlik Standartları & Periyotları (havlu/çarşaf değişim günleri)
- Günlük otomatik rapor → tanımlı WhatsApp ID'ye belirlenen saatte

---

### 5.4. GUEST RELATION
- A'la Carte restoran listesi & kuralları (Excel/Word/PDF)
- Günlük aktivite, şov, mini club, çocuk programı
- **Özel Organizasyon:** Doğum günü, evlenme teklifi vb. → tanımlı yetkiliye direkt bildirim
- VIP / Sadakat / Repeat Guest listeleri (Excel/Word/PDF)
- Meyve sepeti, şarap vb. ikramlar **onay mekanizması** ile ilgili departmana sorulur

#### ⚠️ Aktif Alerjik Misafirler Panosu (KRİTİK)
- Misafir yemek konusu açtığında sistem **zorunlu** olarak alerji sorar
- Alerji bilgisi kaydedilir → tanımlı e-posta + WhatsApp/Telegram'a **acil bildirim**
- Birden fazla sorumlu eklenebilir

---

### 5.5. TEKNİK SERVİS
Tarih aralığı seçilir, talepler listelenir:
- Oda No, İsim Soyisim, Talep, Görsel, Sorumlu ID, Tarih, Durum (giderildi/giderilmedi)
- **Görsel hover'da büyür** (yabancı dil bilmeyen personel için kritik)

---

### 5.6. SPA
- Terapi/masaj türleri (PDF/Excel) → otomatik cevap
- Ortam & hizmet görselleri yükleme
- Özel SPA paketleri (balayı, üyelik, ritüel vb.)
- Talep durumunda direkt ilgili birimi arama opsiyonu

---

## 6. SUPABASE ŞEMASI (SQL)

```sql
-- Oteller
create table hotels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  package text check (package in ('basic','full')),
  contract_months int,
  created_at timestamptz default now()
);

-- In-house misafir listesi
create table inhouse_guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  room_number text not null,
  full_name text not null,
  agency text,
  voucher text,
  pax int,
  check_in date,
  check_out date,
  channel_id text, -- WhatsApp/Telegram/IG ID
  uploaded_at timestamptz default now()
);

-- Departmanlar
create table departments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id) on delete cascade,
  name text check (name in ('reception','guest_relation','housekeeping','fb','technical','spa')),
  sla_minutes int default 5,
  working_hours jsonb -- [{start:"08:00",end:"16:00"},...]
);

-- Departman sorumluları (çoklu)
create table department_staff (
  id uuid primary key default gen_random_uuid(),
  department_id uuid references departments(id) on delete cascade,
  whatsapp_id text,
  telegram_id text,
  full_name text
);

-- Talepler (ana tablo)
create table requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  guest_id uuid references inhouse_guests(id),
  room_number text,
  full_name text,
  request_text text,
  language text,
  channel text, -- whatsapp/telegram/ig
  department text,
  image_url text,
  status text check (status in ('pending','acknowledged','in_progress','resolved','escalated')),
  created_at timestamptz default now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution_minutes int,
  escalated_to_reception boolean default false,
  reception_note text
);

-- DND listesi
create table dnd_list (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  room_number text,
  date date,
  created_at timestamptz default now()
);

-- Alerjik misafirler
create table allergic_guests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  guest_id uuid references inhouse_guests(id),
  allergy text,
  notified_at timestamptz default now()
);

-- Eskalasyon (kritik kelime) bildirim alıcıları
create table escalation_contacts (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  email text,
  whatsapp_id text,
  telegram_id text
);

-- Dosya yüklemeleri (fact sheet, menü, vb.)
create table hotel_documents (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  doc_type text, -- 'concept','fact_sheet','price_list','day_use','map','iban','bar_menu','room_service','spa'
  file_url text,
  uploaded_at timestamptz default now()
);

-- F&B Room Service istek listesi
create table fb_room_service_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references requests(id),
  items jsonb,
  created_at timestamptz default now()
);

-- VIP yöneticiler
create table vip_managers (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid references hotels(id),
  full_name text,
  whatsapp_id text,
  telegram_id text
);
```

---

## 7. ANTIGRAVITY VERİMLİLİK ÖNERİSİ

**Cevap: Evet, `.md` dosyası olarak yüklemek çok daha verimli.** Sebepleri:

1. **Token tasarrufu:** Sohbete uzun metin yapıştırmak her turda tüm metni tekrar context'e sokar. `.md` dosyası referans olarak okunduğu için bir kez parse edilir.
2. **Versiyonlama:** GitHub'a koyarsan değişiklikleri commit'lerle takip edersin, Antigravity her seferinde güncel halini çeker.
3. **Modüler kullanım:** Antigravity'ye *"otomasyon_kural_ve_sistem.md dosyasındaki BÖLÜM 5.4'ü uygula"* diyebilirsin → tüm dosyayı değil sadece ilgili bölümü işler.

**En verimli akış:**
1. Bu `.md` dosyasını GitHub repo köküne `/docs/otomasyon_kural_ve_sistem.md` olarak koy.
2. Antigravity workspace'inde bu dosyayı **rules / context file** olarak işaretle.
3. Her yeni feature için: *"@otomasyon_kural_ve_sistem.md Bölüm X.Y'yi referans alarak şu component'i yaz"* formatında prompt at.
4. Dosyayı bölümlere ayırıp `/docs/01-genel.md`, `/docs/02-talep.md` gibi parçalara ayırırsan token kullanımı **%60-70 düşer**.

**Model önerisi:** Antigravity'de **Claude Sonnet 4.6** kullan — bu büyüklükte yapılandırılmış kural setinde Opus'a göre maliyet/performans çok daha iyi, kural takibinde de güçlü. Sadece mimari karar anlarında Opus 4.6'ya geç.
