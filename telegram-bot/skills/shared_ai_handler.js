/**
 * SHARED AI HANDLER — Tüm Platformlarda Ortak Kullanım
 * ──────────────────────────────────────────────────────
 * Telegram / WhatsApp / Instagram / Web Chat
 * Her platform bu modülü çağırır → aynı model, aynı hız, aynı kurallar.
 *
 * Sabit Kurallar:
 *  1. Model: gpt-4o-mini (hız öncelikli)
 *  2. Dil: kullanıcı hangi dilde yazarsa o dilde yanıt
 *  3. Lokasyon: link + açıklama formatı
 *  4. Rezervasyon: önce otel web sitesi (sıra #1 sabit)
 *  5. IBAN: sadece açık talep olduğunda
 */

const { getPromptForDepartment } = require('./prompts/index');
const { getRelevantKnowledge } = require('./knowledge/index');

const MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 600;

/**
 * Platform-agnostic AI mesaj işleyici.
 *
 * @param {object} opts
 * @param {string}  opts.userText    - Kullanıcı mesajı
 * @param {object}  opts.openai      - OpenAI client instance
 * @param {object}  [opts.supabase]  - Supabase client (opsiyonel)
 * @param {object}  [opts.session]   - Misafir oturum verisi
 * @param {string}  [opts.platform]  - 'telegram' | 'whatsapp' | 'instagram' | 'web'
 * @returns {Promise<{reply: string, isRequest: boolean, department: string}>}
 */
