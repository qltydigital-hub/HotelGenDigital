-- 1. OTELLER (HOTELS) TABLOSU
-- Sistemdeki her bir otelin (Hotel A, Hotel B vb.) kimliğini tutar.
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, -- İleride oteli domain adından tanımak için
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. DOKÜMANLAR (HOTEL DOCUMENTS) TABLOSU
-- F/O, F/B gibi departmanların yüklediği tüm dosyaların kalıcı listesini tutar.
-- "hotel_id" kolonu sayesinde hangi dosyanın hangi otele ait olduğu duvarlarla örülür.
CREATE TABLE hotel_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    department TEXT NOT NULL, -- Örn: 'FO', 'FB', 'SPA'
    doc_type TEXT NOT NULL, -- Örn: 'inhouse', 'factsheet', 'menus'
    file_url TEXT NOT NULL, -- Storage'daki dosyanın erişim linki
    file_name TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. GÜVENLİK DUVARI (ROW LEVEL SECURITY - RLS) AKTİVASYONU
-- Bu politikalar sayesinde Hotel A, sadece kendi hotel_id'sine sahip kayıtları görebilecek.
ALTER TABLE hotel_documents ENABLE ROW LEVEL SECURITY;

-- Örnek bir Güvenlik Politikası (Gerçek auth sisteminde jwt'den gelen hotel_id'ye eşitse izin verilir):
CREATE POLICY "Sadece kendi otellerinin dökümanlarını görebilir"
ON hotel_documents
FOR SELECT
USING (
    hotel_id = auth.jwt()->>'user_hotel_id'
);

-- Örnek veri (Sistemi test etmek için örnek iki otel)
INSERT INTO hotels (id, name, domain) VALUES 
('11111111-1111-1111-1111-111111111111', 'Rixos (Hotel A)', 'rixos'),
('22222222-2222-2222-2222-222222222222', 'Titanic (Hotel B)', 'titanic');
