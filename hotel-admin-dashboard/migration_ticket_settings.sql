-- Yeni bilet ve ayar yönetimi için SQL Script
-- hotel_settings adında bir ayar tablosu oluşturuyoruz
CREATE TABLE IF NOT EXISTS hotel_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID, -- Eğer multi-tenant yapılıyorsa
    department_timeout_minutes INT DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Varsayılan bir ayar ekleyelim (Eğer yoksa)
INSERT INTO hotel_settings (department_timeout_minutes) 
SELECT 15 WHERE NOT EXISTS (SELECT 1 FROM hotel_settings);

-- Aktif biletleri (ManyChat & Telegram Entegrasyonu İçin) tutacağımız tablo
CREATE TABLE IF NOT EXISTS active_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, ACKNOWLEDGED, ESCALATED, RESOLVED
    department VARCHAR(100),
    guest_name VARCHAR(100),
    room_no VARCHAR(50),
    subscriber_id VARCHAR(100),
    channel VARCHAR(50),
    guest_language VARCHAR(10),
    original_message TEXT,
    turkish_translation TEXT,
    image_url TEXT,
    reply_immediate_lang TEXT,
    reply_later_lang TEXT,
    timeout_minutes INT DEFAULT 15,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- RLS ayarları
ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE active_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Herkese açık hotel_settings okuma" ON hotel_settings;
DROP POLICY IF EXISTS "Herkese açık hotel_settings yazma" ON hotel_settings;
DROP POLICY IF EXISTS "Herkese açık hotel_settings güncelleme" ON hotel_settings;
CREATE POLICY "Herkese açık hotel_settings okuma" ON hotel_settings FOR SELECT USING (true);
CREATE POLICY "Herkese açık hotel_settings yazma" ON hotel_settings FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkese açık hotel_settings güncelleme" ON hotel_settings FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Herkese açık active_tickets okuma" ON active_tickets;
DROP POLICY IF EXISTS "Herkese açık active_tickets yazma" ON active_tickets;
DROP POLICY IF EXISTS "Herkese açık active_tickets güncelleme" ON active_tickets;
CREATE POLICY "Herkese açık active_tickets okuma" ON active_tickets FOR SELECT USING (true);
CREATE POLICY "Herkese açık active_tickets yazma" ON active_tickets FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkese açık active_tickets güncelleme" ON active_tickets FOR UPDATE USING (true);
