# 🏢 DEPARTMAN VE SLA YÖNETİMİ

Bu belge, otel departmanlarının yapısını, sorumluluk alanlarını, SLA (Service Level Agreement) sürelerini ve eskalasyon mekanizmasını tanımlar.

---

## 1. DEPARTMAN YAPISI

### 1.1 Aktif Departmanlar

| # | Departman | Kod | Sorumluluk Alanı |
|---|---|---|---|
| 1 | Kat Hizmetleri | `HOUSEKEEPING` | Oda temizliği, çamaşır, yatak/yastık/havlu, minibar |
| 2 | Teknik Servis | `TEKNIK` | Klima, elektrik, tesisat, TV, kapı/kilit, genel bakım |
| 3 | Yiyecek & İçecek | `F&B` | Oda servisi, restoran, bar, kahvaltı, özel menü |
| 4 | Misafir İlişkileri | `GUEST_RELATIONS` | Şikayet, özel talep, VIP, kutlama, hediye |
| 5 | Resepsiyon | `RESEPSIYON` | Giriş/çıkış, fatura, anahtar, genel yardım, eskalasyon |
| 6 | SPA & Wellness | `SPA` | Masaj, hamam, sauna, yüz bakımı |
| 7 | Bilgi Teknolojileri | `IT` | Wi-Fi, TV kanal, dijital hizmetler |
| 8 | Güvenlik | `SECURITY` | Gürültü, şüpheli durum, acil güvenlik |

### 1.2 Departman Personel Kaydı (Supabase)

Her departmanın yetkilileri `hotel_personnel` tablosunda tanımlıdır:

```sql
SELECT * FROM hotel_personnel 
WHERE department = 'HOUSEKEEPING' 
AND is_active = true;
```

| Kolon | Açıklama |
|---|---|
| `full_name` | Personel adı |
| `department` | Departman kodu |
| `platform` | İletişim kanalı (TELEGRAM / WHATSAPP / MANYCHAT) |
| `contact_id` | Telegram Chat ID veya WhatsApp numarası |
| `is_active` | Aktif mi? |

---

## 2. SLA (SERVİS SEVİYESİ SÖZLEŞMESİ)

### 2.1 SLA Süreleri (Varsayılan)

| Departman | İlk Yanıt (ACK) | Çözüm Süresi | Eskalasyon Sonrası |
|---|---|---|---|
| `HOUSEKEEPING` | 5 dakika | 30 dakika | Resepsiyon devralır |
| `TEKNIK` | 3 dakika | 45 dakika | Resepsiyon devralır |
| `F&B` | 5 dakika | 20 dakika | Resepsiyon devralır |
| `GUEST_RELATIONS` | 3 dakika | Değişken | Yönetim bilgilendirilir |
| `RESEPSIYON` | 1 dakika | 15 dakika | Yönetim bilgilendirilir |
| `SPA` | 10 dakika | 60 dakika | Resepsiyon devralır |
| `IT` | 5 dakika | 30 dakika | Resepsiyon devralır |
| `SECURITY` | 1 dakika | 10 dakika | Yönetim + Acil protokol |

### 2.2 Öncelik Bazlı SLA Çarpanları

| Öncelik | Çarpan | Açıklama |
|---|---|---|
| `CRITICAL` | x0.5 | SLA süresi yarıya iner |
| `HIGH` | x0.75 | SLA süresi %25 azalır |
| `NORMAL` | x1.0 | Standart SLA |
| `LOW` | x2.0 | SLA süresi iki katına çıkar |

### 2.3 SLA Yapılandırması (Supabase)

```sql
-- departments tablosundan SLA bilgisi çekilir
SELECT sla_timeout_min FROM departments 
WHERE name = 'HOUSEKEEPING';
```

---

## 3. ESKALASYON MEKANİZMASI

### 3.1 Eskalasyon Akışı

```
Talep oluşturuldu → SLA timer başlatıldı
    │
    ├── Departman SLA içinde yanıt verdi (ACK) ✅
    │   └── Timer iptal, talep IN_PROGRESS
    │
    └── SLA süresi doldu, yanıt YOK ❌
        │
        ├── Durum: ESCALATED yapılır
        ├── Supabase güncellenir (status, escalated_at, failure_reason)
        ├── Resepsiyon tüm yetkililerine ACİL bildirim
        └── Misafire gecikme bilgilendirmesi (opsiyonel)
```

### 3.2 Eskalasyon Mesaj Formatı

```
🚨 ESCALATION ALERT
🏢 Yanıt Vermeyen Dept: [DEPARTMAN]
👤 Bilgi: Oda [ODA_NO] | [MİSAFİR_ADI]
📝 TALEP: [TÜRKÇE_ÖZET]
⏰ BAŞARISIZLIK: [DEPARTMAN] SLA süresi içinde yanıt vermedi.
Lütfen acilen müdahale edin ve inceleme notu ekleyin.
```

