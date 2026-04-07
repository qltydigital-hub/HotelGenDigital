-- Eksik sütunları (Özellikle Kişi Sayısı) In-House tablona eklemek için Supabase'de SQL Editör üzerinde bu komutları çalıştır:

ALTER TABLE in_house_guests ADD COLUMN IF NOT EXISTS guest_count INT DEFAULT 2;
