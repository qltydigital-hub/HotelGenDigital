-- =====================================================
-- MUTFAK PERSONELİ & ALERJİ YÖNETİM SİSTEMİ
-- The Green Park Gaziantep
-- =====================================================
-- Bu kodu Supabase > SQL Editor alanına yapıştırıp "Run" sekmesine tıklayın.

-- 1. MUTFAK PERSONELİ TABLOSU
-- Mutfak şefleri, amirleri ve sorumlularının tanımlanması
CREATE TABLE IF NOT EXISTS public.kitchen_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'asci',  -- 'sef', 'amir', 'mudur', 'asci'
    department TEXT DEFAULT 'MUTFAK',
    telegram_chat_id TEXT,
    whatsapp_id TEXT,
    is_active BOOLEAN DEFAULT true,
    notification_priority INTEGER DEFAULT 0,  -- 0=normal, 1=kritik alerjilerde bilgilendir
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. GENİŞLETİLMİŞ ALERJİ KAYITLARI TABLOSU
-- Eski guest_allergies tablosunun yerine gelişmiş versiyon
CREATE TABLE IF NOT EXISTS public.guest_allergy_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_name TEXT NOT NULL,
    room_number TEXT NOT NULL,
    checkin_date DATE,
    checkout_date DATE,
    allergy_info TEXT NOT NULL,
    severity TEXT DEFAULT 'NORMAL',     -- NORMAL | CIDDI | KRITIK
    telegram_chat_id TEXT,
    whatsapp_id TEXT,
    responsible_staff_id UUID REFERENCES public.kitchen_staff(id),
    notified_departments TEXT[] DEFAULT '{}',  -- Hangi departmanlara bildirim gitti
    status TEXT DEFAULT 'ACTIVE',       -- ACTIVE | ARCHIVED
    reported_at TIMESTAMPTZ DEFAULT NOW(),
    archived_at TIMESTAMPTZ,
    notes TEXT,                          -- Ek notlar (ör: çocuk alerjisi, spesifik detay)
    UNIQUE(guest_name, room_number, allergy_info)
);

-- 3. ALERJİ BİLDİRİM LOGLARI
-- Her bildirim olayını takip eder
CREATE TABLE IF NOT EXISTS public.allergy_notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    allergy_record_id UUID REFERENCES public.guest_allergy_records(id),
    notified_to TEXT NOT NULL,           -- Kişi/departman adı
    notification_type TEXT NOT NULL,     -- TELEGRAM | WHATSAPP | PANEL
    status TEXT DEFAULT 'SENT',          -- SENT | FAILED | READ
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. OTOMATİK ARŞİVLEME FONKSİYONU
-- Check-out tarihi geçmiş misafirlerin alerji kayıtlarını otomatik arşivler
CREATE OR REPLACE FUNCTION archive_checked_out_allergies()
RETURNS void AS $$
BEGIN
    UPDATE public.guest_allergy_records
    SET status = 'ARCHIVED', archived_at = NOW()
    WHERE status = 'ACTIVE'
    AND checkout_date IS NOT NULL
    AND checkout_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- 5. GÜNLÜK OTOMATİK ARŞİVLEME İÇİN CRON JOB (İsteğe bağlı)
-- Supabase pg_cron extension etkinse kullanılabilir:
-- SELECT cron.schedule('archive-allergies', '0 13 * * *', 'SELECT archive_checked_out_allergies()');

-- 6. RLS POLİTİKALARI (Güvenlik)
ALTER TABLE public.kitchen_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_allergy_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allergy_notification_logs ENABLE ROW LEVEL SECURITY;

-- Service role key ile tam erişim (bot ve admin panel)
CREATE POLICY "Service role full access on kitchen_staff" ON public.kitchen_staff USING (true);
CREATE POLICY "Service role full access on guest_allergy_records" ON public.guest_allergy_records USING (true);
CREATE POLICY "Service role full access on allergy_notification_logs" ON public.allergy_notification_logs USING (true);

-- 7. ÖRNEK VERİ (Test için)
INSERT INTO public.kitchen_staff (full_name, role, department, telegram_chat_id, notification_priority)
VALUES 
    ('Ahmet Şef', 'sef', 'MUTFAK', NULL, 1),
    ('Mehmet Usta', 'asci', 'MUTFAK', NULL, 0)
ON CONFLICT DO NOTHING;