### 3.3 Eskalasyon Sonrası Resepsiyon Görevi
1. Durumu incele
2. İnceleme notu ekle (📝 "İnceleme Notu Ekle" butonu)
3. Sorunu çöz veya departmanla iletişime geç
4. Çözüm notunu DB'ye kaydet

---

## 4. DEPARTMANA MESAJ GÖNDERİM KANALLARI

### 4.1 Kanal Önceliği
1. **Supabase `hotel_personnel`:** Veritabanında kayıtlı yetkililere gönder
2. **.env Fallback:** Eğer DB'de yetkili yoksa, `.env` dosyasındaki departman ID'lerini kullan
3. **Mock Fallback:** Hiçbiri yoksa test modunda misafire kendi chatine gönder

### 4.2 .env Departman ID'leri

```env
DEPT_HOUSEKEEPING_ID=   # Housekeeping Telegram grup/kişi ID
DEPT_TEKNIK_ID=         # Teknik Servis Telegram grup/kişi ID
DEPT_RESEPSIYON_ID=     # Resepsiyon Telegram grup/kişi ID
DEPT_FB_ID=             # F&B Telegram grup/kişi ID
DEPT_GUEST_RELATIONS_ID= # Guest Relations Telegram grup/kişi ID
```

### 4.3 Çok Kanallı Gönderim
- **TELEGRAM:** `bot.telegram.sendMessage(contact_id, message)`
- **WHATSAPP:** Twilio/ManyChat API (Faz 2)
- **MANYCHAT:** Webhook API (Faz 2)

---

## 5. DEPARTMAN YANIT BUTONLARI

### 5.1 Talep Mesajındaki Butonlar

| Buton | Callback | Aksiyon |
|---|---|---|
| 👍 Confirmed - Attending Now | `ack_[ticketId]` | SLA timer iptal, durum ACKNOWLEDGED |
| ⏳ Busy - Will Attend Shortly | `busy_[ticketId]` | Durum BUSY_DELAYED, misafire gecikme bildirimi |

### 5.2 Eskalasyon Mesajındaki Butonlar

| Buton | Callback | Aksiyon |
|---|---|---|
| 📝 İnceleme Notu Ekle | `note_[ticketId]` | Resepsiyon not ekleme moduna geçer |

---

## 6. RESEPSIYON BİLGİ KOPYASI (CC)

Her departmana giden talep, eş zamanlı olarak **Resepsiyon'a da kopyalanır (CC)**:

```
📋 BİLGİ (Kopyası) — [TICKET_ID]
👤 Misafir: [Ad Soyad] | 🚪 Oda: [Oda No]
➡️ Yönlendirilen Departman: [DEPARTMAN]
📝 Talep: [Türkçe Özet]
```

**AMAÇ:** Resepsiyon her zaman tüm talepler hakkında bilgi sahibi olur. Eskalasyon durumunda hızlı müdahale edebilir.

---

## 7. VIP MİSAFİR PROTOKOLÜ

VIP misafirlerden gelen talepler özel bir akışa tabidir:

### 7.1 VIP Tespiti
- `in_house_guests` tablosundaki `vip_status` alanı kontrol edilir
- VIP1, VIP2, VVIP seviyeleri tanımlanabilir

### 7.2 VIP Talep Farkları
- SLA süreleri **%50 kısaltılır**
- Guest Relations otomatik CC'ye eklenir
- Çözüm bildirimi yöneticiye de iletilir
- Talep önceliği otomatik `HIGH` olarak ayarlanır

---

## 8. RAPORLAMA VE METRİKLER

### 8.1 Takip Edilen KPI'lar

| Metrik | Formül | Hedef |
|---|---|---|
| İlk Yanıt Süresi | `acked_at - created_at` | < SLA süresi |
| Çözüm Süresi | `resolved_at - created_at` | < Departman çözüm süresi |
| SLA Uyum Oranı | `(Zamanında yanıt / Toplam talep) x 100` | > %95 |
| Eskalasyon Oranı | `(Eskale edilen / Toplam talep) x 100` | < %5 |
| Departman Performansı | Her departman için ayrı SLA uyum oranı | Departmana göre değişir |

### 8.2 Yönetici Rapor Talebi
Yönetici Telegram üzerinden rapor isteyebilir:
- "Nisan ayı arıza raporu ver"
- "Bu hafta housekeeping performansı"
- Bot, Supabase sorgusu yapar ve sonuçları tertemiz formatta gönderir

---

*Son güncelleme: 2026-04-09*
