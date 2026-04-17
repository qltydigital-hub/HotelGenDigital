-- ================================================================
-- DEPARTMAN YETKİLİLERİNİ GÜNCELLE (ÇOK YÖNETİCİLİ YAPI)
-- Bu script, her iki yöneticinin Telegram departman grup Chat ID'lerini atar.
-- ================================================================

-- ═══════════════════════════════════════════════════════════════
-- YÖNETİCİ 1: Özgür ÖZEN — Departman Grupları
-- ═══════════════════════════════════════════════════════════════
INSERT INTO hotel_personnel (full_name, department, platform, contact_id, is_active)
VALUES 
  ('Greenpark-HK (Özgür)',  'HOUSEKEEPING',    'TELEGRAM', '-5146686704', true),
  ('Greenpark-TS (Özgür)',  'TEKNIK',          'TELEGRAM', '-5109602342', true),
  ('Greenpark-FB (Özgür)',  'F&B',             'TELEGRAM', '-5272206709', true),
  ('Greenpark-FO (Özgür)',  'RESEPSIYON',      'TELEGRAM', '-5166737146', true),
  ('Greenpark-GR (Özgür)',  'GUEST_RELATIONS', 'TELEGRAM', '-5193711765', true)
ON CONFLICT (department, contact_id) 
DO UPDATE SET is_active = true, full_name = EXCLUDED.full_name;

-- ═══════════════════════════════════════════════════════════════
-- YÖNETİCİ 2: Kemal KUYUCU — Departman Grupları
-- ═══════════════════════════════════════════════════════════════
INSERT INTO hotel_personnel (full_name, department, platform, contact_id, is_active)
VALUES 
  ('Greenpark-GR (Kemal)',  'GUEST_RELATIONS', 'TELEGRAM', '-4862233097', true),
  ('Greenpark-HK (Kemal)',  'HOUSEKEEPING',    'TELEGRAM', '-5217376218', true),
  ('Greenpark-FO (Kemal)',  'RESEPSIYON',      'TELEGRAM', '-5134706265', true),
  ('Greenpark-FB (Kemal)',  'F&B',             'TELEGRAM', '-5105850779', true),
  ('Greenpark-TS (Kemal)',  'TEKNIK',          'TELEGRAM', '-5141471902', true)
ON CONFLICT (department, contact_id) 
DO UPDATE SET is_active = true, full_name = EXCLUDED.full_name;

-- ═══════════════════════════════════════════════════════════════
-- DOĞRULAMA
-- ═══════════════════════════════════════════════════════════════
SELECT full_name, department, contact_id, is_active 
FROM hotel_personnel 
ORDER BY department, full_name;
