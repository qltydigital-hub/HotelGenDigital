-- ==============================================================================
-- ÖN BÜRO OTEL KONUM VE YOL TARİFİ AYARLARI (hotel_settings)
-- Bu script'i Supabase üzerindeki SQL Editörü (SQL Editor) alanına yapıştırıp 
-- bir kez (RUN diyerek) çalıştırman yeterlidir.
-- ==============================================================================

-- 1. Eğer hotel_settings tablosu yoksa hata vermemesi için Base Schema üzerinden kuralı ekliyoruz.
-- (Normalde hotel_base_schema.sql ile oluşturmuştuk, ancak garantiye almak için)
CREATE TABLE IF NOT EXISTS hotel_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. hotel_location kaydı daha önce eklendiyse günceller (ON CONFLICT), yoksa sıfırdan ekler.
INSERT INTO hotel_settings (key, value)
VALUES (
    'hotel_location',
    '{
        "url": "https://maps.app.goo.gl/yQHLncHb9GXZEv6z9",
        "description": "📍 The Green Park Gaziantep\\nMithatpaşa Mah. Alibey Sok. No:1, 27500 Şehitkamil / Gaziantep\\n\\nZeugma Mozaik Müzesi''ne sadece 200 metre mesafedeyiz. Navigasyonunuza ''The Green Park Hotel Gaziantep'' yazmanız yeterlidir."
    }'::jsonb
)
ON CONFLICT (key) 
DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = NOW();

-- 3. Yetkilendirme Politikaları (Eğer panelden güncellenecekse yetki verilmesi gerekir)
ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hotel_settings' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON hotel_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
