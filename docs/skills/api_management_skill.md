---
name: API Manager Skill
description: HotelGenDigital projesi için gerekli olan tüm API'lerin, endpoint'lerin ve yapılandırmaların merkezi olarak tutulduğu ve yönetildiği skill dosyası.
---

# API Management Skill

Bu dosya, projenin ihtiyaç duyduğu tüm dış ve iç API bağlantılarını, anahtarlarını, base URL'lerini ve kullanım amaçlarını merkezi bir yerde toplamak amacıyla oluşturulmuştur.

## Mevcut API'ler ve Yapılandırmalar

Aşağıdaki liste, projede kullanılan API'leri içerir. (Eklemeler yapıldıkça bu liste güncellenecektir.)

### 1. [API Adı Örneği - Örn: OpenAI / Supabase / Netlify]
- **Kullanım Amacı:** [Ne için kullanıldığı kısaca açıklanacak]
- **Base URL:** `https://api.example.com/v1`
- **Gerekli Başlıklar (Headers):**
  - `Authorization: Bearer <API_KEY>`
  - `Content-Type: application/json`
- **Sık Kullanılan Endpoint'ler:**
  - `GET /data` - Verileri getirme
  - `POST /data` - Veri gönderme
- **Notlar / Kurallar:** API'nin limitleri veya özel kullanım şekilleri burada belirtilir.

---

## Agent (Yapay Zeka) İçin Talimatlar

1. **API İhtiyacı Doğduğunda:** Herhangi bir entegrasyon veya veri çekme/gönderme işlemi yapmadan *önce* bu dosyayı kontrol et.
2. **Yeni Bir API Ekleneceğinde:** Bu dosyayı doğrudan güncelleyerek yeni API'nin amacını, URL'sini ve kullanım şeklini dökümante et.
3. **Güvenlik (ÖNEMLİ):** Gerçek API anahtarları (`API_KEY`) bu dosyada **ASLA açık metin olarak bulundurulmamalıdır**. Onun yerine `.env` dosyasındaki değişken isimlerine (`process.env.VITE_ORNEK_API_KEY` vb.) atıfta bulunulmalıdır.

