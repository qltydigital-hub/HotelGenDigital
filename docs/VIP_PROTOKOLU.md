# 👑 VIP MİSAFİR PROTOKOLÜ (VIP GUEST PROTOCOL)

Bu belge, VIP, CIP ve VVIP statüsündeki misafirlere özel hizmet akışlarını, öncelik kurallarını ve departman koordinasyonu prosedürlerini tanımlar.

---

## 1. VIP SEVİYELERİ VE TANIMLARI

### 1.1 VIP Hiyerarşisi

| Seviye | Kod | Tanım | Tetikleyici |
|---|---|---|---|
| VIP 1 | `VIP1` | Sadık misafir, tekrar gelen | 2+ konaklama veya acenta VIP notu |
| VIP 2 | `VIP2` | Kurumsal/ticari önemli misafir | Şirket anlaşması, yönetim kararı |
| VIP 3 | `VIP3` | Üst düzey önemli misafir | GM/Owner kararı |
| CIP | `CIP` | Özel güvenlik gerektiren | Diplomatik, kamu, VIP koruma |
| VVIP | `VVIP` | En üst düzey | Otel sahibi kararı, devlet adamı |

### 1.2 VIP Tespiti

VIP statüsü `in_house_guests` tablosundaki `vip_status` alanından otomatik çekilir:

```sql
SELECT vip_status FROM in_house_guests 
WHERE room_number = $1 AND first_name ILIKE '%' || $2 || '%';
```

---

## 2. VIP TALEP AKIŞI FARKLARI

### 2.1 SLA Ayarları

| Normal Misafir | VIP Misafir | Fark |
|---|---|---|
| ACK: 5 dakika | ACK: 2.5 dakika | **%50 kısa** |
| Çözüm: 30 dakika | Çözüm: 15 dakika | **%50 kısa** |
| Öncelik: NORMAL | Öncelik: HIGH | **Otomatik yükseltme** |
| CC: Resepsiyon | CC: Resepsiyon + Guest Relations + Yönetim | **Genişletilmiş CC** |

### 2.2 VIP Talep Mesaj Formatı (Departmana)

```
⭐ VIP TASK ASSIGNMENT ⭐
🔔 [Oda No | Talep Özeti]
👤 Misafir Statüsü: VIP2
⏰ SLA: 2.5 Dakika (VIP Öncelikli)

[BUTON] 👍 Confirmed - Attending Immediately
[BUTON] ⏳ Busy - Will Attend Shortly
```

### 2.3 VIP Eskalasyon Farkları

```
Normal Misafir:   SLA Aşıldı → Resepsiyona bildirim
VIP Misafir:      SLA Aşıldı → Resepsiyon + Guest Relations + Yönetim (3 katmanlı)
```

---

## 3. VIP KARŞILAMA PROTOKOLÜ

### 3.1 İlk Mesaj Algılaması

Bot, doğrulama sırasında misafirin VIP statüsünü tespit ettiğinde:

```
Doğrulama başarılı + vip_status !== null
    │
    ├── Karşılama mesajını kişiselleştir:
    │   "Sayın [İsim] Bey/Hanım, Azure Coast Resort'a tekrar hoş geldiniz! ⭐
    │    Sizi yeniden ağırlamaktan büyük mutluluk duyuyoruz.
    │    VIP misafirimiz olarak tüm hizmetlerimizde öncelikli 
    │    olarak ilgilenileceğinden emin olabilirsiniz."
    │
    ├── Guest Relations'a OTOMATİK bildirim:
    │   "⭐ VIP CHECK-IN: [İsim], Oda [No], VIP Seviye: [VIP2]"
    │
    └── GM/Yönetim bilgilendir (VIP3/CIP/VVIP için)
```

### 3.2 VIP İletişim Tonu

| Standart Misafir | VIP Misafir |
|---|---|
| "Talebinizi aldım, hemen ileteceğim." | "Talebiniz öncelikli olarak ilgili ekibimize iletilmiştir. En kısa sürede ilgilenilecektir." |
| "Sayın Misafirimiz" | "Sayın [Doğrulanmış İsim] Bey/Hanım" |

> **NOT:** VIP misafire isim kullanılabilir ÇÜNKÜ doğrulanmış session'da isim mevcuttur. Bu, uydurma DEĞİLDİR.

---

## 4. VIP ÖZEL HİZMETLER

### 4.1 Otomatik Bildirimler

| Durum | Bildirim Gidecek Yer | Otomatik? |
|---|---|---|
| VIP check-in | Guest Relations + Resepsiyon + F&B | ✅ Evet |
| VIP talep | Departman + Resepsiyon + Guest Relations | ✅ Evet |
| VIP şikayet | Guest Relations + Yönetim | ✅ Evet |
| VIP çıkış yaklaşıyor | Guest Relations (1 gün önce) | ✅ Evet |

### 4.2 VIP Alerji Protokolü

VIP misafirlerde alerji bilgisi ANINDA:
1. Guest Relations'a bildirilir
2. F&B departmanına özel uyarı gider
3. Oda servisi menüsü filtrelenir
4. Alerjen uyarısı tüm restoranlara iletilir

### 4.3 VIP Özel Talepleri

| Talep | Departman | SLA | Özel İşlem |
|---|---|---|---|
| Doğum günü kutlaması | Guest Relations + F&B | 2 saat | Pasta + çiçek koordinasyonu |
| Balayı sürprizi | Guest Relations + HK | 3 saat | Oda dekorasyonu + champagne |
| Özel menü talebi | F&B + Guest Relations | 4 saat | Şef ile koordinasyon |
| Oda değişikliği | Resepsiyon + HK | 1 saat | Üst kategori upgrade |

---

## 5. VIP RAPORLAMA

### 5.1 VIP KPI'ları

| Metrik | Hedef |
|---|---|
| VIP ilk yanıt süresi | < 2 dakika |
| VIP çözüm süresi | < 15 dakika |
| VIP memnuniyet oranı | > %98 |
| VIP eskalasyon oranı | < %2 |
| VIP check-in karşılama oranı | %100 |

### 5.2 Yöneticiye VIP Rapor

```
📊 VIP PERFORMANS RAPORU - [Tarih Aralığı]

👤 Toplam VIP Misafir: X
📋 Toplam VIP Talep: Y
⏱️  Ortalama İlk Yanıt: Z dk
✅ SLA Uyum: %XX
⚠️  Eskalasyon: X adet
⭐ Memnuniyet: %XX
```

---

*Bu protokol, otel yönetimi tarafından onaylandıktan sonra yürürlüğe girer.*
*Son güncelleme: 2026-04-09*
