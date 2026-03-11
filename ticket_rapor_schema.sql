-- ================================================================
-- TICKET RAPOR SİSTEMİ - Supabase'de çalıştırın
-- ================================================================

-- 1. live_tickets tablosunu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS live_tickets (
    id              BIGSERIAL PRIMARY KEY,
    ticket_id       TEXT UNIQUE NOT NULL,        -- HTL-XXXX
    chat_id         TEXT,                         -- Misafirin Telegram chat ID
    guest_name      TEXT,                         -- Misafir adı soyadı
    room_no         TEXT,                         -- Oda numarası
    department      TEXT,                         -- HOUSEKEEPING, TEKNIK, RESEPSIYON, F&B
    status          TEXT DEFAULT 'OPEN',          -- OPEN, ACKED, RESOLVED, ESCALATED
    priority        TEXT DEFAULT 'NORMAL',        -- NORMAL, HIGH, CRITICAL
    description     TEXT,                         -- Talep özeti (Türkçe)
    -- Zaman damgaları
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    acked_at        TIMESTAMPTZ,                  -- İlgileniyorum basıldığında
    resolved_at     TIMESTAMPTZ,                  -- Tamamlandı basıldığında
    escalated_at    TIMESTAMPTZ,                  -- SLA aşımında
    -- Kim yaptı
    acked_by        TEXT,                         -- İşleme alan personel adı
    resolved_by     TEXT,                         -- Tamamlayan personel adı
    -- Hesaplanan süreler (saniye)
    response_time_sec  INTEGER,    -- created_at → acked_at arası
    resolution_time_sec INTEGER,   -- created_at → resolved_at arası
    -- Meta
    is_mock         BOOLEAN DEFAULT false,        -- Test modunda mı?
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ticket_events - Her adımı ayrı ayrı logla (rapor için)
CREATE TABLE IF NOT EXISTS ticket_events (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   TEXT REFERENCES live_tickets(ticket_id) ON DELETE CASCADE,
    event_type  TEXT NOT NULL,  -- CREATED, ACKED, RESOLVED, ESCALATED, INFO_COPY
    actor       TEXT,           -- Personel adı veya 'system'
    notes       TEXT,
    event_time  TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Eksik kolonları mevcut tabloya ekle (zaten varsa hata vermez)
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS acked_at TIMESTAMPTZ;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMPTZ;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS acked_by TEXT;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS resolved_by TEXT;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS response_time_sec INTEGER;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS resolution_time_sec INTEGER;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS is_mock BOOLEAN DEFAULT false;

-- 4. updated_at otomatik güncellensin
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON live_tickets;
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON live_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 5. Yönetici raporu için hazır VIEW (özet istatistik)
CREATE OR REPLACE VIEW ticket_report AS
SELECT
    department,
    status,
    COUNT(*)                                          AS toplam_talep,
    AVG(response_time_sec)                            AS ort_yanit_suresi_sn,
    AVG(resolution_time_sec)                          AS ort_cozum_suresi_sn,
    COUNT(*) FILTER (WHERE status = 'ESCALATED')      AS eskalasyon_sayisi,
    COUNT(*) FILTER (WHERE status = 'RESOLVED')       AS cozulen_talep,
    MIN(created_at)::date                             AS ilk_tarih,
    MAX(created_at)::date                             AS son_tarih
FROM live_tickets
GROUP BY department, status
ORDER BY department, status;

-- 6. Personel performans view'u
CREATE OR REPLACE VIEW staff_performance AS
SELECT
    acked_by                                          AS personel,
    department,
    COUNT(*)                                          AS uzerlenilen_talep,
    AVG(response_time_sec)                            AS ort_yanit_sn,
    AVG(resolution_time_sec)                          AS ort_cozum_sn,
    COUNT(*) FILTER (WHERE status = 'RESOLVED')       AS tamamlanan
FROM live_tickets
WHERE acked_by IS NOT NULL
GROUP BY acked_by, department
ORDER BY department, ort_yanit_sn ASC NULLS LAST;

-- ================================================================
-- KONTROL: Bu sorgu ile tabloları görebilirsiniz
-- SELECT * FROM ticket_report;
-- SELECT * FROM staff_performance;
-- SELECT * FROM live_tickets ORDER BY created_at DESC LIMIT 20;
-- SELECT * FROM ticket_events ORDER BY event_time DESC LIMIT 50;
-- ================================================================
