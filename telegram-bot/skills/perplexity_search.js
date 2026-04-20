/**
 * PERPLEXITY SEARCH SKILL — Tam Performans Yapılandırması
 * ────────────────────────────────────────────────────────
 * Model: sonar-pro (en güncel, web erişimli, Türkçe dostu)
 * Kullanım: Otel çevresi soruları (restoran, müze, gezi, ulaşım vb.)
 * Fallback: OpenAI GPT-4o (Perplexity erişilemezse)
 */

const axios = require('axios');

// ── The Green Park Gaziantep — Sabit Lokasyon Verisi ──────────────────
const HOTEL_LOCATION = {
    city: 'Gaziantep',
    district: 'Şehitkamil',
    address: 'Mithatpaşa Mah. Alibey Sok. No:1, 27500 Şehitkamil / Gaziantep',
    lat: 37.0662,
    lng: 37.3833,
    phone: '+90 (850) 222 72 75'
};

// ── ÇOK DİLLİ Çevre Sorusu Anahtar Kelimeleri ─────────────────────
const SURROUNDINGS_KEYWORDS = [
    // Türkçe — çevre & yakın
    'yakın', 'yakında', 'civar', 'etraf', 'çevre', 'civarda',
    // Yemek & kafe
    'restoran', 'lokanta', 'kafe', 'cafe', 'kahve',
    'akşam yemeği', 'öğle yemeği', 'kahvaltı yeri',
    // Gezi & kültür
    'gezi', 'gezilecek', 'görülecek', 'görülmesi gereken', 'turistik',
    'müze', 'kale', 'tarihi', 'antik', 'ören yeri', 'camii', 'arkeoloji',
    // Eğlence & alışveriş
    'alışveriş', 'market', 'mall', 'avm', 'çarşı', 'kapalı çarşı',
    'eğlence', 'gece hayatı', 'park', 'bahçe',
    // Sağlık & hizmet
    'eczane', 'hastane', 'eczaneler', 'klinik',
    // Ulaşım
    'havalimanı', 'havaalanı', 'taksi', 'servis', 'otobüs', 'dolmuş',
    // Genel soru kalıpları
    'ne yapabilirim', 'ne var', 'nereye gidebilirim', 'öneri', 'tavsiye',
    // İngilizce
    'nearby', 'around', 'close to', 'walking distance',
    'what to do', 'where to go', 'tourist', 'sightseeing', 'attraction',
    'restaurant', 'museum', 'shopping', 'pharmacy', 'taxi', 'airport',
    // Rusça
    'рядом', 'поблизости', 'рекомендации', 'куда пойти', 'что посмотреть',
    'ресторан', 'музей', 'магазин', 'аптека', 'аэропорт', 'достопримечательность',
    // Almanca
    'in der nähe', 'empfehlung', 'wohin gehen', 'sehenswürdigkeit',
    'einkaufen', 'apotheke', 'flughafen',
    // Fransızca
    'à proximité', 'près', 'recommandation', 'que faire', 'où aller',
    'musée', 'pharmacie', 'aéroport',
    // Arapça
    'قريب', 'بالقرب', 'توصية', 'أين أذهب', 'ماذا أفعل',
    'مطعم', 'متحف', 'صيدلية', 'مطار',
    // İspanyolca
    'cerca', 'cercano', 'recomendación', 'qué hacer', 'adónde ir',
    'restaurante', 'museo', 'farmacia', 'aeropuerto'
];

// Sadece lokasyon/adres soruları (Perplexity'ye gitmesin, DB'den alınsın)
const LOC_ONLY_KEYWORDS = [
    'konum', 'lokasyon', 'adres', 'nasıl gelirim',
    'yol tarifi', 'neredesiniz', 'harita linki',
    'location', 'address', 'how to get there', 'directions to hotel',
    'местоположение', 'адрес отеля', 'как добраться до отеля',
    'Standort', 'Hoteladresse',
    'الموقع', 'عنوان الفندق'
];

// Çevre içeriğini garantiye alan kelimeler
const SURROUNDINGS_OVERRIDE = [
    'restoran', 'kafe', 'müze', 'gezi', 'gezilecek',
    'yakın', 'nearby', 'yakında', 'civar', 'etraf', 'ne var', 'nereye',
    'eczane', 'alışveriş', 'eğlence', 'turistik', 'tarihi',
    'рядом', 'ресторан', 'музей', 'аптека',
    'in der nähe', 'museum',
    'à proximité', 'musée',
    'قريب', 'مطعم', 'متحف',
    'cerca', 'restaurante', 'museo'
];

/**
 * Kullanıcının dilini tespit eder.
 */
