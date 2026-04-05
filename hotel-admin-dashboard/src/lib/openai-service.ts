import OpenAI from 'openai';
import { HOTEL_KNOWLEDGE_BASE } from './hotel-data';

// OpenAI konfigürasyonu
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
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

ÖNEMLİ KURALLAR (ŞİVE, YAZIM HATALARI, SES MESAJLARI):
1. Dil: Misafir hangi dilde yazarsa, o dilde cevap ver.
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

Çıktı KESİNLİKLE sadece JSON objesi olmalıdır. Başka bir metin dönme.
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 1024,
            messages: [
                { role: "system", content: systemPrompt },
                ...(chatHistory?.map(h => ({ role: h.role as 'user' | 'assistant' | 'system', content: h.content })) || []),
                { role: "user", content: `Misafir Mesajı: "${message}"` }
            ],
            response_format: { type: "json_object" }
        });

        const aiResText = response.choices[0]?.message?.content || '{}';

        // Gpt-4o json dönerken ekstra block koyabiliyor, emin olmak için temizleyelim
        const cleaned = aiResText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();

        const result: AIAnalysisResult = JSON.parse(cleaned || "{}");
        
        // No longer stripping Turkish accents as DB supports UTF-8
        // If needed for specific legacy systems, use removeTurkishAccents sparingly
        /*
        if (result.turkish_translation) result.turkish_translation = removeTurkishAccents(result.turkish_translation);
        if (result.summary) result.summary = removeTurkishAccents(result.summary);
        if (result.extracted_guest_name) result.extracted_guest_name = removeTurkishAccents(result.extracted_guest_name);
        if (result.ai_safe_reply) result.ai_safe_reply = removeTurkishAccents(result.ai_safe_reply);
        if (result.reply_routing_lang) result.reply_routing_lang = removeTurkishAccents(result.reply_routing_lang);
        if (result.reply_immediate_lang) result.reply_immediate_lang = removeTurkishAccents(result.reply_immediate_lang);
        if (result.reply_later_lang) result.reply_later_lang = removeTurkishAccents(result.reply_later_lang);
        if (result.reply_mismatch_lang) result.reply_mismatch_lang = removeTurkishAccents(result.reply_mismatch_lang);
        */

        return result;
    } catch (error) {
        console.error("Claude Analiz Hatası:", error);
        return {
            intent: "QUESTION",
            department: "Resepsiyon",
            language: "tr",
            summary: "Anlasilamayan mesaj / Fallback donuldu.",
            is_alerjen: false,
            needs_reception_cc: true,
            ai_safe_reply: "Degerli misafirimiz, size daha iyi yardimci olabilmek adina talebinizi resepsiyon ekibimize iletiyorum. Acil durumlar ve detayli bilgi icin resepsiyonumuzu her zaman arayabilirsiniz.",
            turkish_translation: "Anlasilamayan mesaj",
            reply_routing_lang: "Isteginizi ilgili departmana hizlica iletiyoruz.",
            reply_immediate_lang: "Talebinizi aldik, hemen ilgileniyorum.",
            reply_later_lang: "Talebinizi aldim, sonrasinda ilgilenecegim.",
            reply_mismatch_lang: "Bilgilerinizi resepsiyona iletiyorum, lutfen kisa bir sure bekleyiniz.",
            extracted_room_no: null,
            extracted_guest_name: null
        };
    }
}
