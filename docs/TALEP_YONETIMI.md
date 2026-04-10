# 📋 TALEP YÖNETİMİ İŞ AKIŞI (REQUEST WORKFLOW)

Bu belge, misafirden gelen her talebin nasıl sınıflandırılacağını, doğrulanacağını, ilgili departmana iletileceğini ve SLA takibine alınacağını adım adım tanımlar.

> ⚠️ Bu dosya `README.md` (Anayasa) ve `AI_DAVRANIS_KURALLARI.md` ile birlikte okunmalıdır.

---

## 1. MESAJ SINIFLANDIRMA (CLASSIFICATION)

Her gelen mesaj AI tarafından aşağıdaki 4 kategoriden birine atanır:

| Kategori | Kod | Açıklama | Yönlendirme |
|---|---|---|---|
| Bilgi / Sohbet | `INFO_CHAT` | Saat, hava durumu, restoran saati, selamlama | Direkt AI yanıt verir |
| Talep / İstek | `REQUEST` | Yastık, havlu, arıza, oda servisi | Departmana yönlendirilir |
| Şikayet | `COMPLAINT` | Memnuniyetsizlik, kötü deneyim | Guest Relations + Resepsiyon |
| Acil Durum | `EMERGENCY` | Yangın, sağlık, güvenlik tehdidi | Anında Resepsiyon + Güvenlik |

### 1.1 Sınıflandırma Karar Ağacı

```
Misafir Mesajı Geldi
    │
    ├── Selamlama / Hal hatır / Genel soru?
    │   └── INFO_CHAT → Direkt yanıt ver
    │
    ├── Fiziksel bir şey mi istiyor? (yastık, havlu, su, temizlik)
    │   └── REQUEST → Talep akışına al
    │
    ├── Bir şey bozuk mu? (klima, TV, kapı, tesisat)
    │   └── REQUEST → Teknik Servis'e
    │
    ├── Memnuniyetsizlik / Şikayet mi?
    │   └── COMPLAINT → Guest Relations + Resepsiyon CC
    │
    ├── Tehlike / Acil durum mu?
    │   └── EMERGENCY → Anında Resepsiyon + Güvenlik
    │
    └── Belirsiz?
        └── AI nazikçe netleştirici soru sorar
```

---

## 2. TALEP AKIŞI (STEP-BY-STEP)

### ADIM 1: AI Mesajı Analiz Eder
- Mesaj türünü belirler (INFO_CHAT / REQUEST / COMPLAINT / EMERGENCY)
- JSON çıktı üretir: `{ isRequest, department, turkishSummary, replyToUser }`

### ADIM 2: Talep Tespiti (isRequest: true)
- AI talebi algıladığında `isRequest: true` döndürür
- **KRİTİK:** AI bu noktada misafire "talebiniz departmana iletildi" DEMEz
- AI sadece "Talebinizi aldım, bilgilerinize ihtiyacım var" benzeri genel bir yanıt verir

### ADIM 3: Misafir Bilgi Kontrolü
Sistem, misafirin oturum bilgilerini kontrol eder:

```
session.name VE session.room VAR MI?
    │
    ├── EVET (daha önce doğrulanmış)
    │   └── Direkt ADIM 5'e geç
    │
    └── HAYIR (bilgi eksik)
        └── ADIM 4'e geç → Bilgi iste
```

### ADIM 4: Bilgi Toplama (ASK FOR INFO)
Misafirden şu bilgiler istenir:
1. **Ad Soyad** (Zorunlu)
2. **Oda Numarası** (Zorunlu)
3. **Alerji/Diyet Bilgisi** (Opsiyonel, ilk giriş için)

**Örnek mesaj:**
> "Talebinizi iletebilmem için birkaç bilgiye ihtiyacım var 🙏
> 1️⃣ Adınız Soyadınız
> 2️⃣ Oda Numaranız
> _(Örnek: Mehmet Kaya, Oda 412)_"

**KURALLAR:**
- AI bu bilgileri kendi UYDURMAMALICIR
- Misafir bilgi verene kadar talep İŞLENMEZ
- Bekleyen talep `session.pendingAI` içinde saklanır

### ADIM 5: In-House Doğrulama (VERIFICATION)
Misafirin verdiği bilgiler `in_house_guests` tablosundan kontrol edilir:

```sql
SELECT * FROM in_house_guests 
WHERE room_number = '[verilen_oda]' 
AND first_name ILIKE '%[verilen_isim]%'
LIMIT 1;
```

| Sonuç | Aksiyon |
|---|---|
| Eşleşme BULUNDU ✅ | Talebi işleme al, departmana yönlendir |
| Eşleşme YOK ❌ | Kibarca bilgi hatası belirt, tekrar iste |
| Veritabanı HATA ⚠️ | Misafire özür dile, resepsiyona yönlendir |

### ADIM 6: Departman Yönlendirme (ROUTING)
Doğrulanan talep ilgili departmana iletilir:

**Departmana giden mesaj formatı (TÜRKÇE):**
```
🔔 TASK ASSIGNMENT
[Oda No | Talep Özeti]
⏰ SLA: X Dakika
```

**Butonlar:**
- 👍 Confirmed - Attending Now
- ⏳ Busy - Will Attend Shortly