function detectLanguage(text) {
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'tr';
    if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
    if (/[äöüßÄÖÜ]/.test(text)) return 'de';
    if (/[àâéèêëïîôùûüÿçœæ]/i.test(text)) return 'fr';
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[áéíóúñ¿¡]/i.test(text)) return 'es';
    return 'en';
}

/**
 * Kullanıcı mesajının çevre sorusu olup olmadığını kontrol eder.
 */
function isSurroundingsQuestion(userText) {
    const lower = userText.toLowerCase();
    const hasSurroundingsKeyword = SURROUNDINGS_KEYWORDS.some(k => lower.includes(k));
    if (!hasSurroundingsKeyword) return false;

    const isLocOnly = LOC_ONLY_KEYWORDS.some(k => lower.includes(k))
        && !SURROUNDINGS_OVERRIDE.some(k => lower.includes(k));

    return !isLocOnly;
}

/**
 * Belirsiz sorguları zenginleştirir — Perplexity'nin daha tutarlı sonuç bulması için.
 * "Otel dışında restoran" gibi belirsiz ifadeleri net sorguya dönüştürür.
 */
function enrichQuery(userText) {
    const lower = userText.toLowerCase();

    // Restoran / yemek soruları
    const foodKeys = ['restoran', 'restaurant', 'lokanta', 'yemek', 'kafe', 'cafe', 'kahve',
                      'ресторан', 'кафе', 'مطعم', 'مقهى'];
    // Gezi / turistik
    const tourKeys = ['gezi', 'gezilecek', 'müze', 'turistik', 'tarihi', 'kale',
                      'museum', 'sightseeing', 'tourist', 'attraction',
                      'музей', 'достопримечательность', 'متحف'];
    // Alışveriş
    const shopKeys = ['alışveriş', 'market', 'çarşı', 'avm', 'shopping', 'mall',
                      'магазин', 'سوق'];
    // Eczane / sağlık
    const healthKeys = ['eczane', 'hastane', 'pharmacy', 'hospital', 'аптека', 'صيدلية'];
    // Ulaşım
    const transportKeys = ['havalimanı', 'taksi', 'airport', 'taxi', 'аэропорт', 'такси', 'مطار'];

    if (foodKeys.some(k => lower.includes(k))) {
        return `Gaziantep Şehitkamil ilçesinde, Mithatpaşa Mahallesi Alibey Sokak çevresindeki en popüler ve en çok ziyaret edilen restoranlar, kafeler ve yemek mekanları nelerdir? ${HOTEL_LOCATION.address} yakınındaki gerçek ve bilinen mekanları listele. Kullanıcının orijinal sorusu: ${userText}`;
    }
    if (tourKeys.some(k => lower.includes(k))) {
        return `Gaziantep'te en çok ziyaret edilen turistik yerler, müzeler ve tarihi mekanlar nelerdir? ${HOTEL_LOCATION.address} yakınında gezilecek yerler. Kullanıcının orijinal sorusu: ${userText}`;
    }
    if (shopKeys.some(k => lower.includes(k))) {
        return `Gaziantep Şehitkamil'de, ${HOTEL_LOCATION.address} yakınındaki alışveriş merkezleri, çarşılar ve marketler nerededir? Kullanıcının orijinal sorusu: ${userText}`;
    }
    if (healthKeys.some(k => lower.includes(k))) {
        return `Gaziantep Şehitkamil Mithatpaşa Mahallesi yakınındaki nöbetçi eczaneler ve sağlık kuruluşları nerededir? Kullanıcının orijinal sorusu: ${userText}`;
    }
    if (transportKeys.some(k => lower.includes(k))) {
        return `Gaziantep Oğuzeli Havalimanı'ndan ${HOTEL_LOCATION.address} adresine nasıl gidilir? Taksi ve ulaşım seçenekleri. Kullanıcının orijinal sorusu: ${userText}`;
    }

    // Genel bağlam
    return `Gaziantep Şehitkamil bölgesinde (${HOTEL_LOCATION.address} yakınında): ${userText}`;
}

/**
 * Perplexity sonar-pro ile gerçek zamanlı çevre araması yapar.
 * Sorgu zenginleştirme ile tutarsızlık sorununu çözer.
 */
