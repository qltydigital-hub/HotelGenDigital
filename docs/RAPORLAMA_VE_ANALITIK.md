# 📊 RAPORLAMA VE ANALİTİK (REPORTING & ANALYTICS)

Bu belge, HotelGen Digital sisteminin raporlama yapısını, yöneticilerin talep edebileceği rapor türlerini, KPI tanımlarını ve rapor formatlarını tanımlar.

---

## 1. RAPOR TÜRLERİ

### 1.1 Otomatik Raporlar

| Rapor | Periyot | Alıcı | Tetikleyici |
|---|---|---|---|
| Günlük Talep Özeti | Her gece 23:59 | Yönetici / FM | Otomatik cron |
| Haftalık Performans | Her Pazartesi 09:00 | GM / Owner | Otomatik cron |
| Aylık SLA Raporu | Her ayın 1'i | Yönetim kurulu | Otomatik cron |
| Anlık Eskalasyon Bildirimi | Gerçek zamanlı | Resepsiyon + Yönetim | SLA aşımı |

### 1.2 Talep Üzerine Raporlar

Yöneticiler Telegram üzerinden doğal dilde rapor isteyebilir:

| Örnek Talep | Sistem Aksiyonu |
|---|---|
| "Nisan ayı arıza raporu ver" | Nisan ayı TEKNIK departman talepleri |
| "Bu hafta housekeeping performansı" | Son 7 gün HK talepleri + SLA uyumu |
| "Bugünkü şikayetleri göster" | Bugünkü COMPLAINT kategorisi |
| "305 numaralı oda geçmişi" | Oda bazlı tüm talep kaydı |
| "VIP misafir raporunu ver" | VIP statülü misafir talepleri |

---

## 2. KPI TANIMLARI (Key Performance Indicators)

### 2.1 Operasyonel KPI'lar

| # | KPI | Formül | Hedef | Yorum |
|---|---|---|---|---|
| 1 | İlk Yanıt Süresi (FRT) | `acked_at - created_at` | < SLA süresi | Departmanın ilk tepki süresi |
| 2 | Çözüm Süresi (RT) | `resolved_at - created_at` | < Dept çözüm SLA | Talebin açılmasından kapanmasına |
| 3 | SLA Uyum Oranı | `(Zamanında / Toplam) × 100` | > %95 | Genel SLA performansı |
| 4 | Eskalasyon Oranı | `(Eskale / Toplam) × 100` | < %5 | Düşük = iyi performans |
| 5 | Tekrar Talep Oranı | `(Tekrar / Toplam) × 100` | < %3 | Sorunun ilk seferde çözülmesi |
| 6 | Misafir Memnuniyeti | Anket veya bot rating | > %90 | Genel memnuniyet |

### 2.2 Departman Bazlı KPI'lar

| Departman | İlk Yanıt Hedefi | Çözüm Hedefi | Eskalasyon Limiti |
|---|---|---|---|
| HOUSEKEEPING | 5 dk | 30 dk | < %5 |
| TEKNIK | 3 dk | 45 dk | < %5 |
| F&B | 5 dk | 20 dk | < %5 |
| GUEST_RELATIONS | 3 dk | Değişken | < %2 |
| RESEPSIYON | 1 dk | 15 dk | < %3 |
| SPA | 10 dk | 60 dk | < %10 |
| IT | 5 dk | 30 dk | < %5 |
| SECURITY | 1 dk | 10 dk | %0 |

### 2.3 AI/Bot KPI'ları

| Metrik | Hedef | Ölçüm |
|---|---|---|
| Doğru sınıflandırma oranı | > %95 | Manuel kontrol |
| Halüsinasyon oranı | %0 | Post-processing catch |
| Ortalama yanıt süresi | < 3 saniye | Log analizi |
| Dil algılama doğruluğu | > %98 | Manuel kontrol |
| Doğrulama başarı oranı | > %80 | Session log analizi |

---

## 3. RAPOR FORMATLARI

### 3.1 Günlük Özet Raporu (Telegram)

```
📊 GÜNLÜK RAPOR — [Tarih]
━━━━━━━━━━━━━━━━━━━━━━━━

📋 Toplam Talep: XX
✅ Çözülen: XX (%XX)
⏳ Bekleyen: XX
🚨 Eskale Olan: XX
❌ Reddedilen: XX

📈 Departman Dağılımı:
   🏠 Housekeeping: XX
   🔧 Teknik: XX
   🍽️ F&B: XX
   👤 Guest Relations: XX
   🏨 Resepsiyon: XX

⏱️  Ortalama İlk Yanıt: X.X dk
⏱️  Ortalama Çözüm: X.X dk
✅ SLA Uyum: %XX

⭐ VIP Talep: XX
🌐 Dil Dağılımı: TR XX% | EN XX% | DE XX% | Diğer XX%
```

