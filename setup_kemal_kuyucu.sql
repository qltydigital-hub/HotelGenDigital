-- ================================================================
-- KEMAL KUYUCU — YÖNETİCİ 2 — TEMİZLİK + YENİ KURULUM
-- Bu script Supabase SQL Editor'de çalıştırılmalıdır.
-- ================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. ESKİ KAYITLARI SİL (hotel_personnel)
-- ═══════════════════════════════════════════════════════════════
DELETE FROM hotel_personnel WHERE full_name ILIKE '%Kemal%';

-- ═══════════════════════════════════════════════════════════════
-- 2. ESKİ YETKİLİ YÖNETİCİ KAYITLARINI SİL (authorized_managers)
-- ═══════════════════════════════════════════════════════════════
DELETE FROM authorized_managers WHERE name ILIKE '%Kemal%';

-- ═══════════════════════════════════════════════════════════════
-- 3. YENİ DEPARTMAN GRUPLARI (hotel_personnel) — GÜNCEL ID'LER
-- ═══════════════════════════════════════════════════════════════
INSERT INTO hotel_personnel (full_name, department, platform, contact_id, is_active)
VALUES 
  ('Greenpark-GR (Kemal)',  'GUEST_RELATIONS', 'TELEGRAM', '-5239942817', true),
  ('Greenpark-HK (Kemal)',  'HOUSEKEEPING',    'TELEGRAM', '-5267202618', true),
  ('Greenpark-FO (Kemal)',  'RESEPSIYON',      'TELEGRAM', '-5001899460', true),
  ('Greenpark-FB (Kemal)',  'F&B',             'TELEGRAM', '-4990574414', true),
  ('Greenpark-TS (Kemal)',  'TEKNIK',          'TELEGRAM', '-5109452393', true)
ON CONFLICT (department, contact_id) 
DO UPDATE SET 
  is_active = true,
  full_name = EXCLUDED.full_name;

-- ═══════════════════════════════════════════════════════════════
-- 4. YETKİLİ YÖNETİCİ (authorized_managers) — Kemal User ID
-- ═══════════════════════════════════════════════════════════════
INSERT INTO authorized_managers (telegram_id, name, role, is_active)
VALUES ('1010061120', 'Kemal KUYUCU', 'ADMIN', true)
ON CONFLICT (telegram_id) DO UPDATE SET
  name = 'Kemal KUYUCU',
  role = 'ADMIN',
  is_active = true;

-- ═══════════════════════════════════════════════════════════════
-- 5. DOĞRULAMA
-- ═══════════════════════════════════════════════════════════════
SELECT full_name, department, contact_id, is_active FROM hotel_personnel ORDER BY department, full_name;
SELECT name, telegram_id, role, is_active FROM authorized_managers ORDER BY name;
