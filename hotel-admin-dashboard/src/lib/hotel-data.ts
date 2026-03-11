// src/lib/hotel-data.ts
// Gist'ten çekilen Knowledge Base Verisi (The Green Park Gaziantep)

export const HOTEL_KNOWLEDGE_BASE = {
    metadata: {
        type: "hotel_knowledge_base",
        version: "1.0.0",
        language: "tr",
        created_by: "ChatGPT",
        intended_use: ["AI Agent", "Hotel Assistant", "RAG Knowledge Base"],
        last_updated: "2025-01-01"
    },
    hotel: {
        name: "The Green Park Gaziantep",
        brand: "The Green Park Hotels & Resorts",
        category: "City Hotel",
        star_rating: 5,
        description: "The Green Park Gaziantep, şehir merkezinde yer alan, iş ve turizm amaçlı konaklamalar için tasarlanmış modern ve kapsamlı bir şehir otelidir.",
        location: {
            address: "Mithatpaşa Mah. Alibey Sok. No:1, 27500",
            district: "Şehitkamil",
            city: "Gaziantep",
            country: "Türkiye",
            nearby_landmarks: [
                { name: "Zeugma Mozaik Müzesi", distance: "200 m" },
                { name: "Gaziantep Kalesi", distance: "3 km" },
                { name: "Masal Parkı", distance: "4.5 km" }
            ]
        },
        contact: { website: "https://www.thegreenpark.com/gaziantep/", phone: null, email: null },
        check_in_out: { check_in_from: "14:00", check_in_to: "23:30", check_out_until: "12:00" },
        rooms: {
            total_rooms: 201,
            room_types: [
                { type: "Standard Room", description: "Şehir veya bahçe manzaralı, modern tasarımlı odalar" },
                { type: "Suite Room", description: "Daha geniş alan ve ayrı oturma bölümü sunan odalar" }
            ],
            standard_amenities: ["Klima", "Özel banyo", "LCD TV", "Ücretsiz Wi-Fi", "Çalışma masası", "Oda kasası", "Minibar"]
        },
        facilities: {
            general: ["24 saat resepsiyon", "Ücretsiz Wi-Fi", "Ücretsiz otopark", "Elektrikli araç şarj istasyonu", "Toplantı ve balo salonları"],
            food_and_beverage: ["Ana restoran", "Açık büfe kahvaltı", "Oda servisi"],
            wellness_and_sport: ["Spa merkezi (ücretli)", "Sauna", "Buhar odası", "Fitness merkezi", "Sezonluk açık yüzme havuzu"]
        },
        services: ["Çamaşırhane hizmeti", "Bagaj muhafazası"],
        parking: { available: true, type: "Ücretsiz açık otopark", electric_vehicle_charging: true },
        policies: { pets_allowed: false, children_policy: "Her yaştan çocuk kabul edilir", extra_bed: false, payment_methods: ["Visa", "Mastercard", "Nakit"] },
        reviews_summary: {
            average_rating: 8.2,
            rating_scale: 10,
            highlights: ["Temiz ve konforlu odalar", "Zengin kahvaltı", "Merkezi konum"],
            common_criticisms: ["Spa ve havuzun ekstra ücretli olması", "Yoğun dönemlerde servis hızı"]
        },
        legal_information: { property_registration_number: "15181" }
    }
};
