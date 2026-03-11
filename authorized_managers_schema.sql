-- ================================================================
-- YETKİLİ YÖNETİCİ TABLOSU
-- Dashboard'dan rapor botuna erişim yönetimi için
-- Supabase SQL Editor'de çalıştırın
-- ================================================================

CREATE TABLE IF NOT EXISTS authorized_managers (
    id              BIGSERIAL PRIMARY KEY,
    telegram_id     TEXT UNIQUE NOT NULL,       -- Telegram kullanıcı ID'si
    name            TEXT,                        -- Yöneticinin adı (bilgi amaçlı)
    role            TEXT DEFAULT 'MANAGER',      -- MANAGER, ADMIN, DIRECTOR
    is_active       BOOLEAN DEFAULT true,        -- Aktif/Pasif
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- İlk yöneticiyi ekle (test için)
INSERT INTO authorized_managers (telegram_id, name, role, is_active)
VALUES ('758605940', 'Özgür (Test Yönetici)', 'ADMIN', true)
ON CONFLICT (telegram_id) DO NOTHING;

-- Otomatik updated_at
CREATE OR REPLACE FUNCTION update_managers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_managers_updated_at ON authorized_managers;
CREATE TRIGGER set_managers_updated_at
    BEFORE UPDATE ON authorized_managers
    FOR EACH ROW EXECUTE FUNCTION update_managers_updated_at();

-- ================================================================
-- KULLANIM ÖRNEKLERİ
-- ================================================================

-- Yeni yönetici ekle:
-- INSERT INTO authorized_managers (telegram_id, name, role) VALUES ('123456789', 'Ahmet Müdür', 'MANAGER');

-- Yöneticiyi pasif yap (erişimi kapat):
-- UPDATE authorized_managers SET is_active = false WHERE telegram_id = '123456789';

-- Tüm yöneticileri listele:
-- SELECT * FROM authorized_managers ORDER BY created_at DESC;

-- ================================================================
