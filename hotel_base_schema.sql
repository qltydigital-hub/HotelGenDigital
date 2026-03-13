-- ================================================================
-- 🏨 OTEL SİSTEMİ ANA KURULUM DOSYASI (BLUEPRINT)
-- Her yeni anlaşılan otelin kendi bağımsız Supabase'inde bir kez çalıştırılır.
-- Bu script: Departman Sorumlularını, Biletleri(Görevleri) ve SLA geçmişini oluşturur.
-- ================================================================

-- 1. DEPARTMAN YETKİLİLERİ / PERSONEL
-- Bu tablo kimin hangi kanaldan (WhatsApp / Telegram) bildirim alacağını belirler.
CREATE TABLE IF NOT EXISTS hotel_personnel (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    full_name TEXT NOT NULL,
    department TEXT NOT NULL,                  -- Örn: 'TEKNIK', 'HOUSEKEEPING', 'RESEPSIYON', 'F&B'
    platform TEXT NOT NULL DEFAULT 'TELEGRAM', -- 'TELEGRAM', 'WHATSAPP', 'MANYCHAT'
    contact_id TEXT NOT NULL,                  -- Telegram Chat ID veya WhatsApp Numarası (+90555...)
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(department, contact_id)             -- Aynı kişi aynı departmana 2 kez eklenmesin
);

-- 2. CANLI BİLETLER (Görev / SLA Takibi)
CREATE TABLE IF NOT EXISTS live_tickets (
    ticket_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,         -- Şikayeti açan misafirin ID'si
    guest_name TEXT,
    room_no TEXT,
    department TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN',    -- OPEN, ACKED, ESCALATED, RESOLVED
    priority TEXT DEFAULT 'NORMAL',
    description TEXT,
    reception_note TEXT,
    is_mock BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    acked_at TIMESTAMPTZ,
    acked_by TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by TEXT,
    escalated_at TIMESTAMPTZ,
    response_time_sec INTEGER,
    resolution_time_sec INTEGER
);

-- 3. BİLET GEÇMİŞİ (Hareket Logları)
CREATE TABLE IF NOT EXISTS ticket_events (
    id BIGSERIAL PRIMARY KEY,
    ticket_id TEXT REFERENCES live_tickets(ticket_id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,      -- CREATED, ACKED, ESCALATED, RESOLVED, RECEPTION_NOTE
    actor TEXT,
    notes TEXT,
    event_time TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OTEL SİSTEM AYARLARI (Panel Ayarları vs. için JSON formatında)
CREATE TABLE IF NOT EXISTS hotel_settings (
    id BIGSERIAL PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE hotel_settings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hotel_settings' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON hotel_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;


-- ================================================================
-- İLK KURULUM TEST VERİLERİ (Örnek Şablon)
-- ================================================================
INSERT INTO hotel_personnel (full_name, department, platform, contact_id) VALUES
('Süleyman Usta (Test)', 'TEKNIK', 'TELEGRAM', '758605940'),
('Ayşe Hanım (Test)', 'HOUSEKEEPING', 'WHATSAPP', '+905551234567'),
('Resepsiyon Banko', 'RESEPSIYON', 'TELEGRAM', '758605940')
ON CONFLICT DO NOTHING;
