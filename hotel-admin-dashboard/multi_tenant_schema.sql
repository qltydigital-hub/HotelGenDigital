-- 1. OTELLER (HOTELS) TABLOSU
-- (Eğer tablo zaten varsa hata vermemesi için IF NOT EXISTS ekledik)
CREATE TABLE IF NOT EXISTS hotels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    domain TEXT UNIQUE, 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. DOKÜMANLAR (HOTEL DOCUMENTS) TABLOSU
-- (FO, SPA vs. belgeleri kaydedeceğimiz tablo)
CREATE TABLE IF NOT EXISTS hotel_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hotel_id UUID NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
    department TEXT NOT NULL,
    doc_type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS (Güvenlik) Ayarını Açalım
ALTER TABLE hotel_documents ENABLE ROW LEVEL SECURITY;

-- Eğer mevcut bir policy varsa silinmesi için (hata vermemek adına):
DROP POLICY IF EXISTS "Sadece kendi otellerinin dökümanlarını görebilir" ON hotel_documents;

-- Tabloya herkesin okuma ve yazma yapabilmesini şimdilik sağlayalım (Geliştirme süreci için):
CREATE POLICY "Herkese açık doküman okuma" ON hotel_documents FOR SELECT USING (true);
CREATE POLICY "Herkese açık doküman yazma" ON hotel_documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkese açık doküman güncelleme" ON hotel_documents FOR UPDATE USING (true);

-- Otel verilerini girmeden önce temizleyelim (Aynı otel 2 kere girmesin diye)
-- Varsa Rixos ve Titanic'i oluştur:
INSERT INTO hotels (id, name, domain) 
VALUES 
('11111111-1111-1111-1111-111111111111', 'Rixos (Hotel A)', 'rixos'),
('22222222-2222-2222-2222-222222222222', 'Titanic (Hotel B)', 'titanic')
ON CONFLICT (id) DO NOTHING;

-- 3. STORAGE İZİNLERİ (Sizin elinizle yapacağınız yeri KODLA yapıyoruz)
-- hotel-documents kovasına yetki vermek için arka plan SQL kodları
-- Herkes dosya yükleyebilir, görüntüleyebilir, silebilir ve güncelleyebilir.

CREATE POLICY "Give public access to hotel_documents" ON storage.objects FOR SELECT USING (bucket_id = 'hotel-documents');
CREATE POLICY "Give public insert to hotel_documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'hotel-documents');
CREATE POLICY "Give public update to hotel_documents" ON storage.objects FOR UPDATE USING (bucket_id = 'hotel-documents');
CREATE POLICY "Give public delete to hotel_documents" ON storage.objects FOR DELETE USING (bucket_id = 'hotel-documents');