### 3.2 Haftalık Performans Raporu

```
📊 HAFTALIK PERFORMANS — [Başlangıç - Bitiş]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 GENEL ÖZET
   Toplam Talep: XXX
   Çözülen: XXX (%XX)
   Eskalasyon: XX (%X)

📈 DEPARTMAN PERFORMANSI
┌─────────────────┬───────┬────────┬──────────┬──────────┐
│ Departman       │ Talep │ Çözüm  │ Ort. FRT │ SLA Uyum │
├─────────────────┼───────┼────────┼──────────┼──────────┤
│ Housekeeping    │ XX    │ XX     │ X.X dk   │ %XX      │
│ Teknik          │ XX    │ XX     │ X.X dk   │ %XX      │
│ F&B             │ XX    │ XX     │ X.X dk   │ %XX      │
│ Guest Relations │ XX    │ XX     │ X.X dk   │ %XX      │
│ Resepsiyon      │ XX    │ XX     │ X.X dk   │ %XX      │
└─────────────────┴───────┴────────┴──────────┴──────────┘

🔝 EN SIK TALEP EDİLEN:
   1. Yastık talebi (XX kez)
   2. Klima arızası (XX kez)
   3. Havlu talebi (XX kez)

⚠️  SLA İHLALLERİ:
   [Detaylı liste]

⭐ VIP PERFORMANSI:
   Toplam VIP Talep: XX
   VIP SLA Uyum: %XX
```

### 3.3 Supabase Rapor Sorguları

```sql
-- Günlük talep sayısı
SELECT department, COUNT(*) as total, 
       AVG(response_time_sec) as avg_response,
       COUNT(CASE WHEN status = 'ESCALATED' THEN 1 END) as escalated
FROM live_tickets 
WHERE DATE(created_at) = CURRENT_DATE
GROUP BY department;

-- Haftalık SLA uyum oranı
SELECT department,
       COUNT(*) as total,
       COUNT(CASE WHEN response_time_sec <= (SELECT sla_timeout_min * 60 FROM departments d WHERE d.name = live_tickets.department) THEN 1 END) as on_time,
       ROUND(COUNT(CASE WHEN response_time_sec <= (SELECT sla_timeout_min * 60 FROM departments d WHERE d.name = live_tickets.department) THEN 1 END) * 100.0 / COUNT(*), 1) as sla_percent
FROM live_tickets
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY department;

-- Oda bazlı geçmiş
SELECT * FROM live_tickets 
WHERE room_no = '305'
ORDER BY created_at DESC;

-- VIP talep raporu
SELECT lt.*, ihg.vip_status
FROM live_tickets lt
JOIN in_house_guests ihg ON lt.room_no = ihg.room_number
WHERE ihg.vip_status IS NOT NULL
AND lt.created_at >= $1 AND lt.created_at <= $2;
```

---

## 4. DASHBOARD ENTEGRASYONU

### 4.1 Dashboard'da Görüntülenecek Widgetlar

| Widget | Veri | Güncelleme |
|---|---|---|
| Anlık Açık Talepler | OPEN + ACKNOWLEDGED | Real-time |
| SLA Performans Gauge | SLA uyum oranı | 5 dk'da bir |
| Departman Yük Haritası | Talep dağılımı | Real-time |
| Eskalasyon Alert | Eskale olan talepler | Real-time |
| Günlük Trend Grafiği | Saatlik talep yoğunluğu | 1 saatte bir |

---

## 5. YÖNETİCİ RAPOR TALEBİ AKIŞI

```
Yönetici Telegram'dan yazar: "Nisan ayı raporu"
    │
    ├── Bot authorized_managers tablosundan kontrol eder
    │   ├── Yetkili ✅ → Rapor üretilir
    │   └── Yetkisiz ❌ → "Bu işlem için yetkiniz bulunmamaktadır."
    │
    ├── Tarih aralığı parsing (NLP):
    │   - "Nisan ayı" → 2026-04-01 - 2026-04-30
    │   - "Bu hafta" → Pazartesi - Bugün
    │   - "Dün" → dün 00:00 - 23:59
    │   - "Son 3 gün" → 3 gün öncesi - bugün
    │
    ├── Supabase sorgusu → Verileri çek
    │
    ├── Rapor formatla (Markdown)
    │
    └── Telegram mesajı olarak gönder
```

---

*Son güncelleme: 2026-04-09*
