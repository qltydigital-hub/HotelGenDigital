// src/lib/manychat-config.ts
// Kullanıcının belirttiği ManyChat Custom Field ID'leri ve Konfigürasyonları

export const MANYCHAT_CONFIG = {
    apiKey: process.env.MANYCHAT_API_KEY || "",

    fields: {
        // Yeni Eklenenler
        ai_cevap: 13974283,
        ai_urun_adi: 13984993,
        ai_urun_fiyat: 13971261,
        ai_urun_gorsel_url: 13971265,
        ai_urun_ozellik: 13978298,
        ai_urun_pdf_url: 14041720,
        cf_email: 14234107,
        cf_firma_adi: 14234105,
        cf_form_active: 14237014,
        cf_isim_soyisim: 14234110,
        cf_telefon: 14234111,
        lead_adsoyad: 14251612,
        lead_email: 14251611,
        lead_firma: 14251610,
        lead_raw: 14211087,
        lead_telefon: 14251613,
        n8n_cevap_link_yok: 13735011,

        // Eğitilmiş eski akışların bozulmaması için eskiler
        pending_text: 14228831,
        pending_request_text: 14204160,
        pending_request_payload: 14204165,
        pending_intent: 14228833,
        otel_ticket_id: 14147243,
        otel_talep: 14147242,
        otel_oda_no: 14147239,
        otel_giris_tarihi: 14147241,
        otel_dil: 14147240,
        oda_no: 14204156,
        n8n_status: 14228834,
        n8n_soru: 14065082,
        n8n_reply: 14228835,
        n8n_question: 14228859,
        n8n_link: 14018159,
        n8n_cevap: 14018158,
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
            ngrokInstagram: "content20260304185134_346714",
            noLink: "content20251216212901_588239",
            insanGerekebilir: "content20251224185336_288853",
            withLink: "content20251216213025_278431",
            untitled1: "content20260115064023_394405"
        },
        whatsapp: {
            defaultReplyUrl: "https://h1i732o9.rcsrv.net/webhook/hotel-otomasyon-v4",
            defaultReplyContent: "content20260127153442_498107",
            normalCevap: "content20260128112746_656747",
            untitled1: "content20260206170737_391293",
            nsNormalReply: "content20260128160147_178254"
        }
    }
};
