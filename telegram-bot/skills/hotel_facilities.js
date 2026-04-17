/**
 * SKILL: Hotel Facilities (Otel İmkanları)
 * ─────────────────────────────────────────
 * Otel imkanları soruları için:
 *   1. Supabase hotel_settings → hotel_factsheet
 *   2. hotel_documents → FO'dan yüklenen factsheet belgesi
 *   3. Yoksa static knowledge base
 *   4. Hiçbiri yoksa "belge yüklenmedi" bildirimi
 */

// Otel imkanları / genel bilgi anahtar kelimeleri
const FACILITIES_KEYWORDS = [
    // Genel imkanlar
    'havuz', 'pool', 'spa', 'sauna', 'fitness', 'gym', 'spor',
    'resepsiyon', 'reception', 'otopark', 'parking',
    // Yemek / restoran (F&B)
    'restoran', 'restaurant', 'kahvaltı', 'breakfast', 'yemek', 'buffet',
    'oda servisi', 'room service', 'bar', 'alakart', 'a la carte',
    // Hizmetler
    'çamaşır', 'laundry', 'bagaj', 'baggage', 'toplantı', 'meeting', 'konferans',
    'wifi', 'internet', 'şarj', 'charge',
    // Otel hakkında
    'imkan', 'hizmet', 'olanaklar', 'özellik', 'tesis',
    'kaç yıldız', 'star', 'puan', 'rating',
    // Check-in/out
    'check-in', 'check-out', 'giriş saati', 'çıkış saati', 'early check',
    'late check', 'geç çıkış', 'erken giriş',
    // Çocuk / evcil
    'çocuk', 'child', 'bebek', 'baby', 'evcil', 'pet',
    // Ödeme
    'ödeme', 'payment', 'kart', 'card', 'nakit', 'cash',
];

// SPA özel anahtar kelimeleri (ayrı yönetim için)
const SPA_KEYWORDS = [
    'spa', 'masaj', 'massage', 'wellness', 'hamam', 'buhar', 'steam',
    'terapi', 'therapy', 'relax', 'dinlenme', 'sağlık merkezi'
];

/**
 * Kullanıcı sorusunun otel imkanlarıyla ilgili olup olmadığını kontrol eder.
 * SPA soruları bu fonksiyon tarafından YAKALANMAZ (ayrı skill yönetir).
 */
function isFacilitiesQuestion(userText) {
    const lower = userText.toLowerCase();
    const hasFacility = FACILITIES_KEYWORDS.some(k => lower.includes(k));
    if (!hasFacility) return false;

    // Sadece SPA soran → spa_info skill'e bırak
    const isSpaOnly = SPA_KEYWORDS.every(k => lower.includes(k))
        && !FACILITIES_KEYWORDS.filter(k => !SPA_KEYWORDS.includes(k)).some(k => lower.includes(k));

    return !isSpaOnly;
}

/**
 * SPA sorusu mu?
 */
function isSpaQuestion(userText) {
    const lower = userText.toLowerCase();
    return SPA_KEYWORDS.some(k => lower.includes(k));
}

/**
 * F&B / yiyecek-içecek sorusu mu? (Alerji protokolü için)
 */
const FOOD_KEYWORDS = [
    'yemek', 'yiyecek', 'içecek', 'restoran', 'restaurant', 'kahvaltı',
    'breakfast', 'buffet', 'menü', 'menu', 'alakart', 'a la carte',
    'oda servisi', 'room service', 'bar', 'içki', 'alkol', 'drink',
    'yemek saati', 'akşam yemeği', 'öğle yemeği', 'servis saati',
    'sipariş', 'order', 'gıda', 'food', 'atıştırmalık', 'snack'
];

function isFoodQuestion(userText) {
    const lower = userText.toLowerCase();
    return FOOD_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Supabase'den otel factsheet/imkan bilgisini çek.
 * Önce hotel_settings → sonra hotel_documents → fallback static
 */
async function getFacilitiesInfo(supabase, staticKnowledge = '') {
    if (!supabase) {
        return { source: 'static', content: staticKnowledge || null };
    }

    // 1. hotel_settings'ten factsheet arası
    try {
        const { data, error } = await supabase
            .from('hotel_settings')
            .select('value')
            .eq('key', 'hotel_factsheet')
            .single();

        if (!error && data?.value?.content) {
            console.log('[FACILITIES] hotel_settings.hotel_factsheet bulundu.');
            return { source: 'database', content: data.value.content };
        }
    } catch (e) { /* devam */ }

    // 2. hotel_documents'ten FO factsheet belgesi
    try {
        const { data: docs, error: docErr } = await supabase
            .from('hotel_documents')
            .select('doc_type, file_url, file_name')
            .eq('department', 'FO')
            .eq('doc_type', 'factsheet')
            .order('uploaded_at', { ascending: false })
            .limit(1);

        if (!docErr && docs && docs.length > 0) {
            console.log('[FACILITIES] FO factsheet belgesi bulundu:', docs[0].file_name);
            return {
                source: 'document',
                content: null, // PDF/XLSX içerik parse edilemiyor, bildir
                fileName: docs[0].file_name
            };
        }
    } catch (e) { /* devam */ }

    // 3. Static knowledge var mı?
    if (staticKnowledge && staticKnowledge.length > 50) {
        return { source: 'static', content: staticKnowledge };
    }

    // 4. Hiçbir şey yok
    return { source: 'none', content: null };
}

module.exports = {
    isFacilitiesQuestion,
    isSpaQuestion,
    isFoodQuestion,
    getFacilitiesInfo,
    FOOD_KEYWORDS,
    SPA_KEYWORDS
};
