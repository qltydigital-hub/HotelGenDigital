-- =====================================================
-- GuestFlow AI — Supabase Kurulum SQL
-- ADIM 1: https://supabase.com/dashboard/project/zenasswnaatfjfrscmob/sql/new
-- ADIM 2: Aşağıdaki SQL'in tamamını kopyalayıp yapıştırın
-- ADIM 3: "RUN" butonuna tıklayın
-- =====================================================

-- 1. telegram_messages: Tüm bot mesajları buraya kaydedilir
CREATE TABLE IF NOT EXISTS telegram_messages (
    id          BIGSERIAL PRIMARY KEY,
    chat_id     TEXT NOT NULL,
    bot_name    TEXT NOT NULL DEFAULT 'guest_bot',
    role        TEXT NOT NULL DEFAULT 'user',
    text        TEXT NOT NULL,
    platform    TEXT NOT NULL DEFAULT 'Telegram',
    intent      TEXT,
    department  TEXT,
    is_alerjen  BOOLEAN DEFAULT FALSE,
    ticket_id   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. live_tickets: SLA board için açık talepler
CREATE TABLE IF NOT EXISTS live_tickets (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   TEXT UNIQUE NOT NULL,
    chat_id     TEXT,
    room_no     TEXT DEFAULT 'Bilinmiyor',
    guest_name  TEXT DEFAULT 'Misafir',
    department  TEXT,
    status      TEXT NOT NULL DEFAULT 'OPEN',
    priority    TEXT NOT NULL DEFAULT 'NORMAL',
    description TEXT,
    is_alerjen  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. system_logs: n8n, AI, Telegram aktivite logları
CREATE TABLE IF NOT EXISTS system_logs (
    id          BIGSERIAL PRIMARY KEY,
    level       TEXT NOT NULL DEFAULT 'INFO',
    source      TEXT NOT NULL DEFAULT 'system',
    message     TEXT NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Supabase Realtime açık (dashboard canlı günceller için)
ALTER TABLE telegram_messages REPLICA IDENTITY FULL;
ALTER TABLE live_tickets REPLICA IDENTITY FULL;
ALTER TABLE system_logs REPLICA IDENTITY FULL;

-- 5. RLS (Row Level Security) — şimdilik herkese açık
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON telegram_messages;
CREATE POLICY "Allow all for now" ON telegram_messages FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE live_tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON live_tickets;
CREATE POLICY "Allow all for now" ON live_tickets FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all for now" ON system_logs;
CREATE POLICY "Allow all for now" ON system_logs FOR ALL USING (true) WITH CHECK (true);

-- ✅ BAŞARILI! 3 tablo oluşturuldu.
-- Ardından Settings > Tab 5 > "Bağlantıyı Test Et" butonuna tıklayın.
