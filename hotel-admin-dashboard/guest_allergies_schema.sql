-- Alerjik misafirleri kalıcı olarak tutmak için SQL Tablosu
-- Bu kodu Supabase > SQL Editor alanına yapıştırıp "Run" sekmesine tıklayabilirsiniz.

CREATE TABLE IF NOT EXISTS public.guest_allergies (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    room_no text,
    guest_name text,
    allergy_details text,
    reported_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
    status text DEFAULT 'ACTIVE'
);

-- RLS (Row Level Security) ayarları (İhtiyaca bağlı; basitlik için devredışı/açık bırakılabilir)
-- ALTER TABLE public.guest_allergies ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Enable read access for all users" ON public.guest_allergies FOR SELECT USING (true);
-- CREATE POLICY "Enable insert access for all users" ON public.guest_allergies FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Enable update access for all users" ON public.guest_allergies FOR UPDATE USING (true);
