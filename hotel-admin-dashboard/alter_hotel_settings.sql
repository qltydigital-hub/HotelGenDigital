-- Daha önce oluşturulan hotel_settings tablosundaki veri tipini JSON tabanlı olarak esnetmek ve diğer verileri saklayabilmek için tabloda gerekli genişletmeler
ALTER TABLE hotel_settings 
ADD COLUMN IF NOT EXISTS key VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS value JSONB;
