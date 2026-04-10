# 🧠 HAFIZA YÖNETİMİ VE BAĞLAM KONTROLÜ (MEMORY & CONTEXT)

Bu belge, yapay zeka asistanının misafir bağlamını (context) nasıl yöneteceğini, hafıza mekanizmasının kurallarını ve oturum yaşam döngüsünü tanımlar.

---

## 1. HAFIZA TÜRLERİ

### 1.1 Kısa Süreli Hafıza (Short-Term / Session)
- **Nerede:** RAM (guestSessions objesi)
- **Ömrü:** Bot çalıştığı sürece veya check-out'a kadar
- **İçerik:** Ad, soyad, oda no, alerji, doğrulama durumu, bekleyen talep
- **Temizlenme:** Bot restart, check-out veya 24 saat inaktivite

### 1.2 Uzun Süreli Hafıza (Long-Term / Supabase)
- **Nerede:** Supabase veritabanı (`guest_memory` tablosu)
- **Ömrü:** Konaklama süresi boyunca
- **İçerik:** Oda numarası, tercihler, alerji, önceki talepler
- **Temizlenme:** Check-out sonrası otomatik silme/arşivleme

### 1.3 Konuşma Geçmişi (Conversation History)
- **Nerede:** Supabase veya Dashboard API
- **Ömrü:** Konfigüre edilebilir (varsayılan: 7 gün)
- **İçerik:** Tüm mesajlar (user + assistant + system)
- **Temizlenme:** Retention politikasına göre

---

## 2. SESSION YAŞAM DÖNGÜSÜ

```
[Misafir ilk mesaj gönderir]
    │
    ├── Session OLUŞTUR (state: 'new')
    │   - name: null
    │   - room: null
    │   - pendingAI: null
    │
    ├── [Misafir soru sorar → INFO_CHAT]
    │   └── Direkt yanıt ver (session değişmez)
    │
    ├── [Misafir talep yapar → REQUEST]
    │   │
    │   ├── Session 'complete' DEĞİLSE
    │   │   ├── state → 'awaiting_info'
    │   │   ├── pendingAI → AI sonucu kaydet
    │   │   └── Bilgi iste
    │   │
    │   └── Session 'complete' İSE
    │       └── Direkt departmana yönlendir
    │
    ├── [Misafir bilgi verir]
    │   ├── In-House doğrulama BAŞARILI
    │   │   ├── state → 'complete'
    │   │   ├── name, room kaydet
    │   │   └── Bekleyen talebi işle
    │   │
    │   └── In-House doğrulama BAŞARISIZ
    │       └── Tekrar bilgi iste (maks 3 deneme)
    │
    ├── [Check-out / 24 saat inaktivite]
    │   └── Session SİL (tüm bilgiler temizlenir)
    │
    └── [Bot restart]
        └── Tüm session'lar sıfırlanır (RAM temizlenir)
```

---

## 3. HAFIZADAKİ BİLGİYİ KULLANMA KURALLARI

### 3.1 Bilgiyi Tekrar Sorma Yasağı
- Misafir daha önce adını ve oda numarasını verdiyse ve session 'complete' ise:
  - ❌ "Oda numaranızı tekrar alabilir miyim?"
  - ✅ Direkt talebi işle, bilgiyi session'dan al

### 3.2 Bilgiyi Yanlış Kullanma Yasağı
- Bir misafirin bilgisini başka bir misafir için KULLANMA
- Her chatId için ayrı session tutulur
- Session A'daki bilgi Session B'ye sızmamalı

### 3.3 Bilgiyi Uydurma Yasağı (TEKRAR VE KESİN)
- Session'da `name: null` ise → isim BİLİNMİYOR demektir
- `null` değerleri asla uydurma ile doldurma
- Sadece misafirin kendisinin verdiği ve IN-HOUSE'dan doğrulanmış bilgiler geçerlidir

---

## 4. BAĞLAM (CONTEXT) YÖNETİMİ

