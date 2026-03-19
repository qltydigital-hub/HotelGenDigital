-- 1. ACENTALAR (AGENCIES) TABLOSU
CREATE TABLE IF NOT EXISTS agencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE, -- Tüm otellere veya specific otele ait olabilir
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    price_text TEXT NOT NULL,
    is_direct BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS İzinleri (Güvenlik)
ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Herkese açık acenta okuma" ON agencies;
DROP POLICY IF EXISTS "Herkese açık acenta yazma" ON agencies;
DROP POLICY IF EXISTS "Herkese açık acenta güncelleme" ON agencies;
DROP POLICY IF EXISTS "Herkese açık acenta silme" ON agencies;

CREATE POLICY "Herkese açık acenta okuma" ON agencies FOR SELECT USING (true);
CREATE POLICY "Herkese açık acenta yazma" ON agencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkese açık acenta güncelleme" ON agencies FOR UPDATE USING (true);
CREATE POLICY "Herkese açık acenta silme" ON agencies FOR DELETE USING (true);

-- Örnek başlangıç verisi (Opsiyonel)
INSERT INTO agencies (name, url, price_text, is_direct) 
VALUES 
('Direkt Web Sitemiz', 'https://greenpark.com/rezervasyon', '₺2.500 (En Ucuz)', true),
('ETS Tur', 'https://etstur.com/hotel', '₺2.800', false),
('Booking.com', 'https://booking.com/hotel', '₺3.000', false)
ON CONFLICT DO NOTHING;
