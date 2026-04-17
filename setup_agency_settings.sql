-- The Green Park Gaziantep — Acente ve Rezervasyon Linkleri
-- Bu kodu Supabase > SQL Editor alanına yapıştırıp "Run" sekmesine tıklayın.

-- hotel_settings tablosu zaten varsa sadece veriyi upsert et
-- Yoksa önce oluştur:
CREATE TABLE IF NOT EXISTS public.hotel_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Acente ayarları: Otel linki her zaman 1. sırada (SQL seviyesinde garantili)
INSERT INTO public.hotel_settings (key, value, updated_at)
VALUES (
    'hotel_agencies',
    '{
        "hotelReservationLink": "https://www.thegreenpark.com/gaziantep/",
        "hotelReservationLabel": "The Green Park Gaziantep - Direkt Rezervasyon",
        "priority_rule": "HOTEL_FIRST",
        "agencies": [
            {"name": "Booking.com", "url": "https://www.booking.com/hotel/tr/the-green-park-gaziantep.html", "priority": 2},
            {"name": "Trivago", "url": "https://www.trivago.com.tr/gaziantep-the-green-park", "priority": 3}
        ]
    }'::jsonb,
    NOW()
)
ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- ÖNEMLİ KURAL (SQL Seviyesi):
-- "hotelReservationLink" her zaman AI tarafından İLK sunulacak linktir.
-- Diğer acente linkleri yalnızca misafir alternatif talep ettiğinde paylaşılır.
-- Bu kural reception.js prompt dosyasında da enforce edilmektedir.
-- 
-- Ön büro panelinden acente linkleri eklenebilir/güncellenebilir.
-- priority alanı: düşük sayı = yüksek öncelik (1=otel, 2=birincil acente, 3=ikincil acente)
