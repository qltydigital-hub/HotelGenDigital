# 🔐 MİSAFİR DOĞRULAMA PROTOKOLÜ (GUEST VERIFICATION)

Bu belge, otel sisteminde misafir kimlik doğrulamasının nasıl yapılacağını, hangi verilerin kontrol edileceğini ve hata senaryolarında nasıl davranılacağını tanımlar.

> ⚠️ **KRİTİK:** Hiçbir talep, misafir doğrulaması YAPILMADAN departmana İLETİLEMEZ. Bu kural İHLAL EDİLEMEZ.

---

## 1. DOĞRULAMA NEDİR VE NEDEN ZORUNLUDUR?

Otel sistemi, dışarıdan herhangi birinin (otel misafiri olmayan) sahte talep oluşturmasını önlemek için **In-House Doğrulama** mekanizması kullanır.

### 1.1 Doğrulama Yapılmazsa Ne Olur?
- ❌ Sahte talepler departmanlara iletilir → Personel boşa koşar
- ❌ Gerçek misafirin odası bilinmez → Yanlış odaya hizmet
- ❌ SLA metrikleri kirlenir → Raporlar yanlış olur
- ❌ Güvenlik açığı → İstismar edilebilir

---

## 2. DOĞRULAMA AKIŞI (VERIFICATION FLOW)

```
Misafir talep yaptı
    │
    ├── Session'da name + room VAR MI?
    │   │
    │   ├── EVET → Daha önce doğrulanmış, direkt departmana ilet
    │   │
    │   └── HAYIR
    │       │
    │       ├── Misafirden bilgi iste:
    │       │   - Ad Soyad
    │       │   - Oda Numarası
    │       │
    │       ├── Bilgi geldi
    │       │   │
    │       │   ├── in_house_guests tablosundan kontrol et
    │       │   │   │
    │       │   │   ├── EŞLEŞME VAR ✅
    │       │   │   │   ├── Session'a kaydet (name, room, allergies)
    │       │   │   │   ├── state = 'complete' yap
    │       │   │   │   └── Bekleyen talebi işle
    │       │   │   │
    │       │   │   └── EŞLEŞME YOK ❌
    │       │   │       ├── "Bilgileriniz eşleşmedi" mesajı
    │       │   │       ├── Tekrar bilgi iste
    │       │   │       └── 3. denemede → Resepsiyona yönlendir
    │       │   │
    │       │   └── Bilgi anlaşılmadı
    │       │       └── Format örneği vererek tekrar iste
    │       │
    │       └── Misafir bilgi vermek istemiyor
    │           └── Kibarca resepsiyona yönlendir
```

---

## 3. IN-HOUSE VERİTABANI YAPISI

### 3.1 Tablo: `in_house_guests`

| Kolon | Tip | Açıklama |
|---|---|---|
| `id` | UUID | Birincil anahtar |
| `room_number` | TEXT | Oda numarası (ör: "305") |
| `first_name` | TEXT | Misafirin adı |
| `last_name` | TEXT | Misafirin soyadı |
| `check_in` | DATE | Giriş tarihi |
| `check_out` | DATE | Çıkış tarihi |
| `pax` | INTEGER | Kişi sayısı |
| `nationality` | TEXT | Uyruk |
| `agency` | TEXT | Acenta |
| `vip_status` | TEXT | VIP seviyesi |
| `notes` | TEXT | Özel notlar |

### 3.2 Doğrulama Sorgusu

```sql
-- Temel doğrulama: Oda numarası + İsim eşleşmesi
SELECT * FROM in_house_guests 
WHERE room_number = $1 
AND (
    first_name ILIKE '%' || $2 || '%' 
    OR last_name ILIKE '%' || $2 || '%'
)
AND check_out >= CURRENT_DATE  -- Check-out geçmemiş olmalı
LIMIT 1;
```

---

## 4. BİLGİ ÇIKARMA (EXTRACTION) KURALLARI

AI, misafirin mesajından bilgi çıkarırken şu kurallara uyar:

### 4.1 Yapılması Gerekenler
- ✅ Sadece mesajda **AÇIKÇA** yazılmış bilgileri çıkar
- ✅ "Mehmet Kaya, 305" → name: "Mehmet Kaya", room: "305"
- ✅ "Oda 412, Ali Demir" → name: "Ali Demir", room: "412"
- ✅ "412 nolu oda, Demir" → name: "Demir", room: "412"

### 4.2 Yapılmaması Gerekenler (MUTLAK YASAK)
- ❌ Mesajda isim yoksa isim UYDURMA → `name: null` döndür
- ❌ Mesajda oda yoksa oda UYDURMA → `room: null` döndür
- ❌ "Herhalde 305. odadır" gibi TAHMIN YAPMA
- ❌ Telegram kullanıcı adını misafir adı olarak KULLANMA
- ❌ Önceki başka misafirlerin bilgilerini KARIŞTIRMA

