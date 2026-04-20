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
 *
 * KORUMALAR:
 * - Ağ kesilince (ENOTFOUND/ETIMEDOUT) Supabase/OpenAI çağrısı yapmaz
 * - Admin bildirimi flood koruması: aynı hata 30dk içinde bir kez bildirilir
 * - Supabase sorgusu 8 saniye timeout ile sınırlı
 */

const HEALTH_CHECK_INTERVAL = 30 * 60 * 1000; // 30 dakika
const ALERT_COOLDOWN_MS     = 30 * 60 * 1000; // Admin flood koruması: 30 dakika

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

    // Admin bildirim flood koruması: aynı hata 30dk içinde tekrar bildirilmez
    let lastAlertTime = 0;

    /**
     * İnternet bağlantısı yokken gereksiz yere Supabase/OpenAI çağrısı
     * yapmamak için önce Telegram'a erişimi kontrol et.
     * @returns {boolean} true = ağ var, false = ağ yok
     */
    async function isNetworkAvailable() {
        if (!bot || !bot.telegram) return true; // bilinmiyor, devam et
        try {
            await bot.telegram.getMe();
            return true;
        } catch (e) {
            const isNetErr = e.message && (
                e.message.includes('ENOTFOUND') ||
                e.message.includes('ETIMEDOUT') ||
                e.message.includes('ECONNREFUSED') ||
                e.message.includes('ECONNRESET') ||
                e.message.includes('network')
            );
            if (isNetErr) {
                console.warn(`🌐 [HEALTH] Ağ erişimi yok (${e.message}), bu tur health check atlanıyor.`);
                return false;
            }
            return true; // Telegram hatası ama ağ var, devam et
        }
    }

    async function runHealthCheck(silent = false) {
        const t0 = Date.now();
        results.errors = [];
        results.lastCheck = new Date().toISOString();

        // ── Ağ önkontrolü: ENOTFOUND döngüsünü önler ──────────────────────
        const networkOk = await isNetworkAvailable();
        if (!networkOk) {
            results.mainBot = 'FAIL: Ağ bağlantısı yok (ENOTFOUND/ETIMEDOUT)';
            results.supabase = 'SKIP: Ağ yok';
            results.openai   = 'SKIP: Ağ yok';
            results.errors.push('Ağ bağlantısı yok — Telegram, Supabase ve OpenAI erişilemiyor');
            console.warn('🔴 [HEALTH CHECK] Ağ erişimi yok, health check atlandı. İnternet bağlantısını kontrol edin.');
            return results;
        }

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

        // 2. Supabase Bağlantı Kontrolü (8sn timeout ile — fetch failed döngüsünü önler)
        if (supabase) {
            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Supabase sorgu zaman aşımı (8sn)')), 8000)
                );
                const queryPromise = supabase.from('hotel_settings').select('key').limit(1);
                const { error } = await Promise.race([queryPromise, timeoutPromise]);
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

        // ── Admin bildirimi — FLOOD KORUMALI ──────────────────────────────
        if (hasErrors && adminChatId && bot && bot.telegram) {
            const now = Date.now();
            if (now - lastAlertTime < ALERT_COOLDOWN_MS) {
                const remainMin = Math.round((ALERT_COOLDOWN_MS - (now - lastAlertTime)) / 60000);
                console.warn(`[HEALTH] Admin bildirimi cooldown'da (${remainMin} dk kaldı), bildirim atlandı.`);
            } else {
                lastAlertTime = now;
                const errorList = results.errors.map(e => `• ${e}`).join('\n');
                const alertMsg = `🔴 *SYSTEM ALERT — Sağlık Kontrolü*\n\n${results.errors.length} sorun tespit edildi:\n\n${errorList}\n\n⏰ Kontrol zamanı: ${new Date().toLocaleTimeString('tr-TR')}\n_Otomatik sağlık kontrolü (30dk periyot)_`;
                try {
                    await bot.telegram.sendMessage(adminChatId, alertMsg, { parse_mode: 'Markdown' });
                } catch (e) {
                    console.error('[HEALTH] Yönetici bildirimi gönderilemedi:', e.message);
                }
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
