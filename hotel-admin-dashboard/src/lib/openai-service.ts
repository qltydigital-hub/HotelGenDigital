import OpenAI from 'openai';
import { HOTEL_KNOWLEDGE_BASE } from './hotel-data';

// OpenAI konfigürasyonu
const OPENAI_KEY_DASHBOARD = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY_DASHBOARD) {
    console.error('❌ [OPENAI-SERVICE] OPENAI_API_KEY env değişkeni TANIMLI DEĞİL! Instagram/ManyChat AI yanıtları çalışmayacak.');
    console.error('   ↳ Mevcut env keys:', Object.keys(process.env).filter(k => k.includes('OPENAI') || k.includes('API')).join(', ') || 'HİÇBİRİ');
} else {
    console.log(`🔑 [OPENAI-SERVICE] API key yüklendi: ${OPENAI_KEY_DASHBOARD.substring(0, 12)}...${OPENAI_KEY_DASHBOARD.slice(-6)} (uzunluk: ${OPENAI_KEY_DASHBOARD.length})`);
}
const openai = new OpenAI({
    apiKey: OPENAI_KEY_DASHBOARD || 'MISSING_KEY',
    timeout: 15000, // 15 saniye timeout — Vercel freeze koruması
    maxRetries: 2,  // OpenAI SDK yerleşik retry
});

export type IntentType = "QUESTION" | "REQUEST" | "COMPLAINT" | "CANCEL" | "GREETING" | "RESERVATION" | "CONFIRMATION" | "DENIAL" | "EXTERNAL_QUERY";

// AI Analiz Çıktısı Formatı
export interface AIAnalysisResult {
    intent: IntentType;             
    department: string | null;      
    language: string;               
    summary: string;                
    is_alerjen: boolean;            
    needs_reception_cc: boolean;    
    ai_safe_reply: string | null;   
    turkish_translation: string;    
    reply_routing_lang: string;     
    reply_immediate_lang: string;   
    reply_later_lang: string;       
    reply_mismatch_lang: string;    
    extracted_room_no: string | null;  
    extracted_guest_name: string | null; 
}

// Helper to remove Turkish accents due to DB/Encoding issues
export function removeTurkishAccents(str: string | null | undefined): string {
    if (!str) return "";
    return str
        .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
        .replace(/ü/g, 'u').replace(/Ü/g, 'U')
        .replace(/ş/g, 's').replace(/Ş/g, 'S')
        .replace(/ı/g, 'i').replace(/İ/g, 'I')
        .replace(/ö/g, 'o').replace(/Ö/g, 'O')
        .replace(/ç/g, 'c').replace(/Ç/g, 'C');
}

/**
 * Gelen mesajın AI tarafından analiz edildiği "AKILLI MOTOR" katmanı.
 * Model: claude-sonnet-4-5 (Anthropic)
 */
