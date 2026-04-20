/**
 * Harici Servisler — Perplexity sonar-pro + Zenginleştirilmiş Bağlam
 * ═══════════════════════════════════════════════════════════════════
 * Instagram/ManyChat tarafı için Telegram ile aynı seviyeye getirildi.
 * Model: sonar-pro (Telegram ile eşit)
 * Otel adresi + bağlam: Her sorguda enjekte edilir
 */

export const EXTERNAL_APIS = {
    perplexity: {
        baseUrl: "https://api.perplexity.ai",
        apiKey: process.env.PERPLEXITY_API_KEY || "",
    },
    currency: {
        baseUrl: "https://api.freecurrencyapi.com/v1/latest",
        apiKey: process.env.CURRENCY_API_KEY || "",
    },
    weather: {
        baseUrl: "https://api.openweathermap.org/data/2.5/weather",
        apiKey: process.env.WEATHER_API_KEY || "",
    }
};

// ── The Green Park Gaziantep — Sabit Lokasyon Verisi ───────────────────
const HOTEL_LOCATION = {
    name: 'The Green Park Gaziantep',
    city: 'Gaziantep',
    district: 'Şehitkamil',
    address: 'Mithatpaşa Mah. Alibey Sok. No:1, 27500 Şehitkamil / Gaziantep',
    lat: 37.0662,
    lng: 37.3833,
    nearby: [
        { name: 'Zeugma Mozaik Müzesi', distance: '200m' },
        { name: 'Gaziantep Kalesi', distance: '3km' },
        { name: 'Masal Parkı', distance: '4.5km' },
    ]
};

/**
 * ÇOK DİLLİ Dil Tespiti (Telegram perplexity_search.js ile eşdeğer)
 */
function detectLanguage(text: string): string {
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'tr';
    if (/[а-яА-ЯёЁ]/.test(text)) return 'ru';
    if (/[äöüßÄÖÜ]/.test(text)) return 'de';
    if (/[àâéèêëïîôùûüÿçœæ]/i.test(text)) return 'fr';
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[áéíóúñ¿¡]/i.test(text)) return 'es';
    return 'en';
}

/**
 * Belirsiz sorguları zenginleştirir — Perplexity'nin daha iyi sonuç bulması için.
 * "Otel dışında restoran" gibi belirsiz ifadeleri net sorguya dönüştürür.
 */
function enrichQuery(userText: string, lang: string): string {
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

    let enrichment = '';
    if (foodKeys.some(k => lower.includes(k))) {
        enrichment = `Gaziantep Şehitkamil Mithatpaşa Mahallesi çevresindeki en popüler ve en çok ziyaret edilen restoranlar, kafeler ve yemek mekanları nelerdir? Otelin konumu: ${HOTEL_LOCATION.address}. `;
    } else if (tourKeys.some(k => lower.includes(k))) {
        enrichment = `Gaziantep'te en çok ziyaret edilen turistik yerler, müzeler ve tarihi mekanlar nelerdir? Otel konumu: ${HOTEL_LOCATION.address}. `;
    } else if (shopKeys.some(k => lower.includes(k))) {
        enrichment = `Gaziantep Şehitkamil'de alışveriş merkezleri, çarşılar ve marketler nerededir? Otel konumu: ${HOTEL_LOCATION.address}. `;
    } else if (healthKeys.some(k => lower.includes(k))) {
        enrichment = `Gaziantep Şehitkamil Mithatpaşa Mahallesi yakınındaki eczaneler ve sağlık kuruluşları nerededir? `;
    } else if (transportKeys.some(k => lower.includes(k))) {
        enrichment = `Gaziantep Oğuzeli Havalimanı'ndan ${HOTEL_LOCATION.address} adresine nasıl gidilir? Taksi ve ulaşım seçenekleri nelerdir? `;
    } else {
        enrichment = `Gaziantep Şehitkamil bölgesinde (${HOTEL_LOCATION.address} yakınında): `;
    }

    return enrichment + userText;
}

/**
 * 📍 Perplexity sonar-pro ile gerçek zamanlı internet araştırması
 * Telegram'daki perplexity_search.js ile aynı seviyeye getirildi.
 */
export async function performLiveSearch(query: string): Promise<string | null> {
    const { apiKey, baseUrl } = EXTERNAL_APIS.perplexity;

    if (!apiKey) {
        console.log("⚠️ Perplexity API Key bulunamadı, canlı arama devre dışı.");
        return null;
    }

    const lang = detectLanguage(query);

    const langInstructions: Record<string, string> = {
        tr: 'Türkçe yaz.',
        en: 'Respond in English.',
        ru: 'Отвечай на русском языке.',
        de: 'Antworte auf Deutsch.',
        fr: 'Réponds en français.',
        ar: '.أجب باللغة العربية',
        es: 'Responde en español.'
    };
    const langNote = langInstructions[lang] || langInstructions.en;
    const enrichedQuery = enrichQuery(query, lang);

    try {
        console.log(`🔍 [PERPLEXITY/INSTAGRAM] sonar-pro araması (dil: ${lang}): "${query.substring(0, 60)}"`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'sonar-pro',
                messages: [
                    {
                        role: 'system',
                        content:
`Sen The Green Park Gaziantep otelinin dijital misafir asistanısın.
Otel Adı: ${HOTEL_LOCATION.name}
Otel Adresi: ${HOTEL_LOCATION.address}
Koordinatlar: ${HOTEL_LOCATION.lat}, ${HOTEL_LOCATION.lng}
Yakın Noktalar: ${HOTEL_LOCATION.nearby.map(n => `${n.name} (${n.distance})`).join(', ')}

GÖREV: Misafirin sorusuna göre otel çevresindeki gerçek, güncel yerleri bul ve listele.
Yanıt Kuralları:
- ${langNote}
- En fazla 5 somut ve GERÇEK öneri ver (uydurma yapma)
- Her öneriye 1 satır kısa açıklama ekle
- Varsa otelden mesafe belirt (örn: "~500m", "~1km")
- Markdown kullan (bold başlıklar, bullet points)
- Kaynak numaralarını/citation'ları YAZMA
- Bilmiyorsan veya emin değilsen "Bu konuda net bilgi bulamadım" DE, uydurma`
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
            }),
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errText = await response.text();
            console.error(`⚠️ [PERPLEXITY/INSTAGRAM] HTTP ${response.status}: ${errText.substring(0, 200)}`);
            return null;
        }

        const data = await response.json();
        let result = data.choices?.[0]?.message?.content || '';
        // Citation referanslarını temizle
        result = result.replace(/\[\d+\]/g, '').trim();

        if (result && result.length > 20) {
            console.log(`✅ [PERPLEXITY/INSTAGRAM] sonar-pro yanıt: ${result.length} karakter (dil: ${lang})`);
            return result;
        }

        console.warn('⚠️ [PERPLEXITY/INSTAGRAM] Yanıt çok kısa veya boş, null dönülüyor.');
        return null;
    } catch (error: any) {
        if (error?.name === 'AbortError') {
            console.error('⏱️ [PERPLEXITY/INSTAGRAM] Timeout (12s aşıldı)');
        } else {
            console.error("🌐 [PERPLEXITY/INSTAGRAM] Live Search Hatası:", error?.message || error);
        }
        return null;
    }
}
