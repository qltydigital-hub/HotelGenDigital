# 🌐 ÇOKLU DİL YÖNETİMİ (MULTILINGUAL MANAGEMENT)

Bu belge, yapay zeka asistanının çok dilli iletişim kurallarını, dil algılama mekanizmasını, çeviri politikalarını ve dil bazlı özel davranışları tanımlar.

---

## 1. DİL ALGILAMA PRENSİPLERİ

### 1.1 Temel Kural
- Misafir hangi dilde yazarsa → **O DİLDE** yanıt verilir
- Dil algılama **mesaj bazlıdır** (her mesajda bağımsız algılama)
- AI modeli (GPT-4o) dil algılamayı otomatik yapar

### 1.2 Desteklenen Diller

| Dil | Kod | Öncelik | Karşılama |
|---|---|---|---|
| Türkçe | `tr` | 🔴 Ana dil | Hoş geldiniz |
| İngilizce | `en` | 🔴 Birincil | Welcome |
| Almanca | `de` | 🟡 İkincil | Willkommen |
| Rusça | `ru` | 🟡 İkincil | Добро пожаловать |
| Arapça | `ar` | 🟡 İkincil | أهلا وسهلا |
| Fransızca | `fr` | 🟢 Desteklenen | Bienvenue |
| Felemenkçe | `nl` | 🟢 Desteklenen | Welkom |

### 1.3 Desteklenmeyen Diller
- AI tarafından algılanamazsa → İngilizce yanıt dene
- Hala anlaşılamıyorsa → Türkçe fallback + resepsiyona yönlendir

---

## 2. DİL KURALLARI (MUTLAK)

### 2.1 Misafir Tarafı (Guest-Facing)

| Kural | Açıklama |
|---|---|
| ✅ Aynı dilde yanıt | Misafir EN yazarsa, yanıt EN olmalı |
| ❌ Dil değişikliği açıklaması | "Türkçe'ye çeviriyorum" YASAK |
| ❌ Robotik dil ifadeleri | "Translation module activated" YASAK |
| ✅ Doğal geçiş | Dil geçişi sessiz ve doğal olmalı |
| ✅ Kültürel uyum | Her dilin kültürel normlarına uygun hitap |

### 2.2 Departman Tarafı (Internal)

| Kural | Açıklama |
|---|---|
| ✅ Her zaman TÜRKÇE | Departmanlara giden tüm mesajlar Türkçe |
| ✅ turkishSummary zorunlu | AI JSON'da turkishSummary Türkçe yazılır |
| ✅ Misafir dilini belirt | Departman mesajında misafirin dili not edilebilir |

---

## 3. DİL BAZLI KARŞILAMA ŞABLONLARI

### 3.1 İlk Karşılama (Bot otomatik dil algılar)

```
🇹🇷 Türkçe:
"Azure Coast Resort & SPA'ya hoş geldiniz! Size 7/24 yardımcı 
olmaktan mutluluk duyarız. 🌊"

🇬🇧 English:
"Welcome to Azure Coast Resort & SPA! We are delighted to assist 
you 24/7. 🌊"

🇩🇪 Deutsch:
"Willkommen im Azure Coast Resort & SPA! Wir freuen uns, Ihnen 
rund um die Uhr behilflich zu sein. 🌊"

🇷🇺 Русский:
"Добро пожаловать в Azure Coast Resort & SPA! Мы рады помочь 
вам 24/7. 🌊"

🇸🇦 العربية:
"مرحباً بكم في Azure Coast Resort & SPA! يسعدنا مساعدتكم 
على مدار الساعة. 🌊"

🇫🇷 Français:
"Bienvenue au Azure Coast Resort & SPA ! Nous sommes ravis 
de vous aider 24h/24. 🌊"
```

### 3.2 Bilgi İsteme Şablonları

