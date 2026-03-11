import OpenAI from 'openai';
import { HOTEL_KNOWLEDGE_BASE } from './hotel-data';

// Standart konfigürasyon (OpenAI)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export type IntentType = "QUESTION" | "REQUEST" | "COMPLAINT" | "CANCEL" | "GREETING";

// AI Analiz Çıktısı Formatı
export interface AIAnalysisResult {
    intent: IntentType;             // Niyet türü
    department: string | null;      // Olası departman: (Housekeeping, F&B, Teknik, Resepsiyon vb.)
    language: string;               // Tespit edilen dil (tr, en, de vs.)
    summary: string;                // Kısaltılmış özet
    is_alerjen: boolean;            // F&B'de alerjen (fıstık, gluten vs) şüphesi
    needs_reception_cc: boolean;    // Resepsiyonun acil bilmesi gereken bir durum mu (Kaza, iptal, kavga vs.)
    ai_safe_reply: string | null;   // Eğer sadece "Soru" (QUESTION) ise misafire dönülecek direkt Türkçe/Yabancı dildeki yanıt (Knowledge Base den)
}

/**
 * Gelen mesajın AI tarafından analiz edildiği "AKILLI MOTOR" katmanı.
 */
export async function analyzeGuestMessage(message: string, isAudioContext: boolean = false): Promise<AIAnalysisResult> {
    const systemPrompt = `
Sen 5 Yıldızlı The Green Park Gaziantep otelinde çalışan "GuestFlow AI" adlı misafir ilişkileri uzmanısın.
Görevin misafirden gelen metni (veya sesten çevrilmiş metni) analiz etmek ve JSON formatında kategorize etmektir.
Otele ait genel bilgiler aşağıdadır:
---
${JSON.stringify(HOTEL_KNOWLEDGE_BASE.hotel, null, 2)}
---

Sana verilen mesajın hangi sınıfa girdiğini saptamalısın:
- QUESTION: Sadece bilgi almak istiyor (saat kaçta, neredesiniz, otopark var mı vs.).
- REQUEST: Oda içi bir talep. (Havlu istiyorum, kahve bitti, taksi çağır vb.).
- COMPLAINT: Arıza veya şikayet. (Klima çalışmıyor, oda temizlenmemiş, yemek soğuk vs.).
- CANCEL: Var olan bir talepten vazgeçme. (Tamam gelmeyin buldum, iptal edin vs).
- GREETING: Sadece merhaba, nasılsınız, teşekkürler gibi kalıp sözler.

Eğer mesaj "QUESTION" veya "GREETING" ise, 'ai_safe_reply' alanına misafirin kendi dilinde çok nazik ve profesyonel TAM BİR YANIT ver (Otel bilgilerini kullanarak). Eğer soru otel dışında "şehir/bölge" ile ilgiliyse, genel kültür bilginle adres destekli yanıtla (Perplexity rolü). "REQUEST", "COMPLAINT", "CANCEL" durumlarında 'ai_safe_reply' NULL olmalıdır, çünkü buna departmanlar müdahale edecektir.

Alerjen Kuralı (KRİTİK): Eğer misafir yiyecek/içecek hakkında talepte veya soruda bulunuyorsa ve içinde fıstık, alerji, gluten, süt alerjisi gibi bir kelime varsa 'is_alerjen' değerini mutlaka TRUE yap, yoksa false yap!

Departman Eşleşmesi: Housekeeping, Teknik Servis, F&B (Gastro), Resepsiyon, Guest Relation, Rezervasyon. Talep bu departmanlardan en mantıklı olanını seç veya null bırak.

Yanıtın sadece GÜVENLİ, valit (parse edilebilir) bir JSON objesi olmalıdır. Başka hiçbir açıklama/markdown yazma.

Örnek Çıktı formatı:
{
  "intent": "REQUEST",
  "department": "Housekeeping",
  "language": "tr",
  "summary": "Odaya ekstra yastık talebi",
  "is_alerjen": false,
  "needs_reception_cc": true,
  "ai_safe_reply": null
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
            ai_safe_reply: "Değerli misafirimiz, size şu anda sistemlerimizdeki anlık bir yoğunluktan dolayı yanıt veremiyorum. Lütfen resepsiyonu arayarak destek isteyiniz."
        };
    }
}
