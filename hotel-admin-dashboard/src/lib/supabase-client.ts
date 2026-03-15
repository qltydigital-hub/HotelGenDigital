// src/lib/supabase-client.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ─── Tip Tanımları ─────────────────────────────────────────────────────
export type TelegramMessage = {
    id?: number;
    chat_id: string;
    bot_name: string;
    role: 'user' | 'assistant' | 'dashboard' | 'system';
    text: string;
    platform: string;
    intent?: string | null;
    department?: string | null;
    is_alerjen?: boolean;
    ticket_id?: string | null;
    created_at?: string;
};

export type LiveTicket = {
    id?: number;
    ticket_id: string;
    chat_id?: string;
    room_no?: string;
    guest_name?: string;
    department?: string;
    status: 'OPEN' | 'ESCALATED' | 'ACKED' | 'RESOLVED' | 'CRITICAL';
    priority?: 'NORMAL' | 'HIGH' | 'CRITICAL';
    description?: string;
    is_alerjen?: boolean;
    created_at?: string;
    updated_at?: string;
};

export type SystemLog = {
    id?: number;
    level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    source: string;
    message: string;
    metadata?: Record<string, any>;
    created_at?: string;
};

// ─── Client Tarafı (public) ─────────────────────────────────────────────
// Browser'da Realtime subscription için kullanılır
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
        params: { eventsPerSecond: 10 }
    }
});

// ─── Server Tarafı (service role — RLS bypass) ──────────────────────────
// Sadece API route'larında, webhook'larda kullanılır
export function getServiceSupabase() {
    return createClient(supabaseUrl, supabaseServiceKey || supabaseAnonKey);
}

// ─── Yükleme İşlemleri (Storage & Database) ──────────────────────────────

/** Belgeyi (PDF, Excel, Görsel vb.) Storage'a yükler ve veritabanına kaydeder */
export async function uploadDocumentToSupabase(
    file: File, 
    department: string, 
    docType: string, 
    hotelId: string = '11111111-1111-1111-1111-111111111111' // Şimdilik Rixos örnek ID
): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${hotelId}/${department}/${docType}_${Date.now()}.${fileExt}`;
        
        // 1. Storage'a Yükle (hotel-documents kovasına)
        const { error: storageError } = await supabase
            .storage
            .from('hotel-documents')
            .upload(fileName, file, { cacheControl: '3600', upsert: true });

        if (storageError) {
            console.error('Storage Hatası:', storageError.message);
            return { success: false, error: storageError.message };
        }

        // 2. Herkese Açık Linkini Al
        const { data: { publicUrl } } = supabase
            .storage
            .from('hotel-documents')
            .getPublicUrl(fileName);

        // 3. Veritabanına (hotel_documents) Bu Yüklemeyi Kaydet
        const { error: dbError } = await supabase
            .from('hotel_documents')
            .insert({
                hotel_id: hotelId,
                department: department,
                doc_type: docType,
                file_url: publicUrl,
                file_name: file.name
            });

        if (dbError) {
            console.error('Veritabanı Kayıt Hatası:', dbError.message);
            // Tablo henüz yoksa bile sistemin çökmemsi için false dönüyoruz
            return { success: false, error: dbError.message };
        }

        return { success: true, url: publicUrl };

    } catch (err: any) {
        return { success: false, error: err.message };
    }
}

// ─── Yardımcı Fonksiyonlar ───────────────────────────────────────────────

/** Telegram mesajını Supabase'e kaydet */
export async function saveMessageToSupabase(msg: TelegramMessage): Promise<boolean> {
    const client = getServiceSupabase();
    const { error } = await client.from('telegram_messages').insert(msg);
    if (error) {
        console.error('[Supabase] Mesaj kayıt hatası:', error.message);
        return false;
    }
    return true;
}

/** LiveTicket oluştur veya güncelle */
export async function upsertTicket(ticket: LiveTicket): Promise<boolean> {
    const client = getServiceSupabase();
    const { error } = await client
        .from('live_tickets')
        .upsert({ ...ticket, updated_at: new Date().toISOString() }, { onConflict: 'ticket_id' });
    if (error) {
        console.error('[Supabase] Ticket kayıt hatası:', error.message);
        return false;
    }
    return true;
}

/** Sistem logu yaz */
export async function writeLog(level: SystemLog['level'], source: string, message: string, metadata?: Record<string, any>): Promise<void> {
    const client = getServiceSupabase();
    await client.from('system_logs').insert({ level, source, message, metadata });
}

/** Belirli bir chat_id'nin mesajlarını çek */
export async function getMessagesForChat(chatId: string, limit = 50): Promise<TelegramMessage[]> {
    const client = getServiceSupabase();
    const { data, error } = await client
        .from('telegram_messages')
        .select('*')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(limit);
    if (error) return [];
    return data as TelegramMessage[];
}

/** Son N sistem logu çek */
export async function getRecentLogs(limit = 50): Promise<SystemLog[]> {
    const client = getServiceSupabase();
    const { data, error } = await client
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return data as SystemLog[];
}

/** Açık ticket'ları çek */
export async function getOpenTickets(): Promise<LiveTicket[]> {
    const client = getServiceSupabase();
    const { data, error } = await client
        .from('live_tickets')
        .select('*')
        .not('status', 'eq', 'RESOLVED')
        .order('created_at', { ascending: false })
        .limit(20);
    if (error) return [];
    return data as LiveTicket[];
}
