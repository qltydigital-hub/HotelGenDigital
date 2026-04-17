-- ================================================================
-- KEMAL KUYUCU — YÖNETİCİ 2 PERSONEL & YETKİ KAYITLARI
-- Bu script Supabase SQL Editor'de çalıştırılmalıdır.
-- Özgür ÖZEN'in kayıtlarına DOKUNMAZ, sadece ek kayıtlar yapar.
-- ================================================================

-- ═══════════════════════════════════════════════════════════════
-- 1. DEPARTMAN GRUPLARI (hotel_personnel)
-- Kemal KUYUCU'nun kendi departman Telegram grupları
-- ═══════════════════════════════════════════════════════════════
INSERT INTO hotel_personnel (full_name, department, platform, contact_id, is_active)
VALUES 
  ('Greenpark-GR (Kemal)',  'GUEST_RELATIONS', 'TELEGRAM', '-4862233097', true),
  ('Greenpark-HK (Kemal)',  'HOUSEKEEPING',    'TELEGRAM', '-5217376218', true),
  ('Greenpark-FO (Kemal)',  'RESEPSIYON',      'TELEGRAM', '-5134706265', true),
  ('Greenpark-FB (Kemal)',  'F&B',             'TELEGRAM', '-5105850779', true),
  ('Greenpark-TS (Kemal)',  'TEKNIK',          'TELEGRAM', '-5141471902', true)
ON CONFLICT (department, contact_id) 
DO UPDATE SET 
  is_active = true,
  full_name = EXCLUDED.full_name;

-- ═══════════════════════════════════════════════════════════════
-- 2. YETKİLİ YÖNETİCİ (authorized_managers)
-- Kemal KUYUCU'yu rapor botuna erişim yetkisi ile ekle
-- NOT: telegram_id alanını Kemal'ın gerçek Telegram User ID'si ile 
--      güncelleyiniz (botu /start diyerek öğrenebilir)
-- ═══════════════════════════════════════════════════════════════
INSERT INTO authorized_managers (telegram_id, name, role, is_active)
VALUES ('KEMAL_TELEGRAM_USER_ID', 'Kemal KUYUCU', 'ADMIN', true)
ON CONFLICT (telegram_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 3. DOĞRULAMA — Tüm personel ve yönetici kayıtlarını listele
-- ═══════════════════════════════════════════════════════════════

-- Tüm departman grupları
SELECT full_name, department, contact_id, is_active FROM hotel_personnel ORDER BY department, full_name;

-- Tüm yetkili yöneticiler
SELECT name, telegram_id, role, is_active FROM authorized_managers ORDER BY name;