async function searchSurroundings(userText, openaiClient) {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;
    const lang = detectLanguage(userText);

    const langInstructions = {
        tr: 'Türkçe yaz.',
        en: 'Respond in English.',
        ru: 'Отвечай на русском языке.',
        de: 'Antworte auf Deutsch.',
        fr: 'Réponds en français.',
        ar: '.أجب باللغة العربية',
        es: 'Responde en español.'
    };
    const langNote = langInstructions[lang] || langInstructions.en;

    // Sorguyu zenginleştir — belirsiz ifadeleri net sorguya dönüştür
    const enrichedQuery = enrichQuery(userText);
    console.log(`[PERPLEXITY] Zenginleştirilmiş sorgu: "${enrichedQuery.substring(0, 100)}..."`);

    // ── 1. PERPLEXITY sonar-pro ──────────────────────────────────────
    if (perplexityKey && perplexityKey.length > 10) {
        try {
            console.log(`[PERPLEXITY] 🔍 sonar-pro araması (dil: ${lang}): "${userText.substring(0, 60)}"`);

            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar-pro',
                    messages: [
                        {
                            role: 'system',
                            content:
`Sen The Green Park Gaziantep otelinin dijital misafir asistanısın.
Otel Adı: The Green Park Gaziantep
Otel Adresi: ${HOTEL_LOCATION.address}
Koordinatlar: ${HOTEL_LOCATION.lat}, ${HOTEL_LOCATION.lng}
Yakın Noktalar: Zeugma Mozaik Müzesi (200m), Gaziantep Kalesi (3km), Masal Parkı (4.5km)

GÖREV: Misafirin sorusuna göre otel çevresindeki GERÇEK, GÜNCEL yerleri bul ve listele.
Yanıt Kuralları:
- ${langNote}
- En fazla 5 somut ve DOĞRULANMIŞ öneri ver
- Her öneriye 1 satır kısa açıklama ekle
- Varsa otelden yaklaşık mesafe belirt (örn: "~500m", "~1km")
- Markdown kullan (bold başlıklar, bullet points)
- Kaynak numaralarını/citation'ları YAZMA
- Bilmiyorsan veya emin değilsen "Bu konuda net bilgi bulamadım, resepsiyonumuzdan yardım alabilirsiniz" DE — ASLA UYDURMA
- "Yeterli arama sonucu yok" gibi teknik ifadeler KULLANMA, onun yerine doğrudan bildiklerini söyle`
                        },
                        {
                            role: 'user',
                            content: enrichedQuery
                        }
                    ],
                    max_tokens: 600,
                    temperature: 0.1,
                    return_images: false,
                    return_related_questions: false,
                    search_recency_filter: 'month',
                    search_domain_filter: [],
                },
                {
                    headers: {
                        'Authorization': `Bearer ${perplexityKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 12000
                }
            );

            let result = response.data?.choices?.[0]?.message?.content || '';
            result = result.replace(/\[\d+\]/g, '').trim();

            // "Yeterli bilgi yok" benzeri olumsuz yanıt kontrolü — bu tip yanıtlarda fallback'e düş
            const negativePatterns = [
                'yeterli bilgi',
                'bilgi içermemektedir',
                'sonuç bulunamadı',
                'bulunamadı',
                'insufficient',
                'no results',
                'could not find',
            ];
            const isNegativeResponse = negativePatterns.some(p => result.toLowerCase().includes(p));

            if (result && result.length > 20 && !isNegativeResponse) {
                console.log(`✅ [PERPLEXITY] sonar-pro yanıt: ${result.length} karakter (dil: ${lang})`);
                return { source: 'perplexity', content: result };
            }

            if (isNegativeResponse) {
                console.warn(`⚠️ [PERPLEXITY] Olumsuz yanıt tespit edildi → OpenAI fallback'e düşülüyor`);
            }
        } catch (e) {
            const errMsg = e.response?.data?.error?.message || e.message;
            console.warn(`⚠️ [PERPLEXITY] sonar-pro hatası → OpenAI fallback: ${errMsg}`);
        }
    } else {
        console.warn('[PERPLEXITY] API key eksik veya geçersiz, OpenAI fallback kullanılıyor.');
    }

    // ── 2. OpenAI GPT-4o Fallback ──────────────────────────────────────
    if (openaiClient) {
        try {
            console.log(`[PERPLEXITY_FALLBACK] GPT-4o ile Gaziantep bilgisi (dil: ${lang})...`);
            const response = await openaiClient.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content:
`Sen The Green Park Gaziantep otelinin misafir asistanısın.
Otel: ${HOTEL_LOCATION.address}
Gaziantep hakkında kapsamlı bilgin var.
Misafirin sorusuna 5 somut öneri ile kısa yanıt ver.
${langNote}
KURAL: Emin olmadığın yerleri UYDURMA. Genel ve güvenilir bilgi ver.
Markdown kullan.`
                    },
                    { role: 'user', content: userText }
                ],
                max_tokens: 400,
                temperature: 0.3
            });

            const result = response.choices[0].message.content.trim();
            console.log('✅ [PERPLEXITY_FALLBACK] GPT-4o yanıtı hazır');
            return { source: 'openai_fallback', content: result };
        } catch (e) {
            console.error(`[PERPLEXITY_FALLBACK] GPT-4o hatası: ${e.message}`);
        }
    }

    return null;
}

module.exports = { isSurroundingsQuestion, searchSurroundings, HOTEL_LOCATION };
