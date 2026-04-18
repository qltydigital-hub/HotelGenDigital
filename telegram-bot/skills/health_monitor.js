/**
 * HEALTH MONITOR — AI Agent Manager Skill
 * ─────────────────────────────────────────────────────────
 * Periyodik olarak tüm kritik bileşenleri kontrol eder:
 *  1. OpenAI API key geçerliliği
 *  2. Supabase bağlantısı
 *  3. Telegram bot durumları
 *
 * Sorun tespit edildiğinde yöneticiye Telegram bildirimi gönderir.
 * Her 30 dakikada bir otomatik çalışır + bot başlangıcında 1 kez çalışır.
 */

const HEALTH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 dakika

/**
 * @param {object} opts
 * @param {object} opts.openai - OpenAI client
 * @param {object} opts.supabase - Supabase client
 * @param {object} opts.bot - Ana Telegraf bot instance
 * @param {object[]} opts.secondaryBots - İkincil botlar
 * @param {string} opts.adminChatId - Yöneticinin Telegram chat ID'si
 */
function createHealthMonitor({ openai, supabase, bot, secondaryBots = [], adminChatId }) {
    const results = {
        lastCheck: null,
        openai: 'unknown',
        supabase: 'unknown',
        mainBot: 'unknown',
        secondaryBots: [],
        errors: []
    };

    async function runHealthCheck(silent = false) {
        const t0 = Date.now();
        results.errors = [];
        results.lastCheck = new Date().toISOString();

        // 1. OpenAI API Key Kontrolü
        if (openai) {
            try {
                await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 3
                });
                results.openai = 'OK';
            } catch (e) {
                results.openai = `FAIL: ${e.message}`;
                results.errors.push(`OpenAI: ${e.message}`);
            }
        } else {
            results.openai = 'NOT_CONFIGURED';
            results.errors.push('OpenAI client başlatılmamış');
        }

        // 2. Supabase Bağlantı Kontrolü
        if (supabase) {
            try {
                const { data, error } = await supabase.from('hotel_settings').select('key').limit(1);
                if (error) throw new Error(error.message);
                results.supabase = 'OK';
            } catch (e) {
                results.supabase = `FAIL: ${e.message}`;
                results.errors.push(`Supabase: ${e.message}`);
            }
        } else {
            results.supabase = 'NOT_CONFIGURED';
            results.errors.push('Supabase client başlatılmamış');
        }

        // 3. Ana Bot Kontrolü
        if (bot && bot.telegram) {
            try {
                const me = await bot.telegram.getMe();
                results.mainBot = `OK (@${me.username})`;
            } catch (e) {
                results.mainBot = `FAIL: ${e.message}`;
                results.errors.push(`Ana Bot: ${e.message}`);
            }
        }

        // 4. İkincil Bot Kontrolü
        results.secondaryBots = [];
        for (const sb of secondaryBots) {
            try {
                const me = await sb.telegram.getMe();
                results.secondaryBots.push({ name: sb._managerName, status: `OK (@${me.username})` });
            } catch (e) {
                results.secondaryBots.push({ name: sb._managerName || '?', status: `FAIL: ${e.message}` });
                results.errors.push(`Bot ${sb._managerName}: ${e.message}`);
            }
        }

        const elapsed = Date.now() - t0;
        const hasErrors = results.errors.length > 0;

        // Konsola rapor
        if (hasErrors) {
            console.error(`🔴 [HEALTH CHECK] ${results.errors.length} SORUN TESPİT EDİLDİ (${elapsed}ms):`);
            results.errors.forEach(e => console.error(`   ↳ ${e}`));
        } else if (!silent) {
            console.log(`✅ [HEALTH CHECK] Tüm sistemler çalışıyor (${elapsed}ms)`);
        }

        // Sorun varsa yöneticiye bildirim
        if (hasErrors && adminChatId && bot && bot.telegram) {
            const errorList = results.errors.map(e => `• ${e}`).join('\n');
            const alertMsg = `🔴 *SYSTEM ALERT — Sağlık Kontrolü*\n\n${results.errors.length} sorun tespit edildi:\n\n${errorList}\n\n⏰ Kontrol zamanı: ${new Date().toLocaleTimeString('tr-TR')}\n_Otomatik sağlık kontrolü (30dk periyot)_`;
            try {
                await bot.telegram.sendMessage(adminChatId, alertMsg, { parse_mode: 'Markdown' });
            } catch (e) {
                console.error('[HEALTH] Yönetici bildirimi gönderilemedi:', e.message);
            }
        }

        return results;
    }

    // Periyodik kontrol başlat
    function startPeriodicCheck() {
        // İlk kontrol: 10 saniye sonra (bot başlarken diğer bileşenlerin de hazır olmasını bekle)
        setTimeout(() => runHealthCheck(false), 10000);
        
        // Sonraki kontroller: Her 30 dakikada bir (sessiz mod — sadece sorunlarda log basılır)
        setInterval(() => runHealthCheck(true), HEALTH_CHECK_INTERVAL);
        
        console.log(`🩺 [HEALTH MONITOR] Periyodik sağlık kontrolü aktif (${HEALTH_CHECK_INTERVAL / 60000} dk aralıkla)`);
    }

    return { runHealthCheck, startPeriodicCheck, results };
}

module.exports = { createHealthMonitor };