async function sharedAIHandler({ userText, openai, supabase = null, session = null, platform = 'telegram' }) {
    if (!openai) return { reply: 'AI servisi şu an kullanılamıyor.', isRequest: false, department: 'RESEPSIYON' };

    const lower = userText.toLowerCase();
    const t0 = Date.now();

    // ── Parallel DB Sorguları ─────────────────────────────────────────
    let locationData = null;
    let agencyData = null;
    let ibanData = null;
    let targetDepartment = 'RESEPSIYON';

    if (supabase) {
        // ÇOK DİLLİ KONUM ANAHTAR KELİMELERİ
        const locKeywords = [
            // Türkçe
            'konum', 'lokasyon', 'nerede', 'adres', 'nasıl gelirim', 'navigasyon', 'harita', 'yol tarifi', 'ulaşım', 'neredesiniz', 'yol',
            // İngilizce
            'location', 'where', 'directions', 'map', 'address', 'how to get', 'how do i get',
            // Almanca
            'wo', 'wie komme', 'adresse', 'standort', 'wegbeschreibung', 'anfahrt',
            // Rusça
            'местоположение', 'адрес', 'как добраться', 'где находится', 'где',
            // Fransızca
            'où', 'comment venir', 'emplacement', 'adresse', 'itinéraire',
            // Arapça
            'الموقع', 'العنوان', 'كيف أصل', 'أين',
            // İspanyolca
            'ubicación', 'dirección', 'cómo llegar', 'dónde'
        ];

        // ÇOK DİLLİ REZERVASYON ANAHTAR KELİMELERİ
        const agencyKeywords = [
            'rezervasyon', 'acenta', 'acente', 'booking', 'fiyat', 'oda', 'oda fiyat', 
            'room', 'price', 'reserve', 'reservation', 'zimmer', 'preis',
            'бронирование', 'номер', 'цена',           // Rusça
            'réservation', 'chambre', 'prix',            // Fransızca
            'حجز', 'غرفة', 'سعر',                       // Arapça
            'reserva', 'habitación', 'precio'            // İspanyolca
        ];

        const ibanKeywords = ['iban', 'havale', 'eft', 'banka hesab', 'hesap numar', 'para gönder', 'transfer', 'bank account', 'wire transfer'];

        // GENİŞLETİLMİŞ ÇOK DİLLİ TEŞEKKÜR KELİMELERİ
        const thankKeywords = [
            // Türkçe
            'teşekkür', 'tesekkur', 'sağ ol', 'tamam', 'anladım', 'harika', 'güzel', 'aldım', 'süper', 'mükemmel', 'gördüm',
            // İngilizce
            'ok', 'thank', 'thanks', 'thank you', 'got it', 'great', 'perfect', 'wonderful', 'awesome', 'noted',
            // Almanca
            'danke', 'danke schön', 'vielen dank', 'alles klar', 'verstanden',
            // Rusça
            'спасибо', 'благодарю', 'понял', 'понятно', 'хорошо',
            // Fransızca
            'merci', 'merci beaucoup', 'compris', 'parfait', "d'accord",
            // Arapça
            'شكرا', 'شكراً', 'تمام', 'حسناً',
            // İspanyolca
            'gracias', 'entendido', 'perfecto'
        ];

        // ÇOK DİLLİ TALEP KELİMELERİ (teşekkürden ayırt etme)
        const requestWords = [
            'nerede', 'nasıl', 'ver', 'gönder', 'istiyorum', '?',
            'where', 'how', 'send', 'give', 'show', 'can you', 'could you', 'please',
            'wo', 'wie', 'können', 'bitte', 'zeigen',
            'где', 'как', 'пожалуйста', 'покажите', 'отправьте',
            'où', 'comment', 'pouvez', 'envoyez', 's\'il vous plaît',
            'أين', 'كيف', 'من فضلك', 'أرسل',
            'dónde', 'cómo', 'enviar', 'por favor'
        ];

        const isThankYouOnly = thankKeywords.some(p => lower.includes(p)) && !requestWords.some(q => lower.includes(q));

        const locMatched  = !isThankYouOnly && locKeywords.find(k => lower.includes(k));
        const needsAgency = agencyKeywords.some(k => lower.includes(k));
        const needsIban   = ibanKeywords.some(k => lower.includes(k));

        // Supabase query wrapper
        const safeQuery = async (key) => {
            try {
                const { data, error } = await supabase.from('hotel_settings').select('value').eq('key', key).single();
                return error ? null : data;
            } catch (e) { return null; }
        };

        const [locResult, agencyResult, ibanResult] = await Promise.all([
            locMatched   ? safeQuery('hotel_location')    : null,
            needsAgency  ? safeQuery('hotel_agencies')     : null,
            needsIban    ? safeQuery('reception_settings')  : null,
        ]);

        if (locResult?.value)               { locationData = locResult.value; targetDepartment = 'RESEPSIYON'; }
        if (agencyResult?.value)             { agencyData   = agencyResult.value; }
        if (ibanResult?.value?.ibanText)     { ibanData     = ibanResult.value.ibanText; }
    }

    // ── Prompt ───────────────────────────────────────────────────────
    const basePrompt    = getPromptForDepartment(targetDepartment, locationData, agencyData);
    const hotelKnowledge = getRelevantKnowledge(userText);
    const nowStr        = new Date().toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', dateStyle: 'full', timeStyle: 'short' });

    const isVerified = session?.state === 'complete' && !!session?.room;
    const requestHandlingRules = isVerified
        ? `\n[ONAYLI MİSAFİR] İsim: ${session.real_first_name || '?'}, Oda: ${session.room}. Fiziksel talep → "isRequest": true.`
        : `\n[ONAYSIZ MİSAFİR] Fiziksel talep → "Talebinizi aldım, lütfen isim ve oda numaranızı yazınız."`;

    const identityContext = isVerified && session
        ? `\n[KİMLİK] ${session.real_first_name} ${session.last_name || ''}, Oda ${session.room}.`
        : '';

    const ibanRule = ibanData
        ? `\n[IBAN — VER] ${ibanData}`
        : `\n[IBAN — VERME] Açıkça talep edilmedikçe IBAN paylaşma.`;

    let checkoutRule = '';
    if (session?.state === 'complete' && session?.checkout_date) {
        const dateWords = ['çıkış', 'check-out', 'checkout', 'ne zaman ayrılıyorum', 'giriş tarihi', 'check-in', 'tarihim', 'rezervasyonum', 'check out', 'when do i', 'wann', 'когда'];
        if (dateWords.some(k => lower.includes(k))) {
            const coFmt = new Date(session.checkout_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            const ciFmt = session.checkin_date ? new Date(session.checkin_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' }) : null;
            checkoutRule = `\n[TARİH BİLGİSİ] isRequest:false. Çıkış: ${coFmt}${ciFmt ? `, Giriş: ${ciFmt}` : ''}. Misafire ismiyle hitap et.`;
        }
    }

    const platformNote = `\n[PLATFORM: ${platform.toUpperCase()}] Her platformda aynı kural geçerli.`;

    const LANG_RULE = `\n[DİL KURALI — ZORUNLU / MANDATORY LANGUAGE RULE] Kullanıcı hangi dilde yazdıysa KESİNLİKLE aynı dilde yanıtla (Türkçe, İngilizce, Almanca, Fransızca, Arapça, Rusça vb.). Dili asla değiştirme veya karıştırma. Otel bilgileri Türkçe olsa bile misafirin diline çevirerek sun.\n⚠️ LANGUAGE: You MUST respond in the SAME language as the guest. If the guest writes in English, respond ONLY in English. NEVER default to Turkish for non-Turkish messages. Translate all hotel information to the guest's language.`;

    const SYSTEM_PROMPT = `${basePrompt}\n\nOtel Bilgileri:\n${hotelKnowledge}\n\nTarih/Saat: ${nowStr}${requestHandlingRules}${identityContext}${ibanRule}${checkoutRule}${platformNote}${LANG_RULE}\n\n⛔ ASLA UYDURMA İSİM/ODA. JSON: {"isRequest":bool,"department":"...","turkishSummary":"...","replyToUser":"..."}`;

    try {
        const response = await openai.chat.completions.create({
            model: MODEL,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user',   content: userText }
            ],
            response_format: { type: 'json_object' },
            max_tokens: MAX_TOKENS,
            temperature: 0.0
        });

        const ms = Date.now() - t0;
        const parsed = JSON.parse(response.choices[0].message.content);
        console.log(`⏱️ [${platform.toUpperCase()}][${MODEL}] ${ms}ms | dept: ${parsed.department} | isReq: ${parsed.isRequest}`);

        return {
            reply:      parsed.replyToUser || '',
            isRequest:  parsed.isRequest   || false,
            department: parsed.department  || targetDepartment,
            summary:    parsed.turkishSummary || ''
        };
    } catch (e) {
        console.error(`[SHARED_AI_HANDLER] Hata (${platform}):`, e.message);
        return { reply: 'Mesajınız alındı, kısa sürede yanıtlanacaktır.', isRequest: false, department: 'RESEPSIYON' };
    }
}

module.exports = { sharedAIHandler, MODEL };
