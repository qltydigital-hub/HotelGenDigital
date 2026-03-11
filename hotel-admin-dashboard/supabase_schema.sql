-- Supabase Multi-Tenant Hotel Automation Schema

-- 1. ENUMS (Sabit Değerler)
CREATE TYPE request_status AS ENUM ('OPEN', 'AWAITING_GUEST_INFO', 'ROUTED', 'ACKED', 'RESOLVED', 'CANCELLED', 'ESCALATED');
CREATE TYPE priority_level AS ENUM ('NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE channel_type AS ENUM ('INSTAGRAM', 'WHATSAPP', 'TELEGRAM', 'MANYCHAT');
CREATE TYPE staff_role AS ENUM ('PLATFORM_ADMIN', 'HOTEL_ADMIN', 'RECEPTION', 'DEPARTMENT_HEAD', 'MANAGER');

-- 2. CORE TENANT TABLES
-- Her otel bir tenant'tır. Tüm veriler hotel_id ile izole edilmelidir (RLS).
CREATE TABLE hotels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    timezone VARCHAR(50) DEFAULT 'Europe/Istanbul',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Hotel Kanalları Config (ManyChat vb. ID'leri. Şifreler dashboard'da şifreli tutulmalı projede)
CREATE TABLE hotel_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    bot_name VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 3. DEPARTMAN ve PERSONEL
CREATE TABLE departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE department_working_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    department_id UUID REFERENCES departments(id) ON DELETE CASCADE,
    day_of_week INT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0 = Sunday
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    UNIQUE (department_id, day_of_week)
);

-- Users (Supabase Auth ile senkron çalışır, role-based yetki ayarı sağlar)
CREATE TABLE staff_users (
    id UUID PRIMARY KEY, -- REFERENCES auth.users(id)
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    full_name VARCHAR(255) NOT NULL,
    role staff_role NOT NULL,
    whatsapp_id VARCHAR(50),
    telegram_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 4. MISAFIR, KONAKLAMA ve ILETISIM
CREATE TABLE guests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    preferred_lang VARCHAR(10) DEFAULT 'tr',
    phone_number VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(hotel_id, phone_number)
);

CREATE TABLE stays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE CASCADE,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    room_no VARCHAR(20),
    checkin_date DATE NOT NULL,
    checkout_date DATE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    channel channel_type NOT NULL,
    external_user_id VARCHAR(255) NOT NULL, -- ManyChat Subscriber ID vs.
    last_lang VARCHAR(10),
    last_message_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(channel, external_user_id)
);

-- 5. TALEP (REQUEST) YONETIMI
CREATE TABLE requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id VARCHAR(20) UNIQUE NOT NULL, -- Örn: HTL-2023-001
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    guest_id UUID REFERENCES guests(id) ON DELETE SET NULL,
    stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    topic TEXT NOT NULL,
    description TEXT,
    priority priority_level DEFAULT 'NORMAL',
    status request_status DEFAULT 'OPEN',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    ack_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    cancel_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE request_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'CREATED', 'ROUTED', 'ACKED', 'ESCALATED', 'REPLY', 'RESOLVED', 'CANCELLED'
    notes TEXT,
    executed_by_staff UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    event_time TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE reception_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES requests(id) ON DELETE CASCADE,
    note TEXT NOT NULL,
    created_by UUID REFERENCES staff_users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 6. BİLGİ BANKASI (KNOWLEDGE BASE) ve ANKET (SURVEY)
CREATE TABLE knowledge_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    doc_type VARCHAR(50), -- 'MENU', 'MAP', 'GENERAL', 'POLICY'
    storage_path TEXT, -- Supabase Storage URL
    content_text TEXT, -- Metin formatı (AI indexleme için)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    questions JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE TABLE survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID REFERENCES surveys(id) ON DELETE CASCADE,
    stay_id UUID REFERENCES stays(id) ON DELETE SET NULL,
    responses JSONB NOT NULL,
    satisfaction_score INT CHECK (satisfaction_score BETWEEN 1 AND 5),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- 1. Tüm tablolarda RLS Aktifleştir
ALTER TABLE hotels ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_working_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stays ENABLE ROW LEVEL SECURITY;
ALTER TABLE requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_documents ENABLE ROW LEVEL SECURITY;

-- 2. Hotels (Platform Adminleri hariç sadece otel kullanıcıları kendi otelini görür)
CREATE POLICY "Users can view their own hotel" ON hotels
    FOR SELECT USING (
        id IN (SELECT hotel_id FROM staff_users WHERE staff_users.id = auth.uid())
    );

-- 3. Genel Tenant Politikası Şablonu (department, staff_users, guests vs. için)
-- Herkes sadece kendi auth tokenında (veya staff_users) olan hotel_id ile eşleşen kayıtları görebilir
CREATE POLICY "Tenant Isolation Policy" ON departments
    FOR ALL USING (
        hotel_id IN (SELECT hotel_id FROM staff_users WHERE staff_users.id = auth.uid())
    );

-- (NOT: Prod ortamına geçerken bu RLS kuralları her tablo için Platform Admin / Otel Admin olarak role göre detaylandırılır.)
