# 🛡️ GÜVENLİK, GİZLİLİK VE ERİŞİM KONTROLÜ

Bu belge, HotelGen Digital sisteminin güvenlik politikalarını, erişim kontrolünü, KVKK/GDPR uyumluluğunu ve acil durum prosedürlerini tanımlar.

---

## 1. ERİŞİM KONTROLÜ (RBAC - Role Based Access Control)

### 1.1 Roller ve Yetkiler

| Rol | Kod | Yetkiler |
|---|---|---|
| Misafir | `GUEST` | Mesaj gönder, talep aç, talep durumu gör |
| Resepsiyon | `FRONT_OFFICE` | Tüm talepleri gör, eskalasyon al, çözüm notu gir, devral |
| Departman Personeli | `DEPT_STAFF` | Kendi departman kuyruğu, ACK/İşlemde/Tamamlandı ver |
| Yönetici | `MANAGER` | Raporlar, SLA metrikleri, performans, tüm kayıtlar |
| Otel Admini | `HOTEL_ADMIN` | Sistem ayarları, personel yönetimi, entegrasyonlar |
| Süper Admin | `SUPER_ADMIN` | Tüm yetkiler + çoklu otel yönetimi |

### 1.2 Dashboard Giriş ve Oturum Güvenliği
- Her personel ve yönetici için **benzersiz şifre** tanımlıdır
- **5 dakika inaktivite** sonrası otomatik oturum sonlandırma (Auto-Logout)
- Session token'lar Supabase'de saklanır
- Çoklu cihaz kontrolü: Aynı anda tek oturumla sınırlama seçeneği

### 1.3 Oturum Yönetimi Tablosu

```sql
-- staff_users tablosu
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS session_token TEXT;
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW();
```

---

## 2. MİSAFİR VERİ GÜVENLİĞİ

### 2.1 Bot Üzerinden ALINMAMASI Gereken Bilgiler
Aşağıdaki bilgiler **KESİNLİKLE** bot sohbeti üzerinden alınmaz:
- ❌ TC Kimlik numarası
- ❌ Pasaport numarası
- ❌ Kredi kartı numarası, CCV, son kullanma
- ❌ Banka hesap bilgileri (ödeme yapacağı durumlar hariç → o da IBAN paylaşım kurallarına tabi)
- ❌ Şifre veya PIN kodu

**Bu tür talepler için yanıt:**
> "Bu bilgilerinizi güvenlik gereği buradan alamıyoruz. Lütfen resepsiyonumuza şahsen veya telefonla ulaşabilirsiniz: 📞 +90 242 824 00 00"

### 2.2 Log Maskeleme Kuralları
- Telefon numaraları: `+90555***4567`
- E-posta: `m***@gmail.com`
- Kredi kartı: Asla loglanmaz
- İsim: Log'larda tam gösterilir (operasyon için gerekli)

---

## 3. KVKK / GDPR UYUMLULUĞU

### 3.1 Veri İşleme Prensipleri
1. **Amaç Sınırlılığı:** Veriler sadece otel hizmet kalitesini artırmak için kullanılır
2. **Veri Minimizasyonu:** Sadece gerekli veriler toplanır
3. **Doğruluk:** Veriler güncel ve doğru tutulur
4. **Süre Sınırlaması:** Check-out + 7 gün sonra kişisel veriler silinir
5. **Güvenlik:** Veriler şifrelenmiş ortamda saklanır

### 3.2 Misafir Hakları
- Verilerinin ne olduğunu sorma hakkı → Resepsiyon yönlendirmesi
- Verilerinin silinmesini isteme hakkı → Yönetici onayı ile
- Veri işleme reddi hakkı → Bot hizmetinden çıkış imkanı

### 3.3 Veri Saklama Takvimi

| Veri Kategorisi | Saklama Süresi | Sonra |
|---|---|---|
| Sohbet mesajları | 30 gün | Silinir |
| Talep kayıtları | 1 yıl | Anonimleştirilir |
| Kişisel bilgiler | Check-out + 7 gün | Silinir |
| Alerji bilgileri | Check-out + 7 gün | Silinir |
| SLA performans verileri | 2 yıl | Arşivlenir |
| Fatura/ödeme kayıtları | 10 yıl | Yasal zorunluluk |

---

## 4. ACİL DURUM PROTOKOLÜ

### 4.1 Acil Durum Algılama Anahtar Kelimeleri

