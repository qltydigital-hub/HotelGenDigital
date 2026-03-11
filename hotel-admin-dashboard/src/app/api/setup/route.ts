// src/app/api/setup/route.ts
// Supabase tablolarını otomatik oluşturur
// POST /api/setup  → tabloları create eder (Supabase pg üzerinden)
// GET  /api/setup  → tablo durumunu kontrol eder

import { NextResponse } from 'next/server';
import { getServiceSupabase, writeLog } from '@/lib/supabase-client';

const TABLES = ['telegram_messages', 'live_tickets', 'system_logs'] as const;

// ─── GET: Tablo durumu kontrol ──────────────────────────────────
export async function GET() {
    const client = getServiceSupabase();
    const status: Record<string, boolean> = {};

    for (const table of TABLES) {
        try {
            const { error } = await client.from(table).select('id').limit(1);
            status[table] = !error;
        } catch {
            status[table] = false;
        }
    }

    const allReady = Object.values(status).every(Boolean);
    return NextResponse.json({ ready: allReady, tables: status });
}

// ─── POST: Tabloları oluştur ─────────────────────────────────────
export async function POST() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Supabase PostgreSQL REST endpoint üzerinden SQL çalıştır
    const sql = `
-- telegram_messages
CREATE TABLE IF NOT EXISTS telegram_messages (
    id          BIGSERIAL PRIMARY KEY,
    chat_id     TEXT NOT NULL,
    bot_name    TEXT NOT NULL DEFAULT 'guest_bot',
    role        TEXT NOT NULL DEFAULT 'user',
    text        TEXT NOT NULL,
    platform    TEXT NOT NULL DEFAULT 'Telegram',
    intent      TEXT,
    department  TEXT,
    is_alerjen  BOOLEAN DEFAULT FALSE,
    ticket_id   TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- live_tickets
CREATE TABLE IF NOT EXISTS live_tickets (
    id          BIGSERIAL PRIMARY KEY,
    ticket_id   TEXT UNIQUE NOT NULL,
    chat_id     TEXT,
    room_no     TEXT DEFAULT 'Bilinmiyor',
    guest_name  TEXT DEFAULT 'Misafir',
    department  TEXT,
    status      TEXT NOT NULL DEFAULT 'OPEN',
    priority    TEXT NOT NULL DEFAULT 'NORMAL',
    description TEXT,
    is_alerjen  BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- system_logs
CREATE TABLE IF NOT EXISTS system_logs (
    id          BIGSERIAL PRIMARY KEY,
    level       TEXT NOT NULL DEFAULT 'INFO',
    source      TEXT NOT NULL DEFAULT 'system',
    message     TEXT NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime
ALTER TABLE telegram_messages REPLICA IDENTITY FULL;
ALTER TABLE live_tickets REPLICA IDENTITY FULL;
ALTER TABLE system_logs REPLICA IDENTITY FULL;

-- RLS
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'telegram_messages' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON telegram_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE live_tickets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'live_tickets' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON live_tickets FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_logs' AND policyname = 'Allow all for now') THEN
    CREATE POLICY "Allow all for now" ON system_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

    try {
        // Supabase Management API üzerinden SQL çalıştır
        const projectRef = supabaseUrl.replace('https://', '').split('.')[0];
        const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ query: sql }),
        });

        let apiResult: any = null;
        try { apiResult = await res.json(); } catch { }

        // Management API başarısız olsa bile, tablo varlığını kontrol et
        const client = getServiceSupabase();
        const tableResults: Record<string, string> = {};

        for (const table of TABLES) {
            const { error } = await client.from(table).select('id').limit(1);
            if (!error) {
                tableResults[table] = 'OK ✅';
            } else if (error.code === '42P01') {
                tableResults[table] = 'EKSİK — Supabase SQL Editor\'i kullanın';
            } else {
                tableResults[table] = `Durum: ${error.message}`;
            }
        }

        // Test logu yaz (tablo varsa)
        if (tableResults['system_logs'] === 'OK ✅') {
            await writeLog('SUCCESS', 'Setup', 'GuestFlow AI Supabase kurulumu tamamlandı 🎉');
        }

        return NextResponse.json({
            api_response: apiResult,
            tables: tableResults,
            sql_used: sql.substring(0, 200) + '...',
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