### 4.1 Konuşma Bağlamı
AI, son N mesajı hatırlayarak bağlamsal yanıtlar verir:
- **Kısa konuşmalar (< 5 mesaj):** Tüm geçmiş AI'ya gönderilir
- **Uzun konuşmalar (> 5 mesaj):** Son 5 mesaj + özet gönderilir

### 4.2 Bağlam Penceresinde Tutulacak Bilgiler
```javascript
{
    guest_name: "Mehmet Kaya",      // Doğrulanmış misafir adı
    room_number: "305",             // Doğrulanmış oda
    allergies: "Fıstık alerjisi",   // Alerji bilgisi
    language: "tr",                 // Algılanan dil
    previous_requests: [            // Son talepler
        { type: "HOUSEKEEPING", item: "yastık", status: "RESOLVED" }
    ],
    check_in_date: "2026-04-07",
    check_out_date: "2026-04-14"
}
```

### 4.3 Bağlam Kullanım Örnekleri

**Doğru Kullanım:**
- Misafir: "Bir tane daha gönderebilir misiniz?"
- AI: (Önceki talep yastık idi) → "Tabii, hemen bir yastık daha gönderiyoruz!" + `isRequest: true`

**Yanlış Kullanım:**
- Misafir: "Bir tane daha gönderebilir misiniz?"
- AI: (Bağlam yok, ne istediği belirsiz) → "Elbette! Tam olarak ne göndermemizi istersiniz?"

---

## 5. SUPABASE HAFIZA TABLOLARI

### 5.1 guest_memory (Varsa)

```sql
CREATE TABLE IF NOT EXISTS guest_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL,
    platform TEXT DEFAULT 'TELEGRAM',
    guest_name TEXT,
    room_number TEXT,
    allergies TEXT,
    preferences JSONB DEFAULT '{}',
    language TEXT DEFAULT 'tr',
    verified_at TIMESTAMPTZ,
    last_interaction TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 5.2 conversation_messages (İsteğe Bağlı)

```sql
CREATE TABLE IF NOT EXISTS conversation_messages (
    id BIGSERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    role TEXT NOT NULL,           -- 'user', 'assistant', 'system'
    content TEXT NOT NULL,
    platform TEXT DEFAULT 'TELEGRAM',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. HAFIZA TEMİZLEME POLİTİKASI

### 6.1 Otomatik Temizleme Tetikleyicileri

| Tetikleyici | Aksiyon |
|---|---|
| Check-out tarihi geçti | Session + Supabase hafıza temizle |
| 24 saat inaktivite | RAM session temizle (Supabase kalır) |
| Bot restart | RAM session tamamen sıfırla |
| Misafir /start yazarsa | Session sıfırla (yeni oturum) |
| In-House tablosu güncellendi | Artık olmayan misafirlerin hafızasını düşür |

### 6.2 Veri Saklama Süreleri (KVKK/GDPR)

| Veri Türü | Saklama Süresi | Sonra |
|---|---|---|
| Mesaj içeriği | 30 gün | Anonim özet kalır, içerik silinir |
| Kişisel bilgiler (ad, oda) | Check-out + 7 gün | Silinir |
| Talep kayıtları | 1 yıl | Arşivlenir (anonim) |
| Alerji bilgileri | Check-out + 7 gün | Silinir |
| SLA/Performans verileri | 2 yıl | Arşivlenir |

---

## 7. ÇOK PLATFORMLU HAFIZA SENKRONIZASYONU

### 7.1 Platform Bağımsız Kimlik
- Telegram: chatId bazlı
- WhatsApp: telefon numarası bazlı
- Instagram: contact_id bazlı

### 7.2 Cross-Platform Durumu
- Şu an her platform bağımsız session tutar
- Gelecekte: Oda numarası bazlı birleştirme yapılabilir
- Aynı misafir farklı platformdan yazarsa → Yeni doğrulama gerekir

---

*Son güncelleme: 2026-04-09*
