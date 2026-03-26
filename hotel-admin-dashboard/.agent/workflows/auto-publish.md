---
description: Otomatik Canlı Sistem Güncelleme ve Yayınlama (Auto-Deploy & Publish)
---
Bu workflow, projede önemli bir geliştirme, hata düzeltmesi veya iç revize yapıldıktan sonra sistemin canlıda (Vercel vb.) güncellenmesi için standart Git komutlarını otomatik çalıştırır.

// turbo-all
1. Yapılan tüm değişiklikleri Git'e ekle:
`git add .`

2. Değişiklikleri açıklayıcı bir mesaj ile kaydet:
`git commit -m "Auto-publish: Sistem ve kod güncellemeleri yapıldı"`

3. Yapılan geliştirmeleri ana koda (remote/main) göndererek canlı yayına (Deploy) çıkmasını sağla:
`git push origin main`

Bu işlemleri manuel onay beklemeden `SafeToAutoRun: true` şeklinde otomatik (turbo-all) olarak çalıştır.
