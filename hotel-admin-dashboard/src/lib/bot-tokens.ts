import { getServiceSupabase } from './supabase-client';

export const KEMAL_GUEST_BOT_TOKEN = "8727716113:AAFuKlYDk1E3UebDtHVyrC6oYujOVQcVd1Q"; // otel_hesap_bot
export const KEMAL_MANAGER_BOT_TOKEN = "8727716113:AAFuKlYDk1E3UebDtHVyrC6oYujOVQcVd1Q"; // Fallback to guest bot if needed, or if he has a manager bot, but he didn't specify.

export const KEMAL_DEPARTMENT_BOTS: Record<string, string> = {
    'Resepsiyon': "8649076046:AAEZjsrhVJI8kG9RXlCdvNeZmISRvbVf7SY", // F/O
    'Housekeeping': "8766792609:AAGZBVrpfvkBWRVlqJWmTxGrRjLRT6KNRZc", // H/K
    'F&B (Gastro)': "8677398686:AAFhdxMNnET-UuqQiykBZOoT7thZkIbGLG0", // F/B
    'Yiyecek & İçecek (F&B)': "8677398686:AAFhdxMNnET-UuqQiykBZOoT7thZkIbGLG0", // F/B
    'Teknik Servis': "8624247316:AAGGVwA3RI54dryzaG2MWCWly1vIE0AHcR4", // T/S
    'Guest Relation': "8681065664:AAGt-oOzxty9bk1sF-10K2opHVCcyKqCfFE", // G/R
    'Misafir İlişkileri (Guest Relation)': "8681065664:AAGt-oOzxty9bk1sF-10K2opHVCcyKqCfFE", // G/R
};

// Aktif bot tokenlarını (Standart vs. Kemal Mode) döndüren yardımcı fonksiyon
export async function getActiveBotTokens() {
    try {
        const supabase = getServiceSupabase();
        const { data } = await supabase.from('hotel_settings').select('value').eq('key', 'general_settings').maybeSingle();
        const isKemalMode = data?.value?.kemal_presentation_mode === true;

        if (isKemalMode) {
            return {
                isKemalMode: true,
                GUEST_BOT: KEMAL_GUEST_BOT_TOKEN,
                MANAGER_BOT: KEMAL_MANAGER_BOT_TOKEN,
                getDepartmentBot: (dept: string) => {
                    return KEMAL_DEPARTMENT_BOTS[dept] || KEMAL_GUEST_BOT_TOKEN;
                }
            };
        }
    } catch (e) {
        console.error("Bot token error:", e);
    }

    // Default tokens from .env
    const DEFAULT_GUEST = process.env.TELEGRAM_GUEST_BOT_TOKEN || "";
    const DEFAULT_GA = process.env.TELEGRAM_GA_HOTEL_BOT_TOKEN || process.env.TELEGRAM_GUEST_BOT_TOKEN || "";
    
    return {
        isKemalMode: false,
        GUEST_BOT: DEFAULT_GUEST,
        MANAGER_BOT: process.env.TELEGRAM_MANAGER_BOT_TOKEN || DEFAULT_GUEST,
        getDepartmentBot: (dept: string) => {
            // Defaultta departman botları tek bir GA botu veya GUEST botu üzerinden yönetiliyordu
            return DEFAULT_GA;
        }
    };
}
