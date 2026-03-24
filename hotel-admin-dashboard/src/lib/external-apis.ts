/**
 * Harici Servisler (Döviz, Altın, Hava Durumu, İnternet Araması vb.)
 * 
 * Bu dosyada kullanılacak dış servislerin (API'lerin) base URL'leri, 
 * token bilgileri ve çağrı (fetch) fonksiyonları tutulur.
 * 
 * Güvenlik Uyarısı: API Anahtarlarını (Token) her zaman .env dosyasında 
 * (örn: PERPLEXITY_API_KEY=...) saklamalısınız, buraya doğrudan yazmaktan kaçının!
 */

export const EXTERNAL_APIS = {
    // 1. Örnek: Perplexity API (Gerçek Zamanlı Arama İçin)
    perplexity: {
        baseUrl: "https://api.perplexity.ai",
        apiKey: process.env.PERPLEXITY_API_KEY || "", 
    },
    
    // 2. Örnek: Döviz Kurları API'si (Örn: freecurrencyapi veya TCMB JSON)
    currency: {
        baseUrl: "https://api.freecurrencyapi.com/v1/latest",
        apiKey: process.env.CURRENCY_API_KEY || "",
    },
    
    // 3. Örnek: Hava Durumu API'si (Örn: OpenWeatherMap)
    weather: {
        baseUrl: "https://api.openweathermap.org/data/2.5/weather",
        apiKey: process.env.WEATHER_API_KEY || "",
    }
};

/**
 * 📍 Hazırlık Fonksiyonları (Gerçek zamanlı arama simülasyonu/gerçeği)
 * 
 * Ana projemizdeki OpenAI, eğer dışarıdan bir bilgiye (Örn: "Altın ne kadar?")
 * ihtiyaç duyarsa bu fonksiyonları tetikleyip güncel veriyi aldıktan sonra misafire iletebilir.
 */

// Örnek: Perplexity üzerinden güncel internet araştırması yapma fonksiyonu
export async function performLiveSearch(query: string): Promise<string | null> {
    const { apiKey, baseUrl } = EXTERNAL_APIS.perplexity;

    // Eğer API Key sisteme (.env içine) eklenmemişse işlemi pas geç, AI kendi bildiğini okusun
    if (!apiKey) {
        console.log("⚠️ Perplexity API Key bulunamadı, canlı arama devre dışı.");
        return null; 
    }

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'sonar', // Perplexity güncel internet arama motoru
                messages: [{ role: 'user', content: query + " (En güncel ve kesin veriyi kısaca ver)" }]
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (error) {
        console.error("🌐 Live Search Hatası:", error);
        return null;
    }
}