### ADIM 7: Çift Taraflı Bildirim
1. **Misafire (kendi dilinde):** "Talebiniz [departman]'a iletildi, en kısa sürede ilgilenilecektir."
2. **Departmana (Türkçe):** Task mesajı + interaktif butonlar
3. **Resepsiyona (CC):** Bilgi kopyası

### ADIM 8: SLA Zamanlayıcısı Başlat
- Departman bazlı SLA süresi Supabase'den çekilir
- Süre aşılırsa otomatik eskalasyon tetiklenir

---

## 3. TALEP DURUMLARI (STATUS LIFECYCLE)

```
NEW → SENT_TO_DEPT → ACKNOWLEDGED → IN_PROGRESS → RESOLVED
                  ↘                                    ↗
                   → ESCALATED → RECEPTION_TAKEOVER →
```

| Durum | Açıklama |
|---|---|
| `NEW` | Talep oluşturuldu, henüz departmana iletilmedi |
| `OPEN` | Departmana iletildi, yanıt bekleniyor |
| `ACKNOWLEDGED` | Departman personeli "Aldım" verdi |
| `BUSY_DELAYED` | Personel meşgul, kısa gecikme var |
| `IN_PROGRESS` | Talep üzerinde çalışılıyor |
| `ESCALATED` | SLA aşıldı, resepsiyona eskalasyon |
| `RESOLVED` | Talep tamamlandı |
| `CANCELLED` | Talep iptal edildi |

---

## 4. TALEP TÜRLERİ VE ÖNCELİKLERİ

### 4.1 Öncelik Seviyeleri

| Seviye | Kod | Yanıt Süresi | Örnekler |
|---|---|---|---|
| Kritik | `CRITICAL` | 1 dakika | Su baskını, yangın, kapı kilitli kaldı |
| Yüksek | `HIGH` | 3 dakika | Klima arızası, WC arızası, sıcak su yok |
| Normal | `NORMAL` | 5 dakika | Yastık, havlu, temizlik, oda servisi |
| Düşük | `LOW` | 15 dakika | Bilgi talebi, gelecek rezervasyon |

### 4.2 Anahtar Kelime Eşleştirme (İlk Katman)

```
HOUSEKEEPING: yastık, havlu, temizlik, çarşaf, süpürge, paspas, 
              çöp, minibar, battaniye, yorgan, pillow, towel, 
              clean, blanket, bedsheet

TEKNIK:       klima, tv, televizyon, elektrik, su, tesisat, lamba, 
              ampul, kapı, kilit, priz, ısıtma, soğutma, AC, 
              air conditioning, broken, repair, fix

F&B:          yemek, kahvaltı, restoran, bar, içecek, menü, 
              servis, room service, breakfast, dinner, lunch,
              order, food, drink

GUEST_RELATIONS: şikayet, complaint, özel istek, kutlama, 
                  doğum günü, balayı, VIP, hediye, surprise,
                  birthday, honeymoon, anniversary

RESEPSIYON:   çıkış, giriş, fatura, anahtar, kasa, safe, 
              checkout, checkin, bill, key, receipt, invoice

SPA:          masaj, hamam, sauna, spa, wellness, massage,
              treatment, terapi, therapy

SECURITY:     gürültü, noise, şüpheli, suspicious, tehdit,
              acil, emergency, güvenlik, security
```

---

## 5. YAZIM HATASI TOLERANSI

AI, aşağıdaki yaygın yazım hatalarını otomatik düzeltir ve **TEKRAR SORMADAN** anlar:

| Yanlış Yazım | Doğru Anlam |
|---|---|
| yaztık, yasdık | yastık |
| havlı, havl | havlu |
| klma, klıma | klima |
| temzlik | temizlik |
| televzyon | televizyon |
| isiyorım, istoyorum | istiyorum |
| odma, odame | odama |
| yardm | yardım |

**KURAL:** Eğer yazım hatasına rağmen anlam açıksa, AI doğrudan işlem yapar. Sadece hiçbir anlam çıkaramıyorsa nazikçe netleştirme ister.

---

## 6. KARMA MESAJ YÖNETİMİ (HYBRID MESSAGES)

Misafir tek mesajda hem soru hem talep içerebilir:

**Örnek:** "Havuz saat kaça kadar açık ve odama 2 havlu gönderir misiniz?"

**AI Davranışı:**
1. Soru kısmını ANINDA yanıtla: "Havuzumuz 09:00 - 20:00 arası açıktır."
2. Talep kısmını REQUEST olarak işle: `isRequest: true`, `department: HOUSEKEEPING`
3. İki yanıtı TEK mesajda birleştir

---

## 7. TEKRAR EDEN TALEP YÖNETİMİ (DUPLICATE PREVENTION)

- Aynı misafirden, aynı oda için, 5 dakika içinde aynı talep gelirse → TEKRAR OLUŞTURMA
- Misafire: "Bu talebiniz zaten iletildi ve işlem sürecinde. Kısa sürede ilgilenilecektir."
- Eğer 15 dakikayı aşmışsa → Yeni talep olarak oluştur ve "hatırlatma" olarak işaretle

---

*Bu kurallar tüm kanallarda (Telegram, WhatsApp, Instagram, Web) geçerlidir.*
*Son güncelleme: 2026-04-09*
