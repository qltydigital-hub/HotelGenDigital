-- Guest session tablosu, yarım kalan talepleri ve bağlamı (context) hafızada tutmak için kullanılır
CREATE TABLE IF NOT EXISTS guest_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id VARCHAR(100) UNIQUE NOT NULL, -- ManyChat, IG veya WA ID
    channel VARCHAR(50),
    status VARCHAR(50) DEFAULT 'IDLE', -- IDLE, AWAITING_INFO
    pending_request TEXT, -- "Havlu istiyorum" vs.
    pending_intent VARCHAR(50),
    pending_department VARCHAR(100),
    language VARCHAR(10) DEFAULT 'tr',
    turkish_translation TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- RLS ayarları
ALTER TABLE guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Herkese açık guest_sessions okuma" ON guest_sessions;
DROP POLICY IF EXISTS "Herkese açık guest_sessions yazma" ON guest_sessions;
DROP POLICY IF EXISTS "Herkese açık guest_sessions güncelleme" ON guest_sessions;
CREATE POLICY "Herkese açık guest_sessions okuma" ON guest_sessions FOR SELECT USING (true);
CREATE POLICY "Herkese açık guest_sessions yazma" ON guest_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkese açık guest_sessions güncelleme" ON guest_sessions FOR UPDATE USING (true);