```
TÜRKÇe: yangın, yanıyor, duman, ambulans, polis, hırsız, 
         saldırı, deprem, sıkıştım, kilitli kaldım, bayıldı, 
         kan, acil, tehlike, yardım edin, kaza

ENGLISH: fire, smoke, ambulance, police, thief, attack, 
         earthquake, stuck, locked, fainted, blood, emergency, 
         danger, help, accident

DEUTSCH: Feuer, Rauch, Krankenwagen, Polizei, Dieb, Angriff, 
         Erdbeben, eingesperrt, Notfall, Gefahr, Hilfe, Unfall

РУССКИЙ: пожар, дым, скорая, полиция, вор, нападение, 
         землетрясение, заперт, срочно, опасность, помощь
```

### 4.2 Acil Durum İşlem Akışı

```
Acil mesaj algılandı
    │
    ├── 1. MİSAFİRE ANINDA YANIT
    │   "Durumunuzu anlıyoruz, güvenlik ekibimiz ve resepsiyon 
    │    derhal bilgilendirildi. Lütfen güvende kalın.
    │    📞 Acil: +90 242 824 00 00"
    │
    ├── 2. GÜVENLİK DEPARTMANİNA BİLDİRİM
    │   🚨 EMERGENCY ALERT
    │   Oda: [ODA] | Misafir: [AD]
    │   Mesaj: [ÖRİJİNAL MESAJ]
    │
    ├── 3. RESEPSİYONA BİLDİRİM
    │   Acil durum CC'si + eskalasyon
    │
    └── 4. YÖNETİME BİLDİRİM (Opsiyonel)
        VIP misafir veya ciddi tehdit durumunda
```

### 4.3 Acil Durumda AI Davranışı
- Standart talep akışını ATLA
- Doğrulama ARAMA (oda sorma vs. yapma — direkt bildir)
- Profesyonel ve SAKİN ol, panik yaratma
- Misafire **pratik talimatlar** ver (çıkış yolu, bekleme noktası)
- Konuşmayı KESİNLİKLE resepsiyona yönlendir

---

## 5. PERSONEL GÜVENLİK KURALLARI

### 5.1 Departman Personeli ve Bot Etkileşimi
- Departman personeli misafirle **ASLA doğrudan chatleşmez**
- Sadece butonlara tıklar (ACK / BUSY) veya not ekler
- Misafirle iletişim her zaman AI/Bot üzerinden olur

### 5.2 Yetkili Yönetici Tespiti
- Supabase `authorized_managers` tablosunda kayıtlı olmalı
- Rapor talebi yapabilmek için oturum doğrulaması gerekli
- Sesli veya metin ile rapor isteyebilirler

### 5.3 Yetki Dışı Erişim Denemesi
- Tanımlanmamış bir chatId'den gelen departman komutu → ENGELLE
- Log'a yaz: `[UNAUTHORIZED_ACCESS] chatId: XXXX attempted department action`
- Güvenlik ekibini bilgilendir

---

## 6. API GÜVENLİĞİ

### 6.1 API Anahtarları
- Tüm API anahtarları `.env` dosyasında saklanır
- Kod içinde hard-coded anahtar **KESİNLİKLE BULUNMAZ**
- `.env` dosyası `.gitignore`'a eklenmiştir

### 6.2 Webhook Güvenliği
- Instagram/ManyChat webhook'ları için IP whitelist uygulanabilir
- Payload doğrulama (signature verification) eklenmeli
- Rate limiting: IP başına dakikada max 60 istek

### 6.3 Supabase Güvenliği
- Row Level Security (RLS) aktif
- Service key sadece backend'de kullanılır
- Anon key ile sınırlı erişim

---

## 7. YEDEKLEME VE FELAKET KURTARMA

### 7.1 Yedekleme Planı
- **Supabase DB:** Otomatik daily backup (Supabase tarafından)
- **Bot konfigürasyonu:** .env ve .md dosyaları Git'te versiyonlanır
- **Excel raporları:** Aylık arşivleme

### 7.2 Bot Çökme Durumu
- PM2 ile otomatik restart
- Çökme sonrası tüm RAM session'lar sıfırlanır
- Misafirlerin tekrar doğrulama yapması gerekir
- Bekleyen (pending) talepler Supabase'de kalmaya devam eder

---

*Son güncelleme: 2026-04-09*