```
🇹🇷: "Talebinizi iletebilmem için adınız soyadınız ve oda numaranızı 
      alabilir miyim? (Örnek: Mehmet Kaya, 412)"

🇬🇧: "To forward your request, may I have your full name and room 
      number? (Example: John Smith, Room 412)"

🇩🇪: "Um Ihre Anfrage weiterzuleiten, benötige ich Ihren vollständigen 
      Namen und Ihre Zimmernummer. (Beispiel: Hans Müller, Zimmer 412)"

🇷🇺: "Чтобы передать ваш запрос, могу я узнать ваше полное имя и 
      номер комнаты? (Пример: Иван Петров, комната 412)"
```

### 3.3 Doğrulama Başarısız Şablonları

```
🇹🇷: "Bilgileriniz konaklayan listemizle eşleşmedi. Lütfen 
      kontrol edip tekrar yazabilir misiniz? 🙏"

🇬🇧: "The information you provided doesn't match our guest list. 
      Could you please verify and try again? 🙏"

🇩🇪: "Die von Ihnen angegebenen Informationen stimmen nicht mit 
      unserer Gästeliste überein. Können Sie diese bitte überprüfen 
      und erneut versuchen? 🙏"

🇷🇺: "Предоставленная вами информация не совпадает с нашим списком 
      гостей. Не могли бы вы проверить и попробовать снова? 🙏"
```

---

## 4. KÜLTÜREL UYUM KURALLARI

### 4.1 Hitap Formatları

| Dil | Resmi Hitap | Sıcak Hitap |
|---|---|---|
| Türkçe | "Sayın Misafirimiz" | "Değerli misafirimiz" |
| İngilizce | "Dear Guest" | "Welcome, our valued guest" |
| Almanca | "Sehr geehrter Gast" | "Lieber Gast" |
| Rusça | "Уважаемый гость" | "Дорогой гость" |
| Arapça | "ضيفنا العزيز" | "أهلاً بك" |
| Fransızca | "Cher invité" | "Bienvenue" |

### 4.2 Kültürel Hassasiyetler

| Kültür | Dikkat Edilmesi Gereken |
|---|---|
| 🇸🇦 Arap | Alkol referanslarında dikkatli ol, helal yemek bilgisi sun |
| 🇷🇺 Rus | Kısa ve net yanıtlar, uzun açıklamalardan kaçın |
| 🇩🇪 Alman | Dakik ve kesin bilgiler, saat ve program detayları |
| 🇬🇧 İngiliz/Amerikan | Nazik ama profesyonel, please/thank you |

---

## 5. ÇOKLU DİLDE TALEP İŞLEME

### 5.1 Departman Mesajı (Her Zaman Türkçe)

Misafir hangi dilde yazarsa yazsın, departmana giden mesaj:

```
🔔 TASK ASSIGNMENT
[Oda No | Türkçe Talep Özeti]
⏰ SLA: X Dakika
🌐 Misafir Dili: [EN/DE/RU/AR]
```

### 5.2 Onay Mesajı (Misafirin Dilinde)

generateFinalConfirmation fonksiyonu:
- Misafirin dilini otomatik algılar
- Onay mesajını O DİLDE üretir
- İsim ve oda numarası ile kişiselleştirir

---

## 6. DİL BAZLI HAZIR YANITLAR

### 6.1 Teknik Hata Mesajı (Tüm Dillerde)

```
🇹🇷: "Şu an teknik bir aksaklık yaşıyoruz. Lütfen resepsiyonumuzu 
      arayın: 📞 +90 242 824 00 00"

🇬🇧: "We're currently experiencing a technical issue. Please contact 
      our reception: 📞 +90 242 824 00 00"

🇩🇪: "Wir haben derzeit ein technisches Problem. Bitte kontaktieren 
      Sie unsere Rezeption: 📞 +90 242 824 00 00"

🇷🇺: "В настоящее время мы испытываем технические неполадки. 
      Пожалуйста, свяжитесь с нашей рецепцией: 📞 +90 242 824 00 00"
```

---

*Son güncelleme: 2026-04-09*
