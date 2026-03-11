-- Resepsiyon tarafından yüklenen günlük In-House (Konaklayan) listesini tutacak tablo.
-- Her Excel yüklendiğinde eski kayıtlar silinip (veya güncellenip) yenileri eklenebilir.

CREATE TABLE IF NOT EXISTS in_house_guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    room_number VARCHAR(20) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    language VARCHAR(10) DEFAULT 'tr',
    checkin_date DATE,
    checkout_date DATE NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(hotel_id, room_number, first_name, last_name) -- Aynı kişiyi tekrar eklemeyi önlemek için
);

-- RLS (Row Level Security) Politikaları
ALTER TABLE in_house_guests ENABLE ROW LEVEL SECURITY;

-- Okuma Politikası (Sadece kendi oteline ait verileri görebilme)
CREATE POLICY "Users can view in_house_guests for their hotel" ON in_house_guests
    FOR SELECT USING (
        hotel_id IN (SELECT hotel_id FROM staff_users WHERE staff_users.id = auth.uid()) OR 
        hotel_id IS NOT NULL -- Auth kullanmadığımız bot api vs için şimdilik admin/anon key ile okumaya açık olabilir (ya da service_role key kullanarak atlanabilir)
    );

-- Ekleme/Güncelleme/Silme Politikası (Şimdilik service_role key kullanarak API'den bypass edileceği için RLS policy şart değil ama ileride auth eklendiğinde kullanılabilir)
