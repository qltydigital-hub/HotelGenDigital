/**
 * SKILL: SPA Bilgi Servisi
 * ─────────────────────────────────────────
 * SPA soruları için:
 *   1. Supabase hotel_settings → hotel_spa
 *   2. hotel_documents → SPA belgesi
 *   3. Yoksa sabit test metni
 */

const SPA_DEFAULT_TEXT =
`Bu bir test çalışması. Gerçek SPA bilgileri yüklendikten sonra buradan cevaplanacak.

Şu an için SPA hakkında bilgi almak için lütfen resepsiyonumuzu arayın:
📞 +90 (850) 222 72 75`;

/**
 * SPA sorusu mu?
 */
const SPA_KEYWORDS = [
    'spa', 'masaj', 'massage', 'wellness', 'hamam', 'buhar', 'steam',
    'terapi', 'therapy', 'relax', 'dinlenme', 'sağlık merkezi', 'sauna'
];

function isSpaQuestion(userText) {
    const lower = userText.toLowerCase();
    return SPA_KEYWORDS.some(k => lower.includes(k));
}

/**
 * Supabase'den SPA bilgisini çek, yoksa sabit metin döndür.
 * @returns {{ source: string, content: string }}
 */
async function getSpaInfo(supabase) {
    if (supabase) {
        // 1. hotel_settings → hotel_spa
        try {
            const { data, error } = await supabase
                .from('hotel_settings')
                .select('value')
                .eq('key', 'hotel_spa')
                .single();

            if (!error && data?.value?.content) {
                console.log('[SPA] hotel_settings.hotel_spa bilgisi bulundu.');
                return { source: 'database', content: data.value.content };
            }
        } catch (e) { /* devam */ }

        // 2. hotel_documents → SPA belgesi
        try {
            const { data: docs, error: docErr } = await supabase
                .from('hotel_documents')
                .select('doc_type, file_url, file_name')
                .eq('department', 'SPA')
                .order('uploaded_at', { ascending: false })
                .limit(1);

            if (!docErr && docs && docs.length > 0) {
                console.log('[SPA] SPA belgesi bulundu:', docs[0].file_name);
                // Belge var ama parse edilemiyor — test metni göster
                return { source: 'document_exists', content: SPA_DEFAULT_TEXT };
            }
        } catch (e) { /* devam */ }
    }

    // 3. Hiçbir şey yok → sabit test metni
    console.log('[SPA] Belge yok, sabit test metni döndürülüyor.');
    return { source: 'default', content: SPA_DEFAULT_TEXT };
}

module.exports = { isSpaQuestion, getSpaInfo, SPA_KEYWORDS, SPA_DEFAULT_TEXT };
