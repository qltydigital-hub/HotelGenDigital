import OpenAI from 'openai';
import { HOTEL_KNOWLEDGE_BASE } from './hotel-data';

// Standart konfigürasyon (OpenAI)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export type IntentType = "QUESTION" | "REQUEST" | "COMPLAINT" | "CANCEL" | "GREETING" | "RESERVATION";

// AI Analiz Çıktısı Formatı
export interface AIAnalysisResult {
    intent: IntentType;             // Niyet türü
    department: string | null;      // Olası departman: (Housekeeping, F&B, Teknik, Resepsiyon vb.)
    language: string;               // Tespit edilen dil (tr, en, de vs.)
    summary: string;                // Kısaltılmış özet
    is_alerjen: boolean;            // F&B'de alerjen (fıstık, gluten vs) şüphesi
    needs_reception_cc: boolean;    // Resepsiyonun acil bilmesi gereken bir durum mu (Kaza, iptal, kavga vs.)
    ai_safe_reply: string | null;   // Eğer sadece "Soru" (QUESTION) ise misafire dönülecek direkt Türkçe/Yabancı dildeki yanıt (Knowledge Base den)
    turkish_translation: string;    // Misafirin talebinin departman personeli için Türkçe'ye çevrilmiş hali
    reply_routing_lang: string;     // Misafirin dilinde: "İsteğinizi ilgili departmana hızlıca iletiyoruz."
    reply_immediate_lang: string;   // Misafirin dilinde: "Talebinizi aldık, hemen ilgileniyorum."
    reply_later_lang: string;       // Misafirin dilinde: "Talebinizi aldım, daha önce gelen isteği tamamladıktan sonra ilgileneceğim."
    extracted_room_no: string | null;  // Mesajın içinden saptanabilen oda numarası (örn. "oda 201" -> "201") 
    extracted_guest_name: string | null; // Mesajın içinden saptanabilen konuk ismi (örn. "Ben Ahmet Yılmaz" -> "Ahmet Yılmaz")
}

/**
 * Gelen mesajın AI tarafından analiz edildiği "AKILLI MOTOR" katmanı.
 */
