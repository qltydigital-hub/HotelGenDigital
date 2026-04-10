# 🚨 ACİL DURUM PROTOKOLÜ (EMERGENCY PROTOCOL)

Bu belge, otel yapay zeka asistanının acil durum mesajlarını algılama, sınıflandırma ve ilgili birimlere anında iletme prosedürlerini tanımlar.

> ⚠️ **KRİTİK:** Acil durumlarda NORMAL TALEP AKIŞI ATLANIR. Doğrulama (ad/oda sorgulama) YAPILMAZ. Hız, hayat kurtarabilir.

---

## 1. ACİL DURUM SINIFLANDIRMASI

### 1.1 Acil Durum Seviyeleri

| Seviye | Kod | Tanım | Örnekler |
|---|---|---|---|
| 🔴 Seviye 1 - Hayati | `EMERGENCY_L1` | Hayati tehlike, yangın, sağlık krizi | Yangın, kalp krizi, boğulma |
| 🟠 Seviye 2 - Ciddi | `EMERGENCY_L2` | Güvenlik tehdidi, ciddi arıza | Hırsızlık, kapı kilitlenme, su baskını |
| 🟡 Seviye 3 - Acil | `EMERGENCY_L3` | Acil müdahale gerektiren | Asansör arızası, gürültü şikayeti (gece) |

### 1.2 Çok Dilli Acil Durum Anahtar Kelimeleri

```
🇹🇷 TÜRKÇE:
yangın, yanıyor, duman, alev, ambulans, polis, hırsız, saldırı, 
deprem, sıkıştım, kilitli kaldım, bayıldı, bayılıyor, kan, kanıyor,
acil, acil durum, tehlike, yardım edin, kaza, düştüm, boğuluyorum,
kalp, nefes alamıyorum, su baskını, tahliye, bomba

🇬🇧 ENGLISH:
fire, smoke, flame, ambulance, police, thief, robbery, attack, 
earthquake, stuck, locked, fainted, blood, bleeding, emergency, 
danger, help, accident, falling, drowning, heart, can't breathe, 
flooding, evacuation, bomb, threat

🇩🇪 DEUTSCH:
Feuer, Rauch, Flamme, Krankenwagen, Polizei, Dieb, Einbruch, 
Angriff, Erdbeben, eingesperrt, ohnmächtig, Blut, Notfall, 
Gefahr, Hilfe, Unfall, ertrinken, Herz, Überschwemmung, 
Evakuierung, Bombe, Bedrohung

🇷🇺 РУССКИЙ:
пожар, дым, пламя, скорая, полиция, вор, ограбление, нападение, 
землетрясение, заперт, обморок, кровь, срочно, чрезвычайная ситуация, 
опасность, помощь, авария, утопающий, сердце, наводнение, 
эвакуация, бомба, угроза

🇫🇷 FRANÇAIS:
feu, fumée, ambulance, police, voleur, attaque, tremblement de terre,
coincé, évanoui, sang, urgence, danger, aide, accident, noyade, cœur,
inondation, évacuation, bombe, menace

🇸🇦 العربية:
حريق، دخان، إسعاف، شرطة، لص، هجوم، زلزال، عالق، إغماء، 
دم، طوارئ، خطر، مساعدة، حادث، غرق، قلب، فيضان، إخلاء
```

---

## 2. ACİL DURUM AKIŞI

### 2.1 Akış Diyagramı

```
Mesaj Geldi → Acil Durum Anahtar Kelimesi Algılandı
    │
    ├── 1. MİSAFİRE ANLIK YANIT (< 3 saniye)
    │   └── [Misafirin dilinde sakin, bilgilendirici mesaj]
    │
    ├── 2. GÜVENLİK DEPARTMANİNA BİLDİRİM (< 5 saniye)
    │   └── 🚨 EMERGENCY ALERT + butonlar
    │
    ├── 3. RESEPSİYONA BİLDİRİM (< 5 saniye)
    │   └── Acil durum CC'si
    │
    ├── 4. YÖNETİME BİLDİRİM (Seviye 1 ise)
    │   └── GM/Duty Manager bildirimi
    │
    └── 5. LOG VE KAYIT
        └── Supabase'e acil durum kaydı
```

### 2.2 Misafire Yanıt Şablonları

