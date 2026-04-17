/**
 * PERPLEXITY SEARCH SKILL
 * ────────────────────────────────────────────────────────
 * Otel çevresi soruları için gerçek zamanlı arama yapar.
 * (yakın restoran, gezilecek yer, ulaşım, vb.)
 * 
 * Öncelik: Perplexity API → OpenAI GPT-4o fallback
 */

const axios = require('axios');

// Gaziantep / The Green Park koordinatları (sabit lokasyon)
const HOTEL_LOCATION = {
    city: 'Gaziantep',
    district: 'Şehitkamil',
    address: 'Mithatpaşa Mah. Alibey Sok. No:1, 27500 Şehitkamil / Gaziantep',
    lat: 37.0662,
    lng: 37.3833
};

// Çevre sorusu anahtar kelimeleri
const SURROUNDINGS_KEYWORDS = [
    'yakın', 'yakında', 'civar', 'etraf', 'çevre',
    'restoran', 'restaurant', 'yemek', 'lokanta', 'kafe', 'cafe',
    'gezi', 'gezilecek', 'görülecek', 'görülmesi gereken', 'yer',
    'müze', 'kale', 'tarihi', 'tourist', 'turizm',
    'alışveriş', 'market', 'mall', 'avm',
    'eğlence', 'gece hayatı', 'bar', 'club',
    'eczane', 'hastane', 'eczaneler',
    'transfer', 'havalimanı', 'ulaşım', 'taksi', 'uber',
    'ne yapabilirim', 'ne var', 'nereye gidebilirim',
    'what to do', 'where to go', 'nearby', 'around',
    'tourist', 'sightseeing', 'attraction'
];

/**
 * Kullanıcı mesajının çevre sorusu olup olmadığını kontrol eder
 */
function isSurroundingsQuestion(userText) {
    const lower = userText.toLowerCase();
    return SURROUNDINGS_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Perplexity API ile arama yapar
 * Fallback: OpenAI GPT-4o ile Gaziantep bilgisi üretir
 */
async function searchSurroundings(userText, openaiClient) {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    // ── 1. PERPLEXITY API (Tercih) ────────────────────────
    if (perplexityKey) {
        try {
            console.log(`[PERPLEXITY] Çevre araması: "${userText.substring(0, 60)}"`);
            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'llama-3.1-sonar-small-128k-online',
                    messages: [
                        {
                            role: 'system',
                            content: `Sen ${HOTEL_LOCATION.city} şehrinde bulunan The Green Park Gaziantep otelinin misafir asistanısın. 
Otel adresi: ${HOTEL_LOCATION.address}.
Misafir yakın çevrede ne var, nereye gidebileceğini soruyor.
Yanıtı kısa, misafir dostu, Türkçe ver (misafir İngilizce yazmışsa İngilizce yanıtla).
Gerçek, doğru bilgiler ver. En fazla 5 öneri sun, her birine kısa açıklama ekle.
Markdown kullanabilirsin ama çok uzatma.`
                        },
                        {
                            role: 'user',
                            content: `${HOTEL_LOCATION.city} ${HOTEL_LOCATION.district} bölgesinde: ${userText}`
                        }
                    ],
                    max_tokens: 500,
                    temperature: 0.2,
                    return_images: false,
                    return_related_questions: false,
                    search_recency_filter: 'month'
                },
                {
                    headers: {
                        'Authorization': `Bearer ${perplexityKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const result = response.data?.choices?.[0]?.message?.content;
            if (result) {
                console.log(`✅ [PERPLEXITY] Yanıt alındı (${result.length} karakter)`);
                return {
                    source: 'perplexity',
                    content: result
                };
            }
        } catch (e) {
            console.warn(`⚠️ [PERPLEXITY] API hatası, OpenAI fallback'e geçiliyor: ${e.message}`);
        }
    }

    // ── 2. OpenAI GPT-4o FALLBACK ─────────────────────────
    if (openaiClient) {
        try {
            console.log(`[PERPLEXITY_FALLBACK] OpenAI GPT-4o ile çevre bilgisi üretiliyor...`);
            const response = await openaiClient.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'system',
                        content: `Sen ${HOTEL_LOCATION.city} şehrinde bulunan The Green Park Gaziantep otelinin misafir asistanısın.
Otel adresi: ${HOTEL_LOCATION.address}.
Gaziantep hakkında güvenilir, güncel bilgin var.
Misafir yakın çevrede ne var, nereye gidebileceğini soruyor.
Yanıtı kısa, misafir dostu ver. En fazla 5 öneri sun.
Bilmediğin bir şeyi uydurmak yerine genel Gaziantep bilgisi ver.`
                    },
                    {
                        role: 'user',
                        content: userText
                    }
                ],
                max_tokens: 400,
                temperature: 0.3
            });

            const result = response.choices[0].message.content.trim();
            console.log(`✅ [PERPLEXITY_FALLBACK] OpenAI yanıtı hazır`);
            return {
                source: 'openai_fallback',
                content: result
            };
        } catch (e) {
            console.error(`[PERPLEXITY_FALLBACK] OpenAI hatası: ${e.message}`);
        }
    }

    return null;
}

module.exports = { isSurroundingsQuestion, searchSurroundings, HOTEL_LOCATION };
