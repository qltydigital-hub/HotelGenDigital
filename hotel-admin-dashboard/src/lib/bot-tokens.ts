import { getServiceSupabase } from './supabase-client';

// ═══════════════════════════════════════════════════════════════
// KEMAL KUYUCU — Yeni Bot Token (Tek Bot, Tüm Departmanlar)
// ═══════════════════════════════════════════════════════════════
export const KEMAL_GUEST_BOT_TOKEN = "8141780763:AAH2WlhlWFly6ralTFGIWkB-b88-Sw8O7Tc";
export const KEMAL_MANAGER_BOT_TOKEN = "8141780763:AAH2WlhlWFly6ralTFGIWkB-b88-Sw8O7Tc";

// Kemal'in tüm departmanları artık tek bot üzerinden çalışıyor
// Departman ayrımı telegram_config.json'daki chatId'ler ile yapılıyor
export const KEMAL_DEPARTMENT_BOTS: Record<string, string> = {
    'Resepsiyon': KEMAL_GUEST_BOT_TOKEN,
    'Housekeeping': KEMAL_GUEST_BOT_TOKEN,
    'F&B (Gastro)': KEMAL_GUEST_BOT_TOKEN,
    'Yiyecek & İçecek (F&B)': KEMAL_GUEST_BOT_TOKEN,
    'Teknik Servis': KEMAL_GUEST_BOT_TOKEN,
    'Guest Relation': KEMAL_GUEST_BOT_TOKEN,
    'Misafir İlişkileri (Guest Relation)': KEMAL_GUEST_BOT_TOKEN,
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
            return DEFAULT_GA;
        }
    };
}