#### 🇹🇷 Türkçe
```
Seviye 1 (Hayati):
"Durumunuzu anlıyoruz. Güvenlik ekibimiz ve resepsiyon DERHAL 
bilgilendirildi. Lütfen güvende kalın. Gerekirse en yakın 
acil çıkışı kullanın.
📞 Acil Hat: +90 242 824 00 00
🚑 112 Acil Yardım"

Seviye 2 (Ciddi):
"Durumu anlıyoruz, güvenlik ekibimiz hemen yönlendiriliyor.
Lütfen odanızda kalın ve kapınızı kilitleyin.
📞 Resepsiyon: +90 242 824 00 00"

Seviye 3 (Acil):
"Konuyla hemen ilgileniyoruz. Ekibimiz en kısa sürede 
yanınızda olacaktır. 📞 +90 242 824 00 00"
```

#### 🇬🇧 English
```
Level 1 (Life-threatening):
"We understand the situation. Our security team and reception 
have been IMMEDIATELY notified. Please stay safe. If necessary, 
use the nearest emergency exit.
📞 Emergency: +90 242 824 00 00
🚑 112 Emergency Services"

Level 2 (Serious):
"We understand the situation. Our security team is being 
dispatched immediately. Please stay in your room and lock your door.
📞 Reception: +90 242 824 00 00"
```

---

## 3. DEPARTMANA GİDEN ACİL BİLDİRİM FORMATI

### 3.1 Güvenliğe Bildirim

```
🚨🚨🚨 EMERGENCY ALERT 🚨🚨🚨
━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ SEVİYE: [L1/L2/L3]
👤 Platform: [Telegram/WhatsApp]
📱 Chat ID: [chatId]
🚪 Oda: [Biliniyorsa oda no / Bilinmiyor]
📝 Mesaj: "[Orijinal mesaj — çevrilmemiş]"
🌐 Dil: [Algılanan dil]
⏰ Zaman: [Timestamp]
━━━━━━━━━━━━━━━━━━━━━━━━━━━

❗ ACIL MÜDAHALE GEREKİYOR
[BUTON] ✅ Müdahale Ediyorum
[BUTON] 📝 Durum Notu Ekle
```

### 3.2 Resepsiyona Bildirim (CC)

```
🚨 ACİL DURUM BİLGİLENDİRME
Güvenlik ekibi bilgilendirildi.
Oda: [Biliniyorsa] | Misafir: [Biliniyorsa]
Mesaj: "[Özet]"
Seviye: [L1/L2/L3]
```

---

## 4. ACİL DURUMDA AI DAVRANIŞ KURALLARI

### 4.1 YAPILMASI GEREKENLER ✅

1. **HIZI ÖNCELİKLENDİR:** Mümkün olan en kısa sürede yanıt ver
2. **SAKİN OL:** Profesyonel, güven verici, panik yapmayan ton
3. **BİLGİLENDİR:** Güvenlik ekibinin bilgilendirildiğini söyle
4. **SOMUT TALİMAT:** Acil çıkış, kapı kilitleme, bekleme noktası
5. **İLETİŞİM BİLGİSİ:** Telefon numaralarını paylaş
6. **DOĞRULAMA ATLAMA:** Ad/oda sorma, ANINDA bildir

### 4.2 YAPILMAMASI GEREKENLER ❌

1. ❌ "Sakin olun" deme (küçümseyici)
2. ❌ "Araştırıyorum" deme (zaman kaybı)
3. ❌ Ad soyad / oda numarası SORMA
4. ❌ Normal talep akışına alma (SLA zamanlayıcısı vs.)
5. ❌ Panik yaratacak ifadeler kullanma
6. ❌ "Yapay zekayım, bu konuda yardımcı olamam" deme
7. ❌ Misafiri bırakma — TAKİP ET

---

## 5. ACİL DURUM SONRASI PROSEDÜR

### 5.1 Rapor Oluşturma
```
📋 ACİL DURUM RAPORU
━━━━━━━━━━━━━━━━━━
📅 Tarih/Saat: [timestamp]
🚪 Oda: [oda_no]
👤 Misafir: [ad_soyad]
📝 Olay: [açıklama]
⚡ Seviye: [L1/L2/L3]
👷 Müdahale Eden: [personel]
⏱️  Müdahale Süresi: [dakika]
📌 Sonuç: [çözüldü/devam ediyor/yetkili bilgilendirildi]
📝 Not: [ek açıklama]
```

### 5.2 Takip Eylemleri

| Eylem | Sorumlu | Süre |
|---|---|---|
| Olay raporu Supabase'e kaydet | Sistem (Otomatik) | Anında |
| Misafir takip mesajı gönder | Guest Relations | 30 dk içinde |
| Yönetim briefing | Güvenlik Şefi | 1 saat içinde |
| Sigorta/yasal bildirim (Gerekirse) | Yönetim | 24 saat içinde |

---

*Bu protokol, 7/24 geçerlidir ve tüm personel tarafından bilinmelidir.*
*Son güncelleme: 2026-04-09*
