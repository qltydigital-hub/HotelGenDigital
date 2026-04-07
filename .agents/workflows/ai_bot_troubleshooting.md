---
description: Yapay Zeka Botlarındaki halüsinasyon, çakışma ve mantık hatalarını teşhis edip "sıfır hata" noktasına indirme prosedürü.
---

# AI Bot Troubleshooting & Zero-Error Deployment Protocol

Bu workflow, Azure Coast Hotel Telegram veya diğer yapay zeka botlarında meydana gelen anlamsız yanıtlar, görev atlama veya halüsinasyon durumlarında izlenmesi gereken "Sıfır Hata" standardı prosedürüdür. Kullanıcı (işletme sahibi) yapay zekanın "saçmaladığını" veya talimatları dinlemediğini belirttiğinde, bu prosedürü %100 eksiksiz uygulayın.

## Gerekli Kontroller:

1. **Hayalet/Çakışan Süreç (Ghost Process) Kontrolü [EN KRİTİK]**:
   - Eğer bot anlamsız cevaplar veriyorsa veya kodda yaptığınız hiçbir değişiklik etki etmiyorsa, %99 ihtimalle arkada açık unutulmuş eski bir terminal veya Node.js işlemi vardır ve Telegram webhook/polling'ini eski kodla o çekiyordur.
   // turbo-all
   - `taskkill /F /IM node.exe` komutunu çalıştırarak sistemdeki tüm başıboş node görevlerini acımasızca sonlandırın. (PM2 süreçleri de kapanacaktır, bu güvenlidir).
   - Ardından `npx pm2 start ecosystem.config.js` diyerek sistemi sıfır ve temiz bir state ile sadece güncel koddan ayağa kaldırın.

2. **Düşük Yaratıcılık (Low Temperature) Kontrolü**:
   - Kurumsal botlarda yapay zekanın ad-soyad uydurması veya inisiyatif alması FİYASKODUR.
   - Dosyayı inceleyin (`view_file` -> `index.js`).
   - `openai.chat.completions.create` komutlarında `temperature` değerini kontrol edin. Eğer `0.7` veya üstüyse derhal `0.0` veya `0.1`'e çekin. Bu, modelin halüsinasyon görmesini fiziksel olarak imkansızlaştırır.

3. **isRequest ve Karar Ağacı Soyutlaması (Prompt Engineering)**:
   - Yapay zekaya "ad, soyad, oda yoksa sor" isterseniz, kendisi sormaya kalkabilir.
   - Bu yüzden "Sen sorma!" uyarısını çok net yapın: "SEN MÜŞTERİYE ODA NUMARAN NEDİR DİYE SORU SORMAYACAKSIN. SADECE isRequest: true DÖN. BIRAK ONU SİSTEM SORSUN." formatında bağlayıcı (strict) bir prompt mantığı kullandığınızdan emin olun.

4. **Kayıp Bilgi Tamamlama (Hallucination on Empty Extractions)**:
   - `extractGuestInfo` gibi fonksiyonlar boş parametre bulunca ("ben yastık istiyorum" yazısında isim olmadığı halde) bir isim uydurmaya meyillidir.
   - Mutlaka `gpt-4o` kullanın ve Prompt'a: "EĞER AD SOYAD GEÇMİYORSA NULL DÖN, ASLA UYDURMA" yazdırın. Sıfır tolerans!

5. **Log Teyidi (PM2 Logs)**:
   - `npx pm2 logs hotel-telegram-bot --lines 50` çalıştırarak asıl hatanın Telegram 409 Conflict mi yoksa Prompt json parse hatası mı olduğunu teyit edin.

Bu prosedürü uyguladığınızda, bot inisiyatif alıp ad-soyad uyduramaz, var olan görevleri sistem üzerinden ilerletmek zorunda kalır ve çakışan açık sunucular ortadan kaldırılır.