export async function analyzeGuestMessage(
    message: string, 
    isAudioContext: boolean = false, 
    context?: { roomNo?: string, guestName?: string, agencies?: Array<{name: string, url: string, priceText: string, isDirect: boolean}>, hotelTier?: 'paket1' | 'paket2', minibarNote?: string, dndRooms?: string[] },
    chatHistory?: { role: string; content: string }[]
): Promise<AIAnalysisResult> {
    const isGuestKnown = context?.roomNo && context.roomNo !== "Bilinmiyor";

    // DND Kuralı kontrolü
    const isDnd = isGuestKnown && context?.dndRooms && context.dndRooms.includes(context.roomNo!);

    const systemPrompt = `
⚠️ MANDATORY LANGUAGE RULE (HIGHEST PRIORITY — OVERRIDES EVERYTHING ELSE):
You MUST detect the language of the guest's message and respond EXCLUSIVELY in that SAME language.
- If the guest writes in English → respond ONLY in English.
- If the guest writes in Turkish → respond ONLY in Turkish.
- If the guest writes in German → respond ONLY in German.
- If the guest writes in Arabic → respond ONLY in Arabic.
- If the guest writes in French → respond ONLY in French.
- If the guest writes in Russian → respond ONLY in Russian.
NEVER mix languages. NEVER default to Turkish. The hotel knowledge base below is in Turkish but you MUST TRANSLATE all information to the guest's language.

Sen 5 Yıldızlı The Green Park Gaziantep otelinde çalışan gerçek bir misafir ilişkileri temsilcisisin. 
KESİNLİKLE YAPAY ZEKA OLDUĞUNU BELİRTME VEYA HİSSETTİRME. Her zaman gerçek bir insan çalışan gibi, profesyonel, samimi ve insani bir dilde yanıt ver. Robotik, kalıplaşmış (Örn: "Size nasıl yardımcı olabilirim?", "Başka bir sorunuz var mı?") ifadeleri sürekli olarak TEKRARLAMA. Her yanıt bağlama özgü, doğal akışlı ve tek seferde eksiksiz olmalıdır; kullanıcıyı gereksiz yere ileri geri yönlendirme.

Görevlerin: Misafirden gelen metni (veya sesten çevrilmiş metni) analiz ederek ona en tatmin edici yanıtı üretmek ve arkaplanda işlemi JSON formatında kategorize etmek. Çoklu soru geldiğinde her birini ayrı ayrı, düzenli ve eksiksiz cevapla. Karşı tarafın segment düzeyine uygun ton/üslup (ör. lüks bir otel çalışanı ciddiyeti ve zarafeti) kullan.

BİLGİ YÖNETİMİ: 
1. BİRİNCİL KAYNAK: Öncelikle aşağıdaki "Otelin genel bilgileri"ni referans al:
---
${JSON.stringify(HOTEL_KNOWLEDGE_BASE.hotel, null, 2)}
---
Belgeler taranarak, ilgili bilgi bulunduğunda doğrudan ve net şekilde yanıt verilmeli.
2. İKİNCİL KAYNAK (HARİCİ ARAŞTIRMA): Yüklenen belge dışında genel bilgi soruluyorsa, asla uydurma/halüsinasyon yapma. "Bu konuda bilgim yok" deme. Aşağıda belirtilen EXTERNAL_QUERY mekanizmasını (Perplexity yapısını tetikleyecek şekilde) kullan. Araştırma yaptığını belli etme, doğal bir şekilde bilgiyi sun.
3. BİLİNMEYEN/YANITLANAMAYAN DURUMLAR: Hem belgede hem dış sorguda bulunamayacak spesifik bir durumsa dürüst ama profesyonelce yönlendirme yap: "Bu konuda sizin için en doğru bilgiyi ön büromuz/ilgili departmanımız verebilir, isterseniz sizi doğrudan onlara bağlayayım veya talebinizi ileteyim." tarzı insani bir geçiş kullan.

Gelen mesajın sınıfı (intent):
- QUESTION: Bilgi almak istiyor (saat kaçta, neredesiniz, otopark vb.).
- RESERVATION: Oda ayırtmak, fiyat sormak.
- REQUEST: Oda içi bir talep (Havlu istiyorum, teknik destek vb.).
- COMPLAINT: Arıza veya şikayet (Klima çalışmıyor, temizlenmemiş vb.).
- CANCEL: Var olan talepten vazgeçme.
- GREETING: Merhaba, nasılsınız, teşekkürler gibi sözler.
- CONFIRMATION: Kullanıcının onay vermesi (Evet, tamam, olur, kabul vb).
- DENIAL: Kullanıcının reddetmesi (Hayır, istemem, iptal vb).
- EXTERNAL_QUERY: Otel bilgisi dışındaki harici dünyayı ilgilendiren aramalar/sorular (Uçak, transfer, döviz, vb.).

ÖNEMLİ KURALLAR (DİL, ŞİVE, YAZIM HATALARI, SES MESAJLARI):
1. DİL (KRİTİK): Misafir hangi dilde yazarsa, TÜM yanıtını (ai_safe_reply, reply_routing_lang, reply_immediate_lang, reply_later_lang, reply_mismatch_lang dahil) KESİNLİKLE o dilde yaz. Bilgi bankası Türkçe olsa bile çevirerek misafirin dilinde sun. ASLA Türkçeye düşme.
2. Hata Toleransı: Yazım, gramer ya da sesten metne (STT) hatalarını algıla ve hoşgörüyle mükemmel bir dille cevap ver.
3. Şive: Yöresel ifadeleri (ör. "Su ısınıyi mi?") mükemmel anla ve o kültüre uygun, doğal bir saygıyla anladığını hissettir.

CEVAP STRATEJİLERİ ('ai_safe_reply'):
- GREETING: Kalıplaşmış, sürekli tekrarlanan "Size nasıl yardımcı olabilirim" demeden, bağlama uygun ve çok samimi bir karşılama yap.
- CONFIRMATION / DENIAL / CANCEL: Çok kısa, konuyu kapatan bir mesajla onayla ("Rica ederim, iyi günler" gibi). TEKRAR EDEN YENİ SORULAR SORMA.
- QUESTION: Belgelerden net bilgiyi çek ve doyurucu bir tonla aktar.
- RESERVATION: Otele ait acenta bağlantılarını öner. (${context?.agencies?.length ? JSON.stringify(context.agencies) : "Acenta yok, resepsiyonu öner."})
- REQUEST / COMPLAINT:
  * Oda : ${context?.roomNo || "Bilinmiyor"}, İsim: ${context?.guestName || "Misafir"}
  * ${context?.minibarNote ? `MİNİBAR/ODA SERVİSİ KURALI: "${context.minibarNote}"` : ""}
  * ${isDnd ? `🚨 DND KURALI: Sistemde 'Rahatsız Etmeyin' kartı raporlanmış. Empatik şekilde, "Sistemimizde odanızın kapısında 'Rahatsız Etmeyin / DND' kartı olduğunu görüyorum, bu sebeple rahatsız etmemek adına giriş yapılmamıştır. Talebinizi şimdi uygun gördüğünüz bir saat için iletebilirim." benzeri kendi dilinde insani bir yanıt üret.` : ""}
  * Oda nosu veya isim yoksa KİBARCA iste. Varsa "İlgili departmana hemen bilgi veriyorum" mealinde doğal bir yanıt üret.

- DIŞ DÜNYA BİLGİSİ (EXTERNAL_QUERY): 
  * Konaklayan ise (Oda No: "Bilinmiyor" DEĞİLSE), 'intent' kısmını 'EXTERNAL_QUERY' yap. 'ai_safe_reply' içine bot olduğunu sezdirmeden "Sizin için hemen kontrol ediyorum, lütfen bir saniye..." tarzında (misafirin dilinde) bir şey yaz ki backend arkaplanda araştırıp cevaplasın. Boş bırakma.
  * Konaklamayan ise: Sadece aktif konaklayanlara harici araştırma yapabildiğinizi nazikçe ilet.

- KİMLİK ÇIKARTMA: Oda/isim görürsen 'extracted_room_no' ve 'extracted_guest_name' bilgilerine aktar. 

- ALERJEN KURALI (KRİTİK): 
  1. Yemek/restoran lafı geçerse cevabının sonuna DOĞALCA "Yiyecek/içecek alerjiniz var mı?" sorusunu ekle ('is_alerjen'=FALSE). 
  2. Alerji belirtilirse 'intent'="REQUEST", 'department'="Guest Relation", 'is_alerjen'=TRUE yap. Misafire bunu ilgili ekibe hassasiyetle ilettiğini söyleyerek güven ver.

ÇEVİRİLER (Misafir dilinde):
- 'turkish_translation': Mesajın otel çalışanı için TÜRKÇE tam çevirisi/özeti.
- 'reply_routing_lang': "İsteğinizi ilgili departmana hızlıca iletiyoruz." çevirisi
- 'reply_immediate_lang': "Talebinizi aldık, hemen ilgileniyorum." çevirisi
- 'reply_mismatch_lang': "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz." çevirisi

⚠️ FINAL REMINDER — LANGUAGE: 'ai_safe_reply' and ALL reply fields MUST be in the SAME language as the guest's message. If the guest wrote in English, every reply field must be in English. NEVER respond in Turkish to a non-Turkish message.

Çıktı KESİNLİKLE sadece JSON objesi olmalıdır. Başka bir metin dönme.
`;

    try {
        const t0 = Date.now();
        console.log(`🧠 [OPENAI-SERVICE] API çağrısı başlatılıyor... Key: ${OPENAI_KEY_DASHBOARD ? 'VAR' : 'YOK'} | Model: gpt-4o-mini`);
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 700,
            temperature: 0.1,
            messages: [
                { role: "system", content: systemPrompt },
                ...(chatHistory?.map(h => ({ role: h.role as 'user' | 'assistant' | 'system', content: h.content })) || []),
                { role: "user", content: `Misafir Mesajı: "${message}"` }
            ],
            response_format: { type: "json_object" }
        });
        console.log(`⏱️ [INSTAGRAM/gpt-4o-mini] ${Date.now() - t0}ms ✅ Başarılı`);

        const aiResText = response.choices[0]?.message?.content || '{}';
        const cleaned = aiResText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
        const result: AIAnalysisResult = JSON.parse(cleaned || "{}");

        // ai_safe_reply boş gelirse mesajın diline göre oluştur
        if (!result.ai_safe_reply || result.ai_safe_reply.trim() === '') {
            const lang = result.language || 'tr';
            result.ai_safe_reply = lang === 'tr' || lang === 'turkish'
                ? 'Merhaba! The Green Park Gaziantep\'e hoş geldiniz. Size nasıl yardımcı olabilirim?'
                : 'Hello! Welcome to The Green Park Gaziantep. How can I help you?';
        }

        return result;
    } catch (error: any) {
        // ── DETAYLI HATA LOGLAMA ──────────────────────────────────────────
        const errorType = error?.status === 401 ? 'AUTH_INVALID'
            : error?.status === 429 ? 'RATE_LIMIT'
            : error?.status === 500 ? 'OPENAI_SERVER_ERROR'
            : error?.code === 'ECONNABORTED' || error?.message?.includes('timeout') ? 'TIMEOUT'
            : error?.code === 'ENOTFOUND' ? 'DNS_ERROR'
            : 'UNKNOWN';

        console.error(`❌ [OPENAI-SERVICE] AI Analiz Hatası [${errorType}]:`, error?.message || error);
        console.error(`   ↳ API Key durumu: ${OPENAI_KEY_DASHBOARD ? `VAR (${OPENAI_KEY_DASHBOARD.substring(0, 15)}... uzunluk:${OPENAI_KEY_DASHBOARD.length})` : '❌ TANIMLI DEĞİL'}`);
        console.error(`   ↳ HTTP Status: ${error?.status || 'N/A'} | Error Code: ${error?.code || 'N/A'}`);
        console.error(`   ↳ Mesaj: "${message.substring(0, 80)}"`);
        
        // ── AKILLI FALLBACK: Otel bilgi bankasından yanıt üret ────────────
        // Jenerik "hoşgeldin" yerine mesaja göre gerçek bilgi vermeye çalış
        const smartReply = generateSmartFallback(message);

        return {
            intent: smartReply.intent as IntentType,
            department: "Resepsiyon",
            language: smartReply.language,
            summary: `AI servisi geçici hata (${errorType}). Akıllı fallback kullanıldı.`,
            is_alerjen: false,
            needs_reception_cc: false,
            ai_safe_reply: smartReply.reply,
            turkish_translation: `AI servisi geçici hata (${errorType}). Akıllı fallback kullanıldı.`,
            reply_routing_lang: smartReply.language === 'tr' ? "İsteğinizi ilgili departmana hızlıca iletiyoruz." : "We are forwarding your request to the relevant department.",
            reply_immediate_lang: smartReply.language === 'tr' ? "Talebinizi aldık, hemen ilgileniyorum." : "We received your request and are attending to it now.",
            reply_later_lang: smartReply.language === 'tr' ? "Talebinizi aldım, sonrasında ilgileneceğim." : "We have noted your request and will attend to it shortly.",
            reply_mismatch_lang: smartReply.language === 'tr' ? "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz." : "We are forwarding your information to reception, please wait a moment.",
            extracted_room_no: null,
            extracted_guest_name: null
        };
    }
}

