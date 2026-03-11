// src/lib/manychat-config.ts
// Kullanıcının belirttiği ManyChat Custom Field ID'leri ve Konfigürasyonları

export const MANYCHAT_CONFIG = {
    apiKey: process.env.MANYCHAT_API_KEY || "",

    fields: {
        pending_text: 14228831,
        pending_request_text: 14204160,
        pending_request_payload: 14204165,
        pending_intent: 14228833,

        // Otel / Talep Spesifik
        otel_ticket_id: 14147243,
        otel_talep: 14147242,
        otel_oda_no: 14147239,
        otel_giris_tarihi: 14147241,
        otel_dil: 14147240,
        oda_no: 14204156,

        // N8N Akışı ile ilgili
        n8n_status: 14228834,
        n8n_soru: 14065082,
        n8n_reply: 14228835,
        n8n_question: 14228859,
        n8n_link: 14018159,
        n8n_cevap: 14018158,

        // Misafir Bilgileri
        misafir_adi: 14204158,
        isim_soyisim: 14204177,
        guest_lang: 14204167,
        dept_message_tr: 14204174,
        cuf_audio_url: 14199813,
    },

    contentIds: {
        instagram: {
            defaultReplyUrl: "https://h1i732o9.rcsrv.net/webhook/hotel-otomasyon-v4",
            defaultReplyContent: "content20251216211031_903843",
            noLink: "content20251216212901_588239",
            withLink: "content20251216213025_278431",
        },
        whatsapp: {
            defaultReplyUrl: "https://h1i732o9.rcsrv.net/webhook/hotel-otomasyon-v4",
            defaultReplyContent: "content20260127153442_498107",
        }
    }
};
