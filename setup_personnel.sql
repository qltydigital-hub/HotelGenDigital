-- DEPARTMAN YETKİLİLERİNİ GÜNCELLE
-- Bu script, Telegram Chat ID'lerini ilgili departmanlara atar.

-- Önce temizleyelim (isteğe bağlı, veya sadece güncelleme yapılabilir)
-- DELETE FROM hotel_personnel;

INSERT INTO hotel_personnel (full_name, department, platform, contact_id, is_active)
VALUES 
('Housekeeping Dept', 'HOUSEKEEPING', 'TELEGRAM', '-5146686704', true),
('Technical Service Dept', 'TEKNIK', 'TELEGRAM', '-5109602342', true),
('Food & Beverage Dept', 'F&B', 'TELEGRAM', '-5272206709', true),
('Front Office Dept', 'RESEPSIYON', 'TELEGRAM', '-5166737146', true),
('Guest Relations Dept', 'GUEST_RELATIONS', 'TELEGRAM', '-5193711765', true)
ON CONFLICT (department, contact_id) 
DO UPDATE SET is_active = true;

-- Kontrol
SELECT * FROM hotel_personnel;
