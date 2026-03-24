import OpenAI from 'openai';
import { HOTEL_KNOWLEDGE_BASE } from './hotel-data';

// Standart konfigürasyon (OpenAI)
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

/**
 * Gelen mesajın AI tarafından analiz edildiği "AKILLI MOTOR" katmanı.
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
- 'reply_later_lang': "Talebinizi aldım, daha önce gelen isteği tamamladıktan sonra ilgileneceğim." çevirisi
- 'reply_mismatch_lang': "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz." çevirisi

Çıktı sadece parse edilebilir JSON objesi olmalıdır! Başka hiçbir metin dönme.
`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: `Misafir Mesajı: "${message}"` }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
        });

        const aiResText = response.choices[0].message.content;
        const result: AIAnalysisResult = JSON.parse(aiResText || "{}");

        return result;
    } catch (error) {
        console.error("OpenAI Analiz Hatası:", error);
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
            reply_later_lang: "Talebinizi aldım, sonrasında ilgileneceğim.",
            reply_mismatch_lang: "Bilgilerinizi resepsiyona iletiyorum, lütfen kısa bir süre bekleyiniz.",
            extracted_room_no: null,
            extracted_guest_name: null
        };
    }
}

