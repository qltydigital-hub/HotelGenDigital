-- PROJECT REVISION V1 MIGRATION (Comprehensive)
-- Objective: Align with Token-Optimized Project Revision Instructions

-- 1. ALLERGY PROTOCOL & GUEST DATA
ALTER TABLE requests ADD COLUMN IF NOT EXISTS allergies_dietary_needs TEXT;
ALTER TABLE guests ADD COLUMN IF NOT EXISTS permanent_allergies TEXT; -- Store for returning guests

-- 2. AUTH & SECURITY (staff_users table update)
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS password_hash TEXT; -- Store unique passwords
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS session_token TEXT; -- For multi-device control
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS last_activity TIMESTAMPTZ DEFAULT NOW(); -- For 5-min auto-logout

-- 3. DEMO ACCESS
-- Ensure specific demo accounts exist (uuid_generate_v4() or similar needed)
-- Note: Replace with actual hotel_id if multi-tenant active
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM staff_users WHERE full_name = 'OzgurOZEN') THEN
        INSERT INTO staff_users (id, full_name, role, password_hash)
        VALUES (gen_random_uuid(), 'OzgurOZEN', 'HOTEL_ADMIN', 'ozgur123'); -- Example initial password
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM staff_users WHERE full_name = 'KemalKUYUCU') THEN
        INSERT INTO staff_users (id, full_name, role, password_hash)
        VALUES (gen_random_uuid(), 'KemalKUYUCU', 'HOTEL_ADMIN', 'kemal123');
    END IF;
END $$;

-- 4. HOUSEKEEPING SYNC (Real-time room status)
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hotel_id UUID REFERENCES hotels(id) ON DELETE CASCADE,
    room_no VARCHAR(20) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'CLEAN', -- CLEAN, DIRTY, INSPECTED, OUT_OF_ORDER, REPAIR
    is_occupied BOOLEAN DEFAULT false,
    last_cleaned_at TIMESTAMPTZ DEFAULT NOW(),
    last_cleaned_by UUID REFERENCES staff_users(id),
    maintenance_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ALLERGY ALERTS (Instant notification log)
CREATE TABLE IF NOT EXISTS allergy_alerts (
    id BIGSERIAL PRIMARY KEY,
    guest_id UUID REFERENCES guests(id),
    room_no VARCHAR(20),
    allergy_details TEXT,
    notified_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_by UUID REFERENCES staff_users(id),
    status TEXT DEFAULT 'PENDING'
);

-- 6. INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_requests_ticket_id ON requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
CREATE INDEX IF NOT EXISTS idx_staff_last_activity ON staff_users(last_activity);

-- 7. SLA Presets per Department
ALTER TABLE departments ADD COLUMN IF NOT EXISTS sla_timeout_min INT DEFAULT 1; -- Default 1 minute

-- 8. Analytics & Reporting
ALTER TABLE requests ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE live_tickets ADD COLUMN IF NOT EXISTS failure_reason TEXT;