/**
 * AKILLI FALLBACK — Jenerik karşılama yerine otel bilgi bankasından yanıt üretir.
 * AI API çalışmadığında bile misafir sorusuna anlamlı cevap vermeye çalışır.
 */
function generateSmartFallback(message: string): { reply: string; language: string; intent: string } {
    const lower = message.toLowerCase();
    const hotel = HOTEL_KNOWLEDGE_BASE.hotel;

    // Dil tespiti
    const hasTurkishChar = /[çğışöüÇĞİŞÖÜ]/.test(message);
    const hasArabic = /[\u0600-\u06FF]/.test(message);
    const hasCyrillic = /[\u0400-\u04FF]/.test(message);
    const hasGerman = /[äöüÄÖÜß]/.test(message);
    const lang = hasTurkishChar ? 'tr' : hasArabic ? 'ar' : hasCyrillic ? 'ru' : hasGerman ? 'de' : 'en';
    const isTR = lang === 'tr';

    // ── HAVUZ SORUSU ──
    const poolKeys = ['havuz', 'pool', 'yüzme', 'swimming', 'schwimmbad', 'бассейн', 'مسبح', 'piscine'];
    if (poolKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? 'Evet, otelimizde sezonluk açık yüzme havuzumuz mevcuttur. Misafirlerimiz sezon boyunca havuzdan ücretsiz yararlanabilir. 🏊'
                : 'Yes, we have a seasonal outdoor swimming pool available for our guests. You can enjoy the pool free of charge during the season. 🏊',
            language: lang, intent: 'QUESTION'
        };
    }

    // ── SPA / WELLNESS ──
    const spaKeys = ['spa', 'sauna', 'hamam', 'masaj', 'massage', 'wellness', 'fitness', 'спа', 'сауна', 'منتجع'];
    if (spaKeys.some(k => lower.includes(k))) {
        const facilities = hotel.facilities.wellness_and_sport.join(', ');
        return {
            reply: isTR
                ? `Otelimizde şu wellness imkanları mevcuttur: ${facilities}. Detaylı bilgi için resepsiyonumuzdan bilgi alabilirsiniz. 💆`
                : `Our hotel offers the following wellness facilities: ${facilities}. For detailed information, please contact our reception. 💆`,
            language: lang, intent: 'QUESTION'
        };
    }

    // ── OTOPARK ──
    const parkKeys = ['otopark', 'parking', 'car', 'araç', 'araba', 'парковка', 'موقف', 'parkplatz', 'şarj', 'charge'];
    if (parkKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? 'Otelimizde ücretsiz açık otopark mevcuttur. Elektrikli araç şarj istasyonumuz da bulunmaktadır. 🚗'
                : 'We offer free outdoor parking. Electric vehicle charging stations are also available. 🚗',
            language: lang, intent: 'QUESTION'
        };
    }

    // ── GİRİŞ/ÇIKIŞ SAATLERİ ──
    const checkinKeys = ['giriş', 'çıkış', 'check-in', 'check-out', 'checkout', 'checkin', 'saat', 'регистрация', 'تسجيل'];
    if (checkinKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? `Giriş saatimiz: ${hotel.check_in_out.check_in_from} - ${hotel.check_in_out.check_in_to}\nÇıkış saatimiz: ${hotel.check_in_out.check_out_until} 🕐`
                : `Check-in: ${hotel.check_in_out.check_in_from} - ${hotel.check_in_out.check_in_to}\nCheck-out: ${hotel.check_in_out.check_out_until} 🕐`,
            language: lang, intent: 'QUESTION'
        };
    }

    // ── KAHVALTI / RESTORAN ──
    const foodKeys = ['kahvaltı', 'restoran', 'yemek', 'breakfast', 'restaurant', 'food', 'dining', 'завтрак', 'ресторан', 'إفطار', 'مطعم', 'frühstück'];
    if (foodKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? 'Otelimizde ana restoran ve açık büfe kahvaltı hizmeti sunulmaktadır. Oda servisi de mevcuttur. 🍽️'
                : 'Our hotel offers a main restaurant with open buffet breakfast service. Room service is also available. 🍽️',
            language: lang, intent: 'QUESTION'
        };
    }

    // ── KONUM / ADRES ──
    const locKeys = ['konum', 'adres', 'nerede', 'location', 'address', 'where', 'адрес', 'где', 'عنوان', 'أين', 'wo', 'adresse'];
    if (locKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? `Otelimizin adresi: ${hotel.location.address}, ${hotel.location.district}/${hotel.location.city}. Zeugma Mozaik Müzesi'ne sadece 200m mesafedeyiz. 📍`
                : `Our hotel is located at: ${hotel.location.address}, ${hotel.location.district}/${hotel.location.city}. We are just 200m from the Zeugma Mosaic Museum. 📍`,
            language: lang, intent: 'QUESTION'
        };
    }

    // ── WI-FI ──
    const wifiKeys = ['wifi', 'wi-fi', 'internet', 'вай-фай', 'واي فاي', 'wlan'];
    if (wifiKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? 'Otelimizin tüm alanlarında ücretsiz Wi-Fi hizmeti mevcuttur. 📶'
                : 'Free Wi-Fi is available throughout the hotel. 📶',
            language: lang, intent: 'QUESTION'
        };
    }

    // ── ODA BİLGİLERİ ──
    const roomKeys = ['oda', 'room', 'suite', 'номер', 'غرفة', 'zimmer'];
    if (roomKeys.some(k => lower.includes(k))) {
        return {
            reply: isTR
                ? `Otelimizde toplam ${hotel.rooms.total_rooms} oda bulunmaktadır. Standard Room ve Suite Room seçeneklerimiz mevcuttur. Tüm odalarda klima, LCD TV, ücretsiz Wi-Fi, minibar ve çalışma masası bulunur.`
                : `Our hotel has ${hotel.rooms.total_rooms} rooms in total. We offer Standard Room and Suite Room options. All rooms feature air conditioning, LCD TV, free Wi-Fi, minibar and a work desk.`,
            language: lang, intent: 'QUESTION'
        };
    }

    // ── SELAMLAMA ──
    const greetKeys = ['merhaba', 'selam', 'hello', 'hi', 'hey', 'hallo', 'bonjour', 'привет', 'здравствуйте', 'مرحبا', 'السلام'];
    if (greetKeys.some(k => lower.includes(k)) || lower.length < 15) {
        return {
            reply: isTR
                ? 'Merhaba! The Green Park Gaziantep\'e hoş geldiniz. Size nasıl yardımcı olabilirim? Otelimiz, odalar, spa, restoran veya çevre hakkında her türlü sorunuzu yanıtlayabilirim. 😊'
                : 'Hello! Welcome to The Green Park Gaziantep. How can I assist you? I can help with information about our hotel, rooms, spa, restaurant, or the surrounding area. 😊',
            language: lang, intent: 'GREETING'
        };
    }

    // ── GENEL FALLBACK — Son çare: Soruyu doğal şekilde karşıla ──
    return {
        reply: isTR
            ? `Sorunuzu aldım, hemen cevaplıyorum. The Green Park Gaziantep, 5 yıldızlı, ${hotel.rooms.total_rooms} odalı, şehir merkezinde Zeugma Mozaik Müzesi'ne 200m mesafede yer alan modern bir oteldir. Otelimiz hakkında detaylı bilgi için lütfen sorunuzu belirtiniz veya resepsiyonumuzu arayabilirsiniz: +90 (850) 222 72 75 📞`
            : `Thank you for your message. The Green Park Gaziantep is a 5-star hotel with ${hotel.rooms.total_rooms} rooms, located in the city center just 200m from the Zeugma Mosaic Museum. For detailed inquiries, please feel free to ask or contact our reception: +90 (850) 222 72 75 📞`,
        language: lang, intent: 'QUESTION'
    };
}