### 4.3 Extraction AI Promptu (Referans)
```
Kullanıcının mesajından ad, soyad, oda numarası ve varsa alerji bilgisini çıkar. 
EĞER cümlede kişinin adı veya oda numarası açıkça geçmiyorsa 
ASLA İSİM VEYA RAKAM UYDURMA, o alanlara null döndür. 
Sadece JSON döndür: {"name": "... veya null", "room": "... veya null", "allergies": "... veya null"}
Temperature: 0.0 (Sıfır halüsinasyon)
```

---

## 5. OTURUM (SESSION) YÖNETİMİ

### 5.1 Session Yapısı
```javascript
guestSessions[chatId] = {
    name: null,         // Doğrulanmış ad soyad
    room: null,         // Doğrulanmış oda numarası
    allergies: null,    // Alerji/diyet bilgisi
    state: 'new',       // 'new' | 'awaiting_info' | 'complete'
    pendingAI: null,    // Bekleyen AI yanıtı (talep)
    verifiedAt: null,   // Doğrulama zamanı
    failedAttempts: 0   // Başarısız doğrulama sayısı
};
```

### 5.2 State Geçişleri
```
'new'           → Misafir henüz doğrulanmamış
'awaiting_info' → Bilgi istendi, yanıt bekleniyor  
'complete'      → Doğrulama başarılı, talepler işlenebilir
```

### 5.3 Session Temizleme Kuralları
- Check-out tarihi geçen misafirin session'ı otomatik düşürülür
- Bot yeniden başlatıldığında tüm session'lar sıfırlanır
- 24 saat inaktivite sonrası session düşürülür

---

## 6. BAŞARISIZ DOĞRULAMA SENARYOLARI

### 6.1 Bilgi Eşleşmedi (1. Deneme)
```
"Üzgünüm, belirttiğiniz bilgiler (Ad/Soyad ve Oda No) konaklayan 
listemizle eşleşmedi. Lütfen bilgilerinizi kontrol edip tekrar 
yazabilir misiniz? 🙏"
```

### 6.2 Bilgi Eşleşmedi (2. Deneme)
```
"Maalesef yine eşleşme sağlayamadık. Lütfen giriş (check-in) 
sırasında verdiğiniz Ad Soyad ve Oda Numaranızı tam olarak 
yazabilir misiniz?"
```

### 6.3 Bilgi Eşleşmedi (3. Deneme - Son)
```
"Bilgilerinizi doğrulayamıyoruz. Lütfen resepsiyonumuzu 
arayarak destek alabilirsiniz: 📞 +90 242 824 00 00"
```
> 3. denemeden sonra session state `'blocked'` olarak işaretlenir ve 30 dakika boyunca yeni doğrulama denemesi engellenir.

### 6.4 Format Anlaşılmadı
```
"Üzgünüm, bilgileri anlayamadım 😊 Lütfen şu formatta yazabilir misiniz?

Ad Soyad, Oda [numara]
(Örnek: Mehmet Kaya, Oda 412)"
```

---

## 7. PLATFORM BAZLI DOĞRULAMA FARKLARI

### 7.1 Telegram
- Misafir bilgisi sohbet içinde sorulur
- Session chatId bazlı tutulur
- Doğrulama sonrası konaklama boyunca geçerli

### 7.2 Instagram (Webhook)
- Bilgi ManyChat/n8n üzerinden payload'da gelir
- `full_name` ve `room_number` webhook body'den alınır
- Her istekte ayrıca doğrulama yapılır (session yok)

### 7.3 WhatsApp (Gelecek Faz)
- Telefon numarası bazlı eşleştirme imkanı
- Session telefon numarasına bağlı

---

## 8. ALERJİ PROTOKOLÜ (EK DOĞRULAMA)

Misafir ilk doğrulamada alerji/diyet bilgisi verirse:
1. Bilgi session'a kaydedilir
2. Guest Relations'a **ANLİK UYARI** gönderilir
3. `allergy_alerts` tablosuna yazılır
4. F&B departmanı bilgilendirilir

**Alerji uyarı mesajı formatı:**
```
⚠️ KRİTİK ALERJİ BİLDİRİMİ ⚠️
👤 Misafir: [Ad Soyad]
🚪 Oda: [Oda No]
🚫 Alerji/Diyet: [Detay]
Bu misafir sisteme yeni giriş yaptı. Lütfen iletişime geçiniz.
```

---

*Bu protokol tüm kanallarda (Telegram, WhatsApp, Instagram) uygulanır.*
*Son güncelleme: 2026-04-09*
