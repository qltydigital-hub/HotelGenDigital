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
    context?: { roomNo?: string, guestName?: string, agencies?: Array<{name: string, url: string, priceText: string, isDirect: boolean}>, hotelTier?: 'paket1' | 'paket2', minibarNote?: string, dndRooms?: string[] }
): Promise<AIAnalysisResult> {
    const isGuestKnown = context?.roomNo && context.roomNo !== "Bilinmiyor";

    // DND Kuralı kontrolü
    const isDnd = isGuestKnown && context?.dndRooms && context.dndRooms.includes(context.roomNo!);

    const systemPrompt = `
Sen 5 Yıldızlı The Green Park Gaziantep otelinde çalışan "GuestFlow AI" adlı misafir ilişkileri uzmanısın.
Görevlerin: Misafirden gelen metni (veya sesten çevrilmiş metni) analiz ederek JSON formatında kategorize etmek.

Otele ait genel bilgiler:
---
${JSON.stringify(HOTEL_KNOWLEDGE_BASE.hotel, null, 2)}
---

Gelen mesajın sınıfı (intent):
- QUESTION: Bilgi almak istiyor (saat kaçta, neredesiniz, otopark vb.).
- RESERVATION: Oda ayırtmak, fiyat sormak.
- REQUEST: Oda içi bir talep (Havlu istiyorum, teknik destek vb.).
- COMPLAINT: Arıza veya şikayet (Klima çalışmıyor, temizlenmemiş vb.).
- CANCEL: Var olan talepten vazgeçme.
- GREETING: Merhaba, nasılsınız, teşekkürler gibi sözler.
- CONFIRMATION: Kullanıcının onay vermesi (Evet, tamam, olur, kabul vb).
- DENIAL: Kullanıcının reddetmesi (Hayır, istemem, iptal vb).
- EXTERNAL_QUERY: Otel hizmeti dışındaki genel aramalar (Güncel altın fiyatları, döviz kurları, maç sonuçları, borsa vb).

ÖNEMLİ KURALLAR (ŞİVE, YAZIM HATALARI, SES MESAJLARI):
1. Dil: Misafir hangi dilde konuşursa konuşsun, o dilde (kendi dilinde) cevap ver ('language' ve 'ai_safe_reply').
2. Hata Toleransı: Misafirin yazım yanlışlarını, dil bilgisi hatalarını veya sesten metne dönüştürme (STT) kaynaklı hatalarını hoş gör, asıl anlatmak istediği niyeti algıla ve mükemmel bir dille cevap ver.
3. Şive / Yöresel (ÇOK ÖNEMLİ): Otelin bulunduğu Antep bölgesinin veya farklı bölgelerin şivesine hakim ol. Örneğin "Su ısınıyi mi?" ifadesinin "Su iyi ısınıyor mu?" olduğunu kavra ve misafire doğal, onu anladığını hissettiren profesyonel bir yanıt ver.

CEVAP STRATEJİLERİ ('ai_safe_reply'):
- GREETING: Eğer niyet GREETING ise her zaman şu mesaja benzer bir şekilde (kendi dilinde) harika bir tonla karşıla: "Merhabalar! The Green Park Gaziantep'e hoş geldiniz. Size nasıl yardımcı olabilirim?"
- CONFIRMATION / DENIAL / CANCEL: Misafir "teşekkür ederim", "tamamdır", "iptal", "hayır" diyerek konuyu kapatıyorsa, "Rica ederim, başka bir ihtiyacınız olursa buradayım. İyi günler dilerim." gibi ÇOK KISA ve konuyu kapatan bir mesaj ver. KESİNLİKLE "Size nasıl yardımcı olabilirim?", "Başka isteğiniz var mı?" GİBİ YENİ SORULAR SORMA.
- QUESTION: Otel bilgilerini kullanarak sorunun direkt cevabını ver.
- RESERVATION: Otele ait acenta bağlantılarını öner, fiyat karşılaştırması yap. (${context?.agencies?.length ? JSON.stringify(context.agencies) : "Acenta yok, resepsiyonu öner."})
- REQUEST / COMPLAINT:
  * Oda : ${context?.roomNo || "Bilinmiyor"}, İsim: ${context?.guestName || "Misafir"}
  * ${context?.minibarNote ? `ÖNEMLİ MİNİBAR VE ODA SERVİSİ KURALI: 
    Misafir minibar tüketimi veya oda servisi hakkındaki haklarını sorduğunda aşağıdaki kesin otel kuralını baz al:
    "${context.minibarNote}"` : ""}
  * ${isDnd ? `🚨 ÖNEMLİ DND (RAHATSIZ ETMEYİN) KURALI (ŞUAN BU ODA İÇİN AKTİF): 
    Housekeeping departmanının sistemdeki raporuna göre ${context?.roomNo} numaralı odanın kapısında 'Rahatsız Etmeyin' (Do Not Disturb - DND) kartı asılıdır! Eğer misafir odasının temizlenmemesinden şikayet ediyorsa, 'ai_safe_reply' ve 'reply_routing_lang' değerlerinde misafire çok kibar ve profesyonel bir dille: "Sistemimizde odanızın kapısında 'Rahatsız Etmeyin / DND' kartı asılı olduğu raporlanmıştır, bu sebeple rahatsız etmemek adına odanıza girilmemiştir. Talebinizi şimdi uygun gördüğünüz bir saat veya diğer gün için departmanımıza hemen iletiyorum." tarzı bir cevap üret (kendi dilinde). Görevlileri veya oteli ASLA suçlama.` : ""}
  * Eğer Oda Numarası veya Ad-Soyad Sistemde Yoksa ("Bilinmiyor" ise): Talebi al, "intent"i REQUEST/COMPLAINT yap ancak 'ai_safe_reply' içine KESİNLİKLE ŞUNU DÖN: "Talebinizi yerine getirebilmemiz için lütfen oda numaranızı ve isminizi paylaşır mısınız?"
  * Eğer Oda Numarası ve İsim belli ise: "İsteğinizi ilgili departmana hızlıca iletiyoruz" yaz. (Not: Misafirin ilettiği oda numarası ve isim otel in-house sistemiyle eşleşmez ise, arka planda resepsiyona/yöneticiye "Güvenlik İhlali / Eşleşmeyen Kayıt" adıyla acil bildirim mesajı gönderilecektir.  Sen sadece normal departman cevabını oluştur ve yetkiyi sisteme bırak.)
- EXTERNAL_QUERY (Döviz, Altın, Hava Durumu gibi Otel Dışı Konular):
  * DURUM A (Kullanıcı Konaklıyorsa, yani Oda: ${context?.roomNo || "Bilinmiyor"} "Bilinmiyor" DEĞİLSE): Misafire internet üzerinden gerçek zamanlı bilgi verebileceğini hissettir. "Şu anki güncel verilere göre..." gibi bir giriş yap (Misafirin dilinde cevap ver).
  * DURUM B (Kullanıcı Konaklamıyorsa, yani Oda halen "Bilinmiyor" ise): KESİNLİKLE red yanıtı ver ve O DİLDE şu metne benzer nazik ve profesyonel bir cevap dön: "Üzgünüm, bu tür konularda güncel bilgi veremiyorum. Ancak, otelimizde konakladığınız süre boyunca resepsiyondan destek alabilirsiniz."

SKILL: Misafir uçak, bilet (flight, tickets) kelimeleri yazarsa intent=QUESTION ve linki ver: https://www.google.com/travel/flights/deals

KİMLİK BİLGİSİ ÇIKARTMA (INFO EXTRACTION): EĞER misafir mesajında oda numarası veya ismini belirtiyorsa (yalnızca "305 Ahmet", "102" veya "adım mehmet" gibi çok kısa cevaplar verse bile) bunları 'extracted_room_no' ve 'extracted_guest_name' alanlarına KESİNLİKLE çıkar, yoksa null bırak. 
Misafir yalnızca oda nosu veya isim gönderiyorsa 'intent'i 'CONFIRMATION' yapabilirsiniz.

ALERJEN KURALI: Yiyecek/içecek hakkında talepte bulunuyorsa ve fıstık, gluten, alerji vs. geçiyorsa 'is_alerjen' TRUE olmalı.

DEPARTMAN: Housekeeping, Teknik Servis, F&B, Resepsiyon, Guest Relation, Rezervasyon. (En uygun olan)

ÇEVİRİLER (Misafir hangi dilde yazdıysa O DİLDE doldur):
- 'turkish_translation': Mesajın otel çalışanı için TÜRKÇE tam çevirisi/özeti.
- 'reply_routing_lang': "İsteğinizi ilgili departmana hızlıca iletiyoruz." çevirisi
- 'reply_immediate_lang': "Talebinizi aldık, hemen ilgileniyorum." çevirisi
- 'reply_mismatch_lang': "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz." çevirisi

Çıktı sadece parse edilebilir JSON objesi olmalıdır! Başka hiçbir metin dönme. JSON dışında açıklama, markdown bloğu ya da başa/sona eklenen karakter KESİNLİKLE olmasın.
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            max_tokens: 1024,
            messages: [
                { role: "system", content: systemPrompt },
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