export async function analyzeGuestMessage(
    message: string, 
    isAudioContext: boolean = false, 
    context?: { roomNo?: string, guestName?: string, agencies?: Array<{name: string, url: string, priceText: string, isDirect: boolean}>, hotelTier?: 'paket1' | 'paket2' }
): Promise<AIAnalysisResult> {
    const systemPrompt = `
Sen 5 Yıldızlı The Green Park Gaziantep otelinde çalışan "GuestFlow AI" adlı misafir ilişkileri uzmanısın.
Görevin misafirden gelen metni (veya sesten çevrilmiş metni) analiz etmek ve JSON formatında kategorize etmektir.
Otele ait genel bilgiler aşağıdadır:
---
${JSON.stringify(HOTEL_KNOWLEDGE_BASE.hotel, null, 2)}
---

Sana verilen mesajın hangi sınıfa girdiğini saptamalısın:
- QUESTION: Sadece bilgi almak istiyor (saat kaçta, neredesiniz, otopark var mı vs.).
- RESERVATION: Oda ayırtmak, fiyat sormak, rezervasyon yapmak istiyor.
- REQUEST: Oda içi bir talep. (Havlu istiyorum, kahve bitti, taksi çağır vb.).
- COMPLAINT: Arıza veya şikayet. (Klima çalışmıyor, oda temizlenmemiş, yemek soğuk vs.).
- CANCEL: Var olan bir talepten vazgeçme. (Tamam gelmeyin buldum, iptal edin vs).
- GREETING: Sadece merhaba, nasılsınız, teşekkürler gibi kalıp sözler.

ÖNEMLİ (DİL VE CEVAP KURALI):
Misafirin yazdığı dili otomatik olarak tespit et ve 'language' alanına yaz (örn. tr, en, de, ru, ar vb.).
Hangi niyet (intent) olursa olsun, 'ai_safe_reply' alanına misafirin KENDİ DİLİNDE çok nazik ve profesyonel bir metin yazmalısın:
- Eğer "QUESTION" veya "GREETING" ise: Otel bilgilerini kullanarak sorunun direkt tam cevabını ver.
- Eğer "RESERVATION" ise: Misafire otelin direkt rezervasyon seçeneğini (eğer varsa) ve ek olarak diğer acenta bağlantılarını öner. Acentalar arasında fiyat karşılaştırması yaparak EN UYGUN olanı özellikle vurgula.
${context?.agencies && context.agencies.length > 0 ? "Mevcut Acentalar ve Linkleri:\n" + JSON.stringify(context.agencies, null, 2) : "Şu an sisteme ekli acenta yok, resepsiyonla doğrudan iletişim numarası ver."}
- Eğer "REQUEST" veya "COMPLAINT" ise: 
  * DİKKAT: Konaklayan bir misafirin oda numarası ve ismi şu an sistemde: Oda: ${context?.roomNo || "Bilinmiyor"}, İsim: ${context?.guestName || "Misafir"}.
  ${context?.hotelTier === 'paket1' 
    ? `* PAKET 1 KURALI (ÇOK ÖNEMLİ): Otel şu anda sadece "Soru-Cevap" yapay zeka paketini kullanmaktadır. Eğer misafir (havlu, temizlik, yemek siparişi gibi) fiziksel bir "Departman Talebinde" bulunursa, bu talebi KESİNLİKLE ONAYLAMA. Intent alanını "QUESTION" olarak işaretle ve 'ai_safe_reply' alanına çok kibar bir dille misafirin kendi dilinde şunu yaz: "Oda servisi ve kat hizmetleri talepleriniz için lütfen odanızdaki dahili telefonu arayınız veya resepsiyon ile iletişime geçiniz."` 
    : `* PAKET 2 KURALI: Eğer Oda Numarası 'Bilinmiyor' ise: Talebi işleme almadan önce misafirden LÜTFEN çok nazikçe Oda Numarasını ve İsim Soyismini iste! "Talebinizi yerine getirebilmemiz için lütfen oda numaranızı ve isminizi paylaşır mısınız?" tarzında bir cevap yaz. Eğer Oda Numarası biliniyorsa: "İsteğinizi ilgili departmana hızlıca iletiyoruz." yaz ve bunu 'ai_safe_reply' içine de koyabilirsin.`}
- Eğer "CANCEL" ise: İptal işleminizi ilgili departmana ilettik, teşekkür ederiz.

AYRICA ŞU ÇEVİRİLERİ DOLDURMALISIN (Misafir hangi dilde yazdıysa o dilde):
- 'turkish_translation': Misafirin yazdığı mesajın departman çalışanının anlaması için TÜRKÇE tam çevirisi veya özeti.
- 'reply_routing_lang': "İsteğinizi ilgili departmana hızlıca iletiyoruz." cümlesinin misafirin dilindeki çevirisi.
- 'reply_immediate_lang': "Talebinizi aldık, hemen ilgileniyorum." cümlesinin misafirin dilindeki çevirisi.
- 'reply_later_lang': "Talebinizi aldım, daha önce gelen isteği tamamladıktan sonra ilgileneceğim." cümlesinin misafirin dilindeki çevirisi.

KİMLİK BİLGİSİ ÇIKARTMA KURALI (INFO EXTRACTION): EĞER misafir doğrudan oda numarasını veya ismini girdiyse (örn: "oda numaram 101, ismim Ahmet"), intent ne olursa olsun, bunları 'extracted_room_no' (ör: "101") ve 'extracted_guest_name' (ör: "Ahmet") alanlarına çıkart. Yoksa null bırak.

Alerjen Kuralı (KRİTİK): Eğer misafir yiyecek/içecek hakkında talepte veya soruda bulunuyorsa ve içinde fıstık, alerji, gluten, süt alerjisi gibi bir kelime varsa 'is_alerjen' değerini mutlaka TRUE yap.

Departman Eşleşmesi: Housekeeping, Teknik Servis, F&B (Gastro), Resepsiyon, Guest Relation, Rezervasyon. Talep bu departmanlardan en mantıklı olanını seç veya null bırak.

Yanıtın sadece GÜVENLİ, valit (parse edilebilir) bir JSON objesi olmalıdır. Başka hiçbir açıklama/markdown yazma.

Örnek Çıktı formatı:
{
  "intent": "REQUEST",
  "department": "Housekeeping",
  "language": "en",
  "summary": "Odaya ekstra yastık talebi",
  "is_alerjen": false,
  "needs_reception_cc": true,
  "ai_safe_reply": "We are quickly forwarding your request to the relevant department.",
  "turkish_translation": "Odaya ekstra yastık ve havlu gönderebilir misiniz?",
  "reply_routing_lang": "We are quickly forwarding your request to the relevant department.",
  "reply_immediate_lang": "We have received your request and I am taking care of it immediately.",
  "reply_later_lang": "I have received your request and will attend to it as soon as I finish my current task.",
  "extracted_room_no": null,
  "extracted_guest_name": null
}
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini", // GPT-4o-mini, maliyet ve hız açısından bu otomasyon süreçlerinde en mantıklı üründür.
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Misafir Mesajı: "${message}"` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Tutarlı JSON vermesi için düşük sıcaklık
        });

        const aiResText = response.choices[0].message.content;
        const result: AIAnalysisResult = JSON.parse(aiResText || "{}");

        return result;
    } catch (error) {
        console.error("OpenAI Analiz Hatası:", error);
        // Hata durumunda (API çökmesi vs) güvenli bir varsayılan yapılandır: fallback
        return {
            intent: "QUESTION",
            department: "Resepsiyon",
            language: "tr",
            summary: "Anlaşılamayan mesaj / Fallback dönüldü.",
            is_alerjen: false,
            needs_reception_cc: true,
            ai_safe_reply: "Değerli misafirimiz, size şu anda sistemlerimizdeki anlık bir yoğunluktan dolayı yanıt veremiyorum. Lütfen resepsiyonu arayarak destek isteyiniz.",
            turkish_translation: "Anlaşılamayan mesaj",
            reply_routing_lang: "İsteğinizi ilgili departmana hızlıca iletiyoruz.",
            reply_immediate_lang: "Talebinizi aldık, hemen ilgileniyorum.",
            reply_later_lang: "Talebinizi aldım, daha önce gelen isteği tamamladıktan sonra ilgileneceğim.",
            extracted_room_no: null,
            extracted_guest_name: null
        };
    }
}
