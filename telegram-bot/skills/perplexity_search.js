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

// ── Çevre Sorusu Anahtar Kelimeleri ──────────────────────────────────
const SURROUNDINGS_KEYWORDS = [
    // Türkçe — çevre & yakın
    'yakın', 'yakında', 'civar', 'etraf', 'çevre', 'civarda',
    // Yemek & kafe
    'restoran', 'restaurant', 'yemek', 'lokanta', 'kafe', 'cafe', 'kahve',
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
    'restaurant', 'museum', 'shopping', 'pharmacy', 'taxi', 'airport'
];

// Sadece lokasyon/adres soruları (Perplexity'ye gitmesin, DB'den alınsın)
const LOC_ONLY_KEYWORDS = [
    'konum', 'lokasyon', 'adres', 'nasıl gelirim',
    'yol tarifi', 'neredesiniz', 'harita linki'
];

// Çevre içeriğini garantiye alan kelimeler (loci ile birlikte olsa bile Perplexity'ye yönlendir)
const SURROUNDINGS_OVERRIDE = [
    'restoran', 'kafe', 'müze', 'gezi', 'gezilecek',
    'yakın', 'nearby', 'yakında', 'civar', 'etraf', 'ne var', 'nereye',
    'eczane', 'alışveriş', 'eğlence', 'turistik', 'tarihi'
];

/**
 * Kullanıcı mesajının çevre sorusu olup olmadığını kontrol eder.
 * Saf lokasyon soruları (adres/yol tarifi) dışarıda bırakılır.
 */
function isSurroundingsQuestion(userText) {
    const lower = userText.toLowerCase();

    // Çevre kelimesi var mı?
    const hasSurroundingsKeyword = SURROUNDINGS_KEYWORDS.some(k => lower.includes(k));
    if (!hasSurroundingsKeyword) return false;

    // Saf lokasyon sorusu mu? (ve çevre içeriği YOK mu?)
    const isLocOnly = LOC_ONLY_KEYWORDS.some(k => lower.includes(k))
        && !SURROUNDINGS_OVERRIDE.some(k => lower.includes(k));

    return !isLocOnly;
}

/**
 * Perplexity sonar-pro ile gerçek zamanlı çevre araması yapar.
 * Key yoksa veya hata alırsa OpenAI GPT-4o ile fallback.
 *
 * @param {string} userText - Kullanıcı sorusu
 * @param {object} openaiClient - OpenAI istemcisi (fallback için)
 * @returns {{ source: string, content: string } | null}
 */
async function searchSurroundings(userText, openaiClient) {
    const perplexityKey = process.env.PERPLEXITY_API_KEY;

    // ── 1. PERPLEXITY sonar-pro (Birincil Kaynak) ──────────────────────
    if (perplexityKey && perplexityKey.length > 10) {
        try {
            console.log(`[PERPLEXITY] 🔍 sonar-pro araması başlatıldı: "${userText.substring(0, 60)}"`);

            const response = await axios.post(
                'https://api.perplexity.ai/chat/completions',
                {
                    model: 'sonar-pro',          // En güçlü, web erişimli model
                    messages: [
                        {
                            role: 'system',
                            content:
`Sen The Green Park Gaziantep otelinin dijital misafir asistanısın.
Otel Adresi: ${HOTEL_LOCATION.address}

GÖREV: Misafirin sorusuna göre otel çevresindeki gerçek, güncel yerleri bul ve listele.
Yanıt Kuralları:
- Türkçe yaz (misafir İngilizce yazdıysa İngilizce yanıtla)
- En fazla 5 somut öneri ver
- Her öneriye 1 satır kısa açıklama ekle
- Varsa mesafe belirt (örn: "~500m")
- Markdown kullan (bold başlıklar, bullet points)
- Kaynakları veya citation numaralarını YAZMA
- Sonda şunu ekle: "📍 Harita için resepsiyonumuza danışabilirsiniz."`
                        },
                        {
                            role: 'user',
                            content: `Gaziantep Şehitkamil bölgesinde (${HOTEL_LOCATION.address} yakınında): ${userText}`
                        }
                    ],
                    max_tokens: 600,
                    temperature: 0.1,           // Düşük sıcaklık = tutarlı, güvenilir
                    return_images: false,
                    return_related_questions: false,
                    search_recency_filter: 'month',
                    search_domain_filter: [],   // Tüm domainler
                },
                {
                    headers: {
                        'Authorization': `Bearer ${perplexityKey}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 12000              // 12sn timeout
                }
            );

            // Citation kaynaklarını temizle (misafir için gereksiz)
            let result = response.data?.choices?.[0]?.message?.content || '';
            result = result.replace(/\[\d+\]/g, '').trim(); // [1], [2] gibi referansları kaldır

            if (result && result.length > 20) {
                console.log(`✅ [PERPLEXITY] sonar-pro yanıt: ${result.length} karakter`);
                return { source: 'perplexity', content: result };
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
            console.log('[PERPLEXITY_FALLBACK] GPT-4o ile Gaziantep bilgisi üretiliyor...');
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
Uydurmak yerine genel ve güvenilir bilgi ver.
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
