/**
 * MODÜLER BİLGİ BANKASI YÜKLEYICI
 * ─────────────────────────────────────────────────────────
 * Kullanıcının sorusuna göre SADECE ilgili bilgi modülünü
 * yükler. Bu sayede her sorguda tüm otel bilgisi gönderilmez,
 * token tasarrufu sağlanır ve halüsinasyon riski düşer.
 */

const genelInfo = require('./greenpark_genel');
const odalarInfo = require('./greenpark_odalar');
const tesislerInfo = require('./greenpark_tesisler');

// Her zaman yüklenen minimal bilgi (otel adı, telefon, adres)
const CORE_INFO = `Otel: The Green Park Gaziantep | 5 Yıldız | Şehir Oteli
Adres: Mithatpaşa Mah. Alibey Sok. No:1, 27500 Şehitkamil / Gaziantep
Tel: +90 (850) 222 72 75 | E-posta: info@thegreenpark.com
Web: https://www.thegreenpark.com/gaziantep/
Giriş: 14:00-23:30 | Çıkış: 12:00'ye kadar`;

// Konu algılama anahtar kelimeleri
const TOPIC_KEYWORDS = {
    ODALAR: ['oda', 'room', 'süit', 'suite', 'yatak', 'bed', 'minibar', 'tv', 'wifi', 'klima', 'banyo', 'kaç oda', 'oda tip', 'oda fiyat'],
    TESISLER: ['havuz', 'pool', 'spa', 'sauna', 'fitness', 'gym', 'restoran', 'restaurant', 'kahvaltı', 'breakfast', 'bar', 'toplantı', 'meeting', 'otopark', 'parking', 'şarj', 'çamaşır', 'bagaj', 'buhar'],
    GENEL: ['adres', 'konum', 'nerede', 'telefon', 'iletişim', 'contact', 'check-in', 'check-out', 'giriş', 'çıkış', 'kaç yıldız', 'star', 'evcil', 'pet', 'çocuk', 'child', 'ödeme', 'payment', 'visa', 'kart', 'müze', 'kale', 'gezilecek', 'yakın']
};

/**
 * Kullanıcı mesajına göre ilgili bilgi modülünü/modüllerini döndürür.
 * @param {string} userText - Kullanıcının mesajı
 * @returns {string} Birleştirilmiş bilgi metni
 */
function getRelevantKnowledge(userText) {
    const lower = userText.toLowerCase();
    const matchedModules = new Set();

    // Konu eşleştirme
    for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k))) {
            matchedModules.add(topic);
        }
    }

    // Hiçbir konu eşleşmediyse sadece genel bilgiyi döndür
    if (matchedModules.size === 0) {
        return CORE_INFO;
    }

    // Eşleşen modüllerin içeriklerini birleştir
    let result = CORE_INFO;

    if (matchedModules.has('GENEL')) {
        result += '\n\n' + genelInfo.content;
    }
    if (matchedModules.has('ODALAR')) {
        result += '\n\n' + odalarInfo.content;
    }
    if (matchedModules.has('TESISLER')) {
        result += '\n\n' + tesislerInfo.content;
    }

    return result;
}

module.exports = { getRelevantKnowledge, CORE_INFO };
