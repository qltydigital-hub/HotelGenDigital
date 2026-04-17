/**
 * SKILL 1: Dashboard Logger
 * ─────────────────────────────────────────────────────────
 * Tüm misafir-bot konuşmalarını Supabase'e kaydeder.
 * Dashboard'da konuşma geçmişi gösterilir, SLA takibi yapılır.
 *
 * Kullanım:
 *   const { createDashboardLogger } = require('./skills/dashboard_logger');
 *   const saveMessageToDashboard = createDashboardLogger(supabase);
 *   await saveMessageToDashboard(chatId, 'user', 'Havlu istiyorum', 'Telegram');
 */

/**
 * Dashboard logger factory — Supabase istemcisini inject ederek
 * bağımsız, test edilebilir bir fonksiyon üretir.
 * 
 * @param {object|null} supabase - Supabase client instance
 * @returns {Function} saveMessageToDashboard fonksiyonu
 */
function createDashboardLogger(supabase) {
    /**
     * Mesajı Supabase chat_messages tablosuna kaydeder.
     * 
     * @param {string|number} chatId - Telegram/Platform chat ID
     * @param {string} role - 'user' | 'assistant' | 'system'
     * @param {string} text - Mesaj içeriği
     * @param {string} [platform='Telegram'] - Kaynak platform
     */
    return async function saveMessageToDashboard(chatId, role, text, platform = 'Telegram') {
        if (!supabase) {
            console.log(`📝 [DASHBOARD_LOG] (DB yok) [${platform}] ${role}: ${(text || '').substring(0, 80)}...`);
            return;
        }

        try {
            const { error } = await supabase.from('telegram_messages').insert({
                chat_id: String(chatId),
                bot_name: platform,
                role: role,
                text: text,
                platform: platform,
                created_at: new Date().toISOString()
            });

            if (error) {
                // Tablo yoksa sessizce devam et (critical olmayan hata)
                if (error.code === '42P01') {
                    console.warn(`⚠️ [DASHBOARD_LOG] chat_messages tablosu bulunamadı, mesaj loglanmadı.`);
                } else {
                    console.error(`[DASHBOARD_LOG] Kayıt hatası:`, error.message);
                }
            }
        } catch (e) {
            // Dashboard logger asla ana akışı bozmamalı
            console.error(`[DASHBOARD_LOG] İstisna:`, e.message);
        }
    };
}

module.exports = { createDashboardLogger };
