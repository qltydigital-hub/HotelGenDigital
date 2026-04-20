require('dotenv').config({ path: require('path').resolve(__dirname, '.env') });
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');

// ── MODÜLER SKILL İMPORTLARI ─────────────────────────────────────────
const { createDashboardLogger } = require('./skills/dashboard_logger');
const { sendHotelMap } = require('./skills/hotel_concierge');
const { createAllergyProtocol } = require('./skills/allergy_protocol');
const { convertOggToMp3 } = require('./skills/voice_processor');
const { getPromptForDepartment } = require('./skills/prompts/index');
const { getRelevantKnowledge, CORE_INFO } = require('./skills/knowledge/index');
const { isSurroundingsQuestion, searchSurroundings } = require('./skills/perplexity_search');
const { isSpaQuestion, getSpaInfo } = require('./skills/spa_info');
const { isFoodQuestion, getFacilitiesInfo } = require('./skills/hotel_facilities');

const app = express();
app.use(cors());
app.use(express.json());

const EXPRESS_PORT = process.env.EXPRESS_PORT || 3005;

const configPath = path.join(__dirname, 'skills', 'telegram_config.json');
let botToken = process.env.TELEGRAM_TOKEN;
let telegramConfig = {};
if (fs.existsSync(configPath)) {
    telegramConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    if (telegramConfig.mainBotToken) {
        botToken = telegramConfig.mainBotToken;
    }
}

if (!botToken) {
    console.error("TELEGRAM_TOKEN tanımlı değil (.env veya telegram_config.json)!");
    process.exit(1);
}

const bot = new Telegraf(botToken);

const DASHBOARD_API = process.env.DASHBOARD_API_URL || 'http://localhost:3000';

// SLA Takip Deposu
const pendingTickets = {};

// Misafir oturum bilgileri: chatId -> { name, room, state, pendingAI, failedAttempts }
// state: 'complete' | 'awaiting_info' | 'blocked'
const guestSessions = {};

// Resepsiyon not ekleme durumu: chatId -> { ticketId, department, guestName, guestRoom }
const receptionNoteStates = {};

// ── Servis Talebi Anahtar Kelime Algılayıcı (GÜVENLİK AĞI) ───────────
// AI isRequest:false döndürse bile bu kelimeler varsa talebi yakalar
// ve doğrulama akışını zorla tetikler.
const DEFINITE_SERVICE_ITEMS = [
    // Housekeeping — bu kelimelerin geçmesi TEK BAŞINA talep demektir
    'yastık', 'yaztık', 'yastik', 'havlu', 'havlı', 'çarşaf', 'carsaf',
    'battaniye', 'pike', 'şampuan', 'sabun', 'tuvalet kağıdı', 'tuvalet kagidi',
    'oda servisi', 'room service', 'pillow', 'towel', 'blanket', 'extra bed',
    'ekstra yatak', 'minibar',
];
const COMPLAINT_INDICATORS = [
    // Arıza/şikayet — bu kelimelerin geçmesi TEK BAŞINA bildirim demektir
    'bozuk', 'bozuldu', 'çalışmıyor', 'çalışmıyo', 'calısmiyor', 'calismıyor',
    'arıza', 'arızalı', 'ariza', 'kırık', 'kırıldı', 'kirik',
    'sızıntı', 'sızıyor', 'tıkandı', 'tıkalı', 'tikandi',
    'broken', 'not working', "doesn't work", 'leaking', 'clogged',
];
const SERVICE_OBJECTS = [
    // Muhtemel talep öğeleri (talep fiili ile birlikte anlamlı)
    'klima', 'klimayı', 'televizyon', 'tv', 'ışık', 'isik', 'ampul',
    'musluk', 'elektrik', 'priz', 'kilit', 'kapı', 'kapi', 'anahtar',
    'mini bar', 'temizlik', 'temızlık', 'süpürge', 'çöp', 'perde',
    'masaj', 'massage', 'hamam', 'sauna', 'spa',
    'sıcak su', 'soğuk su', 'sicak su', 'soguk su',
];
const REQUEST_VERBS = [
    // Talep fiilleri
    'istiyorum', 'isterim', 'ıstıyorum', 'isiyorum', 'istıyorum',
    'rica ediyorum', 'rica ederim', 'lazım', 'lazim', 'ihtiyacım var',
    'gönderir misiniz', 'gönderebilir misiniz', 'gonderir misiniz',
    'getirir misiniz', 'getirebilir misiniz',
    'getirin', 'gönderin', 'gonderin',
    'i need', 'i want', 'please send', 'could you send', 'can you bring',
    'bring me', "i'd like", 'i would like',
];

function isServiceRequest(userText) {
    const lower = userText.toLowerCase();
    // Kesin talep öğesi varsa → talep
    if (DEFINITE_SERVICE_ITEMS.some(k => lower.includes(k))) return true;
    // Arıza/şikayet göstergesi varsa → talep
    if (COMPLAINT_INDICATORS.some(k => lower.includes(k))) return true;
    // Servis nesnesi + talep fiili birlikte varsa → talep
    const hasObject = SERVICE_OBJECTS.some(k => lower.includes(k));
    const hasVerb = REQUEST_VERBS.some(k => lower.includes(k));
    if (hasObject && hasVerb) return true;
    return false;
}

function detectDepartmentFromText(text) {
    const lower = text.toLowerCase();
    const spaKeys = ['masaj', 'massage', 'hamam', 'sauna', 'spa'];
    const teknikKeys = ['klima', 'televizyon', 'tv', 'arıza', 'bozuk', 'çalışmıyor', 'ışık', 'ampul', 'sıcak su', 'soğuk su', 'musluk', 'tıkan', 'elektrik', 'priz', 'kilit', 'kapı'];
    const fbKeys = ['oda servisi', 'room service', 'yemek', 'içecek', 'kahve', 'çay', 'meyve', 'minibar', 'mini bar'];
    const grKeys = ['şikayet', 'memnuniyetsiz', 'berbat', 'complaint', 'kötü'];
    if (spaKeys.some(k => lower.includes(k))) return 'SPA';
    if (teknikKeys.some(k => lower.includes(k))) return 'TEKNIK';
    if (fbKeys.some(k => lower.includes(k))) return 'F&B';
    if (grKeys.some(k => lower.includes(k))) return 'GUEST_RELATIONS';
    return 'HOUSEKEEPING';
}

// Sahte onay kelime listesi (KATMAN 2.5 için)
const FALSE_CONFIRM_WORDS = [
    'iletiyorum', 'iletildi', 'iletilecek', 'iletilecektir', 'iletiliyor',
    'gönderiyorum', 'gönderildi', 'gönderilecek', 'gönderilecektir', 'gönderiliyor', 'gönderiyoruz',
    'bilgi veriyorum', 'haber veriyorum',
    'departmana bilgi', 'departmana haber', 'departmana ilet',
    'ilgili departman', 'ilgili birim', 'ilgili ekip',
    'odanıza gönder', 'odanıza ilet',
    'talebiniz alındı', 'talebiniz iletil', 'talebinizi aldık', 'talebinizi ilet',
    'hemen ilgileniyorum', 'hemen işleme alıyorum', 'hemen hallediyorum',
    'karşılanacak', 'karşılanacaktır', 'karşılanıyor',
    'yollanacak', 'yolluyorum', 'yollanıyor',
    'forwarded', 'sent to your room', 'sending to your room',
    'request has been sent', 'request has been forwarded',
    'we are sending', "we're sending",
];

let openai;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (OPENAI_KEY) {
    openai = new OpenAI({ apiKey: OPENAI_KEY });
    console.log(`🔑 [INDEX.JS API KEY] OpenAI key yüklendi: ${OPENAI_KEY.substring(0, 12)}...${OPENAI_KEY.slice(-6)}`);
} else {
    console.error('❌ [INDEX.JS FATAL] OPENAI_API_KEY bulunamadı!');
}

// ── Supabase İstemcisi ────────────────────────────────────────────────
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
    console.log('✅ Supabase bağlantısı kuruldu.');
} else {
    console.warn('⚠️  Supabase env değerleri eksik, DB kaydı devre dışı.');
}

// ── SKILL MODÜLÜ BAŞLATMA ─────────────────────────────────────────────
const saveMessageToDashboard = createDashboardLogger(supabase);
const alertGuestRelationsAboutAllergy = createAllergyProtocol(bot, supabase, telegramConfig);
console.log('✅ Skill modülleri yüklendi: [dashboard_logger, hotel_concierge, allergy_protocol, voice_processor]');

// ── Ticket'ı DB'ye kaydet / güncelle ─────────────────────────────────
async function dbUpsertTicket(ticketData) {
    if (!supabase) return;
    try {
        const { error } = await supabase
            .from('live_tickets')
            .upsert({ ...ticketData, updated_at: new Date().toISOString() }, { onConflict: 'ticket_id' });
        if (error) console.error('[Supabase] Ticket kayıt hatası:', error.message);
    } catch (e) {
        console.error('[Supabase] Hata:', e.message);
    }
}

// ── Ticket event'ini logla ────────────────────────────────────────────
async function dbLogEvent(ticketId, eventType, actor = 'system', notes = '') {
    if (!supabase) return;
    try {
        await supabase.from('ticket_events').insert({
            ticket_id: ticketId,
            event_type: eventType,
            actor,
            notes,
            event_time: new Date().toISOString()
        });
    } catch (e) {
        console.error('[Supabase] Event log hatası:', e.message);
    }
}

// ── DİNAMİK .MD DOSYA OKUYUCU (DOCS LOADER) İPTAL EDİLDİ ─────────────────
// Modüler bilgi bankası kullanılıyor (skills/knowledge/)

// ── AI ile mesaj işle (Soru mu, Talep mi?) ────────────────────────────
async function processMessageWithAI(userText, session = null) {
    if (!openai) {
        return { replyToUser: "⚙️ OpenAI API anahtarı tanımlı değil.", isRequest: false };
    }

    const nowStr = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "full", timeStyle: "short" });
    let targetDepartment = detectDepartmentFromText(userText);
    const basePrompt = getPromptForDepartment(targetDepartment, null, null);
    const hotelKnowledge = getRelevantKnowledge(userText);

    const isVerified = session && session.state === 'complete' && !!session.room;

    // PLATFORM TUTARLI SYSTEM PROMPT (— telegram_worker.js ile aynı mantık)
    const LANG_RULE = `\n[DİL KURALI — ZORUNLU / MANDATORY LANGUAGE RULE]\nMisafir hangi dilde yazmışsa KESİNLİKLE o dilde yanıtla. Otel bilgileri Türkçe olsa bile misafirin diline çevirerek sun.\n⚠️ LANGUAGE: You MUST respond in the SAME language as the guest. NEVER default to Turkish for non-Turkish messages.`;

    const SYSTEM_PROMPT = `${basePrompt}\n\nOtel Bilgileri:\n${hotelKnowledge}\n\nTarih/Saat: ${nowStr}\n${isVerified ? `[ONAYLI MİSAFİR] İsim: ${session.real_first_name || 'Mevcut'}, Oda: ${session.room}` : '[ONAYSIZ MİSAFİR] Eğer fiziksel bir talep ise adı ve oda numarası iste.'}${LANG_RULE}\n\n⛔ ASLA UYDURMA İSİM veya ODA KULLANMA. JSON FORMATINDA SADECE İSTENİLENİ VER.`;

    try {
        // 15 saniye timeout — OpenAI yavaşlarsa bot kilitlenmesin
        const abortController = new AbortController();
        const aiTimeout = setTimeout(() => abortController.abort(), 15000);
        let response;
        try {
            response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',  // telegram_worker ile aynı model (hız + tutarlılık)
                messages: [
                    { role: 'system', content: SYSTEM_PROMPT },
                    { role: 'user', content: userText }
                ],
                response_format: { type: "json_object" },
                max_tokens: 800,
                temperature: 0.0
            }, { signal: abortController.signal });
        } finally {
            clearTimeout(aiTimeout);
        }
        const parsed = JSON.parse(response.choices[0].message.content);
        console.log(`🧠 [AI RAW OUTPUT]:`, parsed);
        
        // ── POST-PROCESSING: Halüsinasyon Güvenlik Duvarı (3 KATMANLI) ──
        if (parsed.replyToUser) {
            // Sadece misafir ONAYLI DEĞİLSE İsim / Sahte Onay engellerini çalıştır
            if (!session || session.state !== 'complete') {
                // KATMAN 1: İsim Uydurma Kontrolü (Genel Kontrol)
                // Eğer doğrulanmamış durumdaysak hiçbir şekilde oda numarasını veya misafir isimlerini metinde barındırma
                const containsRoom = /\b\d{3,4}\b/.test(parsed.replyToUser);
                const containsNamesPattern = /(bey|hanım|mr|mrs|ms)/i.test(parsed.replyToUser);
                if (containsRoom || containsNamesPattern) {
                     console.warn(`⚠️ [HALÜSİNASYON ENGEL] AI doğrulanmamış misafire isim/oda uydurdu! Metin: ${parsed.replyToUser}`);
                     parsed.replyToUser = 'Talebinizi aldım! Hızlıca iletebilmem için lütfen Adınız, Soyadınız ve Oda Numaranızı yazınız. 🙏';
                }

                // KATMAN 2: Sahte Onay Kontrolü (FALSE CONFIRMATION BLOCKER)
                const isTurkish = /[çğıöşü]/i.test(parsed.replyToUser) || /talep|istek|oda/i.test(parsed.replyToUser);
                const falseConfirmPatterns = /(?:taleb|istek|rica)(?:iniz(?:i)?|nız(?:ı)?)?\s*(?:hemen\s+)?(?:ilet(?:il)?|gönder|yolla|aktarıl|karşılan|odanıza|iletiyorum|gönderiyoruz|gönderiyorum)/gi;
                const falseConfirmPatternsEN = /(?:your\s+request\s+has\s+been\s+(?:sent|forwarded|delivered)|sending\s+(?:it\s+)?to\s+your\s+room|we(?:'re|\s+are)\s+sending)/gi;
                
                if (parsed.isRequest || falseConfirmPatterns.test(parsed.replyToUser) || falseConfirmPatternsEN.test(parsed.replyToUser)) {
                    if (falseConfirmPatterns.test(parsed.replyToUser) || falseConfirmPatternsEN.test(parsed.replyToUser) || parsed.replyToUser.toLowerCase().includes("iletiyorum") || parsed.replyToUser.toLowerCase().includes("gönderiyorum")) {
                        console.warn(`🛑 [FALSE_CONFIRM_BLOCKED] AI sahte onay verdi, iptal ediliyor: ${parsed.replyToUser.substring(0, 120)}`);
                        parsed.replyToUser = isTurkish
                            ? 'Talebinizi aldım! Hızlıca iletebilmem için birkaç bilgiye ihtiyacım var. 🙏'
                            : 'I\'ve noted your request! To process it quickly, I\'ll need a few details from you. 🙏';
                        
                        if (!parsed.isRequest) {
                            parsed.isRequest = true;
                            parsed.department = "HOUSEKEEPING";
                        }
                    }
                }

                // KATMAN 2.5: GENİŞ KAPSAMLI SAHTE ONAY TESPİTİ (KEYWORD TABANLI)
                // KATMAN 2'nin regex'inin kaçırdığı varyasyonları yakalar
                // (ör: "bilgi veriyorum", "gönderilecektir", "departmana haber")
                if (parsed.replyToUser) {
                    const replyLower25 = parsed.replyToUser.toLowerCase();
                    const hasBroadFalseConfirm = FALSE_CONFIRM_WORDS.some(w => replyLower25.includes(w));
                    if (hasBroadFalseConfirm) {
                        console.warn(`🛑 [KATMAN 2.5 FALSE_CONFIRM] Geniş sahte onay tespit edildi: "${parsed.replyToUser.substring(0, 120)}"`);
                        const isReplyTurkish = /[çğıöşü]/i.test(parsed.replyToUser) || /talep|istek|oda/i.test(parsed.replyToUser);
                        parsed.replyToUser = isReplyTurkish
                            ? 'Talebinizi aldım! Hızlıca iletebilmem için birkaç bilgiye ihtiyacım var. 🙏'
                            : 'I\'ve noted your request! To process it quickly, I\'ll need a few details from you. 🙏';
                        if (!parsed.isRequest) {
                            parsed.isRequest = true;
                            parsed.department = parsed.department || 'HOUSEKEEPING';
                            parsed.turkishSummary = parsed.turkishSummary || 'Misafir talep oluşturdu (otomatik tespit)';
                        }
                    }
                }
            }

            // KATMAN 3: Oda Numarası Uydurma Kontrolü (Her durumda çalışsın)
            const roomInReply = parsed.replyToUser.match(/(?:oda(?:\s*(?:no|numar|num))?[\s.:]*|room\s*)(\d{3,4})/i);
            if (roomInReply && (!session || session.room !== roomInReply[1]) && !userText.includes(roomInReply[1])) {
                console.warn(`⚠️ [ROOM_FABRICATION] AI oda numarası uydurdu: ${roomInReply[1]}`);
                parsed.replyToUser = parsed.replyToUser.replace(/(?:oda(?:\s*(?:no|numar|num))?[\s.:]*|room\s*)\d{3,4}/gi, '');
            }
        }

        
        return parsed;
    } catch (error) {
        console.error("OpenAI Hatası:", error.message);
        return { replyToUser: "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin.", isRequest: false };
    }
}

// ── Misafir bilgisini metinden çıkar (AI ile) ─────────────────────────
// Artık kısmi bilgiyi de döndürüyor: { name, room, allergies, partial: true/false }
async function extractGuestInfo(text) {
    if (!openai) return null;
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Bilgi çekiminde hata olmaması için üst modele geçildi
            messages: [{
                role: 'system',
                content: `BİLGİ ÇIKARMA GÖREVİ — SIFIR FABRİKASYON KURALI

Sen bir metin analiz motorusun. Kullanıcının mesajından SADECE açıkça yazılmış bilgileri çıkar.

MUTLAK KURALLAR:
1. Mesajda kişi adı AÇIKÇA geçmiyorsa → name: null (KENDİN İSİM UYDURMAYACAKSIN!)
2. Mesajda oda numarası AÇIKÇA geçmiyorsa → room: null (KENDİN ODA NO UYDURMAYACAKSIN!)
3. "Herhalde" veya "muhtemelen" diye TAHMİN YAPMA.
4. Telegram kullanıcı adını kişi adı olarak KULLANMA.
5. Sadece mesajın İÇİNDE yazılmış açık bilgileri al. EĞER YAZMIYORSA BİR ALANI null GEÇMEKTEN ÇEKİNME.
6. Sadece rakamlardan oluşan mesajlar ("101", "305") → room olarak al, name: null olarak bırak.
7. Sadece isimden oluşan mesajlar ("Mehmet Yılmaz") → name olarak al, room: null olarak bırak.

ÖRNEK DOĞRU ÇIKARIMLAR:
- "Mehmet Kaya, 305" → {"name":"Mehmet Kaya","room":"305","allergies":null}
- "Oda 412, Demir" → {"name":"Demir","room":"412","allergies":null}
- "Ben Ali, 201 nolu odadayım, fıstık alerjim var" → {"name":"Ali","room":"201","allergies":"Fıstık alerjisi"}
- "101" → {"name":null,"room":"101","allergies":null}
- "Mehmet Yılmaz" → {"name":"Mehmet Yılmaz","room":null,"allergies":null}

ÖRNEK YANLIŞ — BUNLARI YAPMA:
- Mesaj: "Yastık istiyorum" → KESİNLİKLE İSİM/ODA UYDURMA! → {"name":null,"room":null,"allergies":null}
- Mesaj: "Merhaba" → hiçbir bilgi yok → {"name":null,"room":null,"allergies":null}

JSON formatı: {"name": "... veya null", "room": "... veya null", "allergies": "... veya null"}
Sadece JSON döndür, başka metin yazma.`
            }, {
                role: 'user',
                content: text
            }],
            response_format: { type: "json_object" },
            max_tokens: 200,
            temperature: 0.0 // Sıfır halüsinasyon, kesin metin analizi
        });
        const result = JSON.parse(response.choices[0].message.content);
        const name = result.name || null;
        const room = result.room || result.room_no || null;
        const allergies = result.allergies || null;

        // Tam bilgi: hem ad hem oda var
        if (name && room) {
            return { name, room, allergies, partial: false };
        }
        // Kısmi bilgi: sadece biri var
        if (name || room) {
            return { name, room, allergies, partial: true };
        }
        // Hiçbir bilgi yok
        return null;
    } catch (e) {
        return null;
    }
}

// ── STRICT In-House DB Doğrulaması (KESİN KURAL) ────────────────────
async function validateGuestInHouse(fullName, roomNo) {
    if (!supabase) return { valid: false }; // DB yoksa kesinlikle işlem yapılmaz! (Sıfır tolerans)
    
    try {
        if (!fullName || !roomNo) {
            console.warn(`[GUEST_VALIDATION_REJECTED] Ad veya Oda eksik: ${fullName} / ${roomNo}`);
            return { valid: false };
        }
        // İsim ve oda bazlı ara
        const { data, error } = await supabase
            .from('in_house_guests')
            .select('*')
            .eq('room_number', String(roomNo))
            .ilike('first_name', `%${fullName.split(' ')[0]}%`)
            .limit(1);

        if (error) {
            console.error('[IN_HOUSE_DB_ERROR]:', error.message);
            return { valid: false };
        }

        if (data && data.length > 0) {
            console.log(`✅ [IN_HOUSE_MATCHED] Misafir doğrulandı: ${fullName} -> Oda: ${roomNo}`);
            return { valid: true, guest: data[0] };
        }
        
        console.warn(`❌ [IN_HOUSE_MISMATCH] Veritabanında eşleşmeyen misafir: ${fullName} / ${roomNo}`);
        return { valid: false };
    } catch (e) {
        return { valid: false };
    }
}

// ── Departmana (Çok Kanallı: Telegram/WhatsApp) yönlendir + SLA ───────────
async function routeToDepartment(ctx, department, turkishSummary, guestChatId, guestName, guestRoom, platform = 'Telegram') {
    let targetPersonnel = [];
    let isMock = false;

    // 1. İlgili departmanın yetkililerini veritabanından çek (Örn: TEKNIK -> Ahmet(Telegram), Veli(WhatsApp))
    if (supabase) {
        const { data: personnel, error } = await supabase
            .from('hotel_personnel')
            .select('*')
            .eq('department', department)
            .eq('is_active', true);

        if (!error && personnel && personnel.length > 0) {
            targetPersonnel = personnel;
        }
    }

    // Grup chat referansını ekle (skills/telegram_config.json'dan)
    let envContactId = null;
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, 'skills', 'telegram_config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            if (config.departments && config.departments[department] && config.departments[department].active) {
                const chatIds = config.departments[department].chatIds;
                if (chatIds && chatIds.length > 0) {
                    envContactId = chatIds[0];
                }
            }
        }
    } catch (e) {
        console.error("Telegram config okunurken hata:", e.message);
    }

    if (!envContactId) {
        // Fallback: Eskiden kalan env yöntemine düş
        switch(department) {
            case 'HOUSEKEEPING': envContactId = process.env.DEPT_HOUSEKEEPING_ID; break;
            case 'TEKNIK': envContactId = process.env.DEPT_TEKNIK_ID; break;
            case 'RESEPSIYON': envContactId = process.env.DEPT_RESEPSIYON_ID; break;
            case 'F&B': envContactId = process.env.DEPT_FB_ID; break;
            case 'GUEST_RELATIONS': envContactId = process.env.DEPT_GUEST_RELATIONS_ID; break;
            case 'SPA': envContactId = process.env.DEPT_SPA_ID; break;
        }
    }

    if (envContactId) {
        const hasGroup = targetPersonnel.some(p => p.contact_id === envContactId);
        if (!hasGroup) {
            targetPersonnel.push({ full_name: `${department} (Grup)`, platform: 'TELEGRAM', contact_id: envContactId });
        }
    }

    // Eğer hiçbir yetkili veya grup bulunamazsa, testi gönderene ilet (mock fallback)
    if (targetPersonnel.length === 0) {
        console.warn(`⚠️ [SLA UYARI] ${department} için aktif yetkili/grup bulunamadı!`);
        const fallbackId = (platform === 'Telegram' || !platform) ? String(guestChatId) : "758605940";
        targetPersonnel = [{ full_name: 'Test Yöneticisi', platform: 'TELEGRAM', contact_id: fallbackId }];
        isMock = true;
    }

    const ticketId = `HTL-${Math.floor(Math.random() * 10000)}`;
    
    // PAYLOAD: [Room No | Guest Request]
    const taskMessage = `🔔 *TASK ASSIGMENT*
    
[${guestRoom} | ${turkishSummary}]

⏰ *SLA:* 1 Minute
_${isMock ? '(Test Mode)' : ''}_`;

    try {
        // 2. GÖREVİ (TICKET) SUPABASE'E KAYDET
        const createdAt = new Date().toISOString();
        await dbUpsertTicket({
            ticket_id: ticketId,
            chat_id: String(guestChatId),
            guest_name: guestName,
            room_no: guestRoom,
            department,
            status: 'OPEN',
            priority: 'NORMAL',
            description: turkishSummary,
            is_mock: isMock,
            created_at: createdAt
        });
        await dbLogEvent(ticketId, 'CREATED', 'system', `${department} departmanına yönlendirildi. Misafir: ${guestName}, Oda: ${guestRoom}`);

        let firstMessageId = null;

        // 3. HER BİR YETKİLİYE KENDİ KANALINDAN (TEL/WP/MANYCHAT) MESAJ GÖNDER
        for (const person of targetPersonnel) {
            if (person.platform.toUpperCase() === 'TELEGRAM') {
                try {
                    const sentMsg = await bot.telegram.sendMessage(person.contact_id, taskMessage, {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            Markup.button.callback('👍 Confirmed - Attending Now', `ack_${ticketId}`),
                            Markup.button.callback('⏳ Busy - Will Attend Shortly', `busy_${ticketId}`)
                        ])
                    });
                    if (!firstMessageId) firstMessageId = sentMsg.message_id; // SLA paneli yakalaması için
                } catch (e) {
                    console.error(`❌ [TELEGRAM GÜZERGÂHI] ${person.full_name} için hata:`, e.message);
                }
            } else if (person.platform.toUpperCase() === 'WHATSAPP' || person.platform.toUpperCase() === 'MANYCHAT') {
                // WhatsApp için Twilio / ManyChat entegrasyonu (2. fazda API atılacak)
                console.log(`📱 [WHATSAPP GÜZERGÂHI] ${person.full_name} numarasına WhatsApp bildirimi için kuyruğa alındı -> ${person.contact_id}`);
                // await axios.post('manychat_webhook_url', { phone: person.contact_id, text: taskMessage });
            }
        }

        console.log(`🚀 [YÖNLENDİRİLDİ] -> ${department} | ${guestName} / Oda ${guestRoom} | ${turkishSummary} | Ticket: ${ticketId}`);

        // 4. RESEPSİYONA KOPYA BİLGİ VERME (SLA harici salt bilgi)
        if (department !== "RESEPSIYON" && supabase) {
            const { data: recPersonnel } = await supabase.from('hotel_personnel')
                .select('*').eq('department', 'RESEPSIYON').eq('is_active', true);

            if (recPersonnel && recPersonnel.length > 0) {
                const infoMsg = `📋 *BİLGİ (Kopyası)* — [${ticketId}]
👤 *Misafir:* ${guestName} | 🚪 *Oda:* ${guestRoom}
➡️ *Yönlendirilen Departman:* ${department}
📝 *Talep:* ${turkishSummary}`;

                recPersonnel.forEach(async (rec) => {
                    if (rec.platform.toUpperCase() === 'TELEGRAM') {
                        try { await bot.telegram.sendMessage(rec.contact_id, infoMsg, { parse_mode: 'Markdown' }); } 
                        catch (e) {}
                    }
                });
            }
        }

        // 5. SLA ZAMANLAYICISINI (Dinamik: Departman bazlı veya varsayılan 1 dk) BAŞLAT
        let slaMin = 1;
        if (supabase) {
            const { data: deptData } = await supabase.from('departments').select('sla_timeout_min').eq('name', department).single();
            if (deptData && deptData.sla_timeout_min) slaMin = deptData.sla_timeout_min;
        }

        pendingTickets[ticketId] = {
            id: ticketId,
            department,
            summary: turkishSummary,
            guestName,
            guestRoom,
            guestChatId,
            platform,
            status: 'pending',
            targetChatId: targetPersonnel.length > 0 ? targetPersonnel[0].contact_id : guestChatId, 
            messageId: firstMessageId,
            createdAt,
            timer: setTimeout(async () => {
                let shouldEscalate = false;
                
                // MULTI-PROCESS GÜVENLİGİ: Sadece belleğe (pendingTickets) bakmak yerine Supabase'e bak
                if (supabase) {
                    const { data: ticket } = await supabase
                        .from('hotel_tickets')
                        .select('status')
                        .eq('ticket_id', ticketId)
                        .single();
                    // Eğer ticket hala OPEN ise eskalasyon yap, değilse (IN_PROGRESS vs) yapma
                    if (ticket && ticket.status === 'OPEN') {
                        shouldEscalate = true;
                    }
                } else {
                    // Fallback (DB kapalı ise belleğe bak)
                    const tk = pendingTickets[ticketId];
                    if (tk && tk.status === 'pending') shouldEscalate = true;
                }

                if (shouldEscalate) {
                    if (pendingTickets[ticketId]) pendingTickets[ticketId].status = 'escalated';
                    const escalatedAt = new Date().toISOString();
                    console.log(`⚠️ SLA AŞIMI: ${ticketId} - Resepsiyona iletiliyor...`);

                    // SLA Aşıldı -> DB Güncellemesi
                    const failureReason = `${department} departmanı ${slaMin} dakika içinde yanıt vermedi.`;
                    await dbUpsertTicket({ 
                        ticket_id: ticketId, 
                        status: 'ESCALATED', 
                        escalated_at: escalatedAt,
                        failure_reason: failureReason
                    });
                    await dbLogEvent(ticketId, 'ESCALATED', 'system', failureReason);

                    // Acil Eskalasyon mesajını tüm RESEPSİYON yetkililerine at
                    let escalationTargets = [];
                    if (supabase) {
                        const { data: recs } = await supabase.from('hotel_personnel')
                            .select('*').eq('department', 'RESEPSIYON').eq('is_active', true);
                        if (recs && recs.length > 0) escalationTargets = recs;
                    }

                    // Yedek (Fallback) olarak test chat'ine dönme durumu
                    if (escalationTargets.length === 0) {
                        const fallbackId = (platform === 'Telegram' || !platform) ? String(guestChatId) : "758605940";
                        escalationTargets.push({ full_name: 'Test Res', platform: 'TELEGRAM', contact_id: fallbackId });
                    }

                    const escalationMsg = `🔴 *ACİL BİLDİRİM (SLA Uyarısı)*

🏢 *Departman:* ${department}
👤 *Misafir:* ${guestName} | 🚪 *Oda:* ${guestRoom}
📝 *Talep:* ${turkishSummary}

⏰ _Belirtilen süre (${slaMin} dk) içinde ilgili departmandan yanıt alınamadı._

⚠️ Lütfen aşağıdaki butona basarak aksiyonu kaydedin.
_Bu not raporlarda görünecektir._`;

                    // İlk Resepsiyon ID'sini referans al
                    pendingTickets[ticketId].escalateTarget = escalationTargets[0].contact_id;

                    for (const rec of escalationTargets) {
                        if (rec.platform.toUpperCase() === 'TELEGRAM') {
                            try {
                                await bot.telegram.sendMessage(rec.contact_id, escalationMsg, {
                                    parse_mode: 'Markdown',
                                    ...Markup.inlineKeyboard([
                                        Markup.button.callback('⚠️ ACİL: İnceleme Notu Ekle', `note_${ticketId}`)
                                    ])
                                });
                            } catch (e) {
                                console.warn('Eskalasyon mesajı gönderilemedi:', e.message);
                            }
                        }
                    }

                    await saveMessageToDashboard(guestChatId, 'system',
                        `SLA Escalation: ${ticketId} - ${guestName} (Room ${guestRoom}) failed to respond, escalated to Reception.`, 'SLA_BOT');
                }
            }, slaMin * 60000) 
        };

    } catch (err) {
        console.log("Departmana mesaj yollanırken veya SLA başlatılırken hata:", err.message);
    }
}

// ── Resepsiyon: İnceleme Notu Butonu ──────────────────────────────────
bot.action(/note_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const chatId = ctx.chat.id;
    const tk = pendingTickets[ticketId];

    // Bu chat'i "not bekleniyor" moduna al
    receptionNoteStates[chatId] = {
        ticketId,
        department: tk ? tk.department : '?',
        guestName: tk ? tk.guestName : '?',
        guestRoom: tk ? tk.guestRoom : '?'
    };

    const formMsg =
`🔴 *ACİL BİLDİRİM — İnceleme Notu*

📋 *Ticket:* ${ticketId}
🏢 *Departman:* ${tk ? tk.department : '?'}
👤 *Misafir:* ${tk ? tk.guestName : '?'} | 🚪 *Oda:* ${tk ? tk.guestRoom : '?'}

━━━━━━━━━━━━━━━━━━━━━━
ℹ️ *Bu not yönetim raporlarında görünecektir.*
Lütfen ne yaptığınızı kısaca açıklayın.

✍️ *Notunuzu şimdi yazın:*
_(Örn: "Departmana ulaşıldı, ilgileniliyor.")_`;

    await ctx.answerCbQuery('📋 İnceleme notu formu açılıyor...', { show_alert: false });
    await ctx.reply(formMsg, { parse_mode: 'Markdown' });
});

// ── Misafir bilgisi sor ───────────────────────────────────────────────
// missingField: 'both' | 'name' | 'room' — ne eksik olduğunu belirtir
async function askForGuestInfo(ctx, attempt = 1, missingField = 'both') {
    let msg;
    if (attempt === 1) {
        if (missingField === 'name') {
            msg = `Teşekkürler, oda numaranızı aldım! 🙏

Şimdi talebinizi iletebilmem için *isim ve soyisminizi* de yazabilir misiniz?

_(Örnek: Mehmet Kaya)_`;
        } else if (missingField === 'room') {
            msg = `Teşekkürler! 🙏

Talebinizi iletebilmem için *oda numaranızı* da yazabilir misiniz?

_(Örnek: 412)_`;
        } else {
            msg = `Talebinizi hızlıca iletebilmem için birkaç bilgiye ihtiyacım var 🙏

1️⃣ *Oda Numaranız*
2️⃣ *Adınız Soyadınız*

_(Örnek: Mehmet Kaya, Oda 412)_`;
        }
    } else if (attempt === 2) {
        msg = `Üzgünüm, bilgileri anlayamadım 😊 Lütfen şu formatta yazabilir misiniz?

*Ad Soyad, Oda [numara]*
_(Örnek: Mehmet Kaya, Oda 412)_`;
    } else {
        msg = `Maalesef bilgilerinizi doğrulayamıyoruz. 😔
Lütfen resepsiyonumuzu arayarak destek alabilirsiniz:
📞 *+90 (850) 222 72 75*

_Resepsiyonumuz 7/24 hizmetinizdedir._`;
    }
    await ctx.replyWithMarkdown(msg);
    await saveMessageToDashboard(ctx.chat.id, 'assistant', msg);
}

// ── Misafir bilgisi tamamlandıktan sonra kişisel ve sıcak kapanış mesajı ───────
async function generateFinalConfirmation(guestName, guestRoom, langRef) {
    if (!openai) {
        return `✅ Teşekkürler ${guestName}! Talebiniz ilgili departmana iletildi.`;
    }
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o', // Onay mesajında dil/hitap sapmasını önlemek için standart model
            messages: [{
                role: 'system',
                content: `Sen bir 5 yıldızlı otel asistanısın. Aşağıdaki referans metinden misafirin dilini algıla ve TAM O DİLDE yaz. Misafirin adını ve oda numarasını kullanarak sıcak, kişisel, kısa (2 cümle max) bir onay mesajı üret. Mesaj şunu İÇERMELI: talebinin alındığı, ilgili departmanın anında haberdar edildiği ve kendisiyle ilgilenileceği. Emoji kullanabilirsin. Markdown kullanma.`
            }, {
                role: 'user',
                content: `Misafir adı: ${guestName}, Oda: ${guestRoom}. Dil referansı: "${langRef}"`
            }],
            max_tokens: 120,
            temperature: 0.3 // Güvenli varyasyon
        });
        return response.choices[0].message.content.trim();
    } catch (e) {
        return `✅ Teşekkürler ${guestName}! Talebiniz ilgili departmana iletildi, en kısa sürede ilgilenilecektir.`;
    }
}

// ── Ortak mesaj işleyici (text ve voice için) ─────────────────────────
async function handleIncomingMessage(ctx, userText) {
    const chatId = ctx.chat.id;

    // ── ÖNCELİKLİ: Resepsiyon not ekleme modu ───────────────────────────
    if (receptionNoteStates[chatId]) {
        const { ticketId, department, guestName, guestRoom } = receptionNoteStates[chatId];
        const actor = ctx.from.first_name || 'Resepsiyon Personeli';

        // Notu Supabase'e kaydet
        await dbUpsertTicket({ 
            ticket_id: ticketId, 
            reception_note: userText,
            failure_reason: `Yönetim İncelemesi: ${userText}` // Raporlama için açıklama
        });
        await dbLogEvent(ticketId, 'RECEPTION_NOTE', actor, userText);

        console.log(`📝 [RESEPSIYON NOTU] ${ticketId} - ${actor}: ${userText}`);

        // Not ekleme modundan çık
        delete receptionNoteStates[chatId];

        // Zengin onay mesajı (Resepsiyona)
        const now = new Date();
        const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
        await ctx.replyWithMarkdown(
`✅ *Not başarıyla kaydedildi ve raporlanacak.*

📋 *Ticket:* ${ticketId}
🏢 *Departman:* ${department}
👤 *Kaydeden:* ${actor}
🕐 *Saat:* ${timeStr}
📝 *Not:* "${userText}"

_Bu not yönetim raporlarında görünecektir._`
        );
        // → Misafire HİÇBİR Şey gitmez, sadece DB'ye yazıldı.
        return;
    }

    // Oturum başlat

    if (!guestSessions[chatId]) {
        guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };
    }
    let session = guestSessions[chatId];

    // Misafir çıkış tarihi geçmişse oturumu sıfırla
    if (session.state === 'complete' && session.checkout_date) {
        const checkoutDate = new Date(session.checkout_date);
        checkoutDate.setHours(23, 59, 59, 999); // O günün sonuna kadar geçerli olsun
        if (new Date() > checkoutDate) {
            console.log(`[SESSION EXPIRED] ${chatId} için çıkış tarihi (${session.checkout_date}) geçmiş, hafıza temizleniyor.`);
            guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };
            session = guestSessions[chatId];
        }
    }

    await saveMessageToDashboard(chatId, 'user', userText);

    // ── DURUM: Misafir bilgisi bekleniyor ──────────────────────────────
    if (session.state === 'awaiting_info') {
        await ctx.sendChatAction('typing');

        // ── BLOCKED durumunda resepsiyona yönlendir ──────────────────
        if (session.failedAttempts >= 3) {
            session.state = 'blocked';
            await askForGuestInfo(ctx, 3); // Resepsiyona yönlendirme mesajı
            console.warn(`🚫 [BLOCKED] chatId: ${chatId} - 3 başarısız doğrulama, bloke edildi.`);
            return;
        }

        const guestInfo = await extractGuestInfo(userText);

        // ── KISMİ BİLGİ YÖNETİMİ ────────────────────────────────────
        // Misafir sadece oda numarası veya sadece isim verdiyse, 
        // kısmi bilgiyi session'a kaydet ve eksik parçayı sor
        if (guestInfo && guestInfo.partial) {
            if (guestInfo.room && !guestInfo.name) {
                // Sadece oda no geldi, isim eksik → session'a oda kaydet, isim sor
                session.partialRoom = guestInfo.room;
                console.log(`📋 [KISMİ BİLGİ] Oda: ${guestInfo.room} alındı, isim bekleniyor. chatId: ${chatId}`);
                await askForGuestInfo(ctx, 1, 'name');
                return;
            } else if (guestInfo.name && !guestInfo.room) {
                // Sadece isim geldi, oda eksik → session'a isim kaydet, oda sor
                session.partialName = guestInfo.name;
                console.log(`📋 [KISMİ BİLGİ] İsim: ${guestInfo.name} alındı, oda bekleniyor. chatId: ${chatId}`);
                await askForGuestInfo(ctx, 1, 'room');
                return;
            }
        }

        // ── DAHA ÖNCE KISMİ BİLGİ KAYITLI MI? ───────────────────────
        // Önceki turda sadece oda veya isim gelmişti, şimdi eksik parça geldi mi?
        let resolvedName = guestInfo ? guestInfo.name : null;
        let resolvedRoom = guestInfo ? guestInfo.room : null;
        let resolvedAllergies = guestInfo ? guestInfo.allergies : null;

        if (!resolvedName && session.partialName) {
            resolvedName = session.partialName;
        }
        if (!resolvedRoom && session.partialRoom) {
            resolvedRoom = session.partialRoom;
        }

        if (resolvedName && resolvedRoom) {
            // ── GÜVENLIK KONTROLÜ: AI uydurmuş olabilir mi? ──────────
            // Eğer çıkarılan isim orijinal mesajda hiç geçmiyorsa VE partialName'den gelmemişse → reddet
            const nameFirstPart = resolvedName.split(' ')[0].toLowerCase();
            const nameFromPartial = session.partialName && session.partialName.split(' ')[0].toLowerCase() === nameFirstPart;
            if (!nameFromPartial && !userText.toLowerCase().includes(nameFirstPart)) {
                console.warn(`⚠️ [FABRİKASYON TESPİT] AI "${resolvedName}" üretti ama mesajda "${nameFirstPart}" geçmiyor!`);
                session.failedAttempts++;
                // Kısmi bilgileri temizle, baştan başla
                delete session.partialName;
                delete session.partialRoom;
                await askForGuestInfo(ctx, 2);
                return;
            }

            // In-House Doğrulaması
            const validation = await validateGuestInHouse(resolvedName, resolvedRoom);
            
            if (!validation.valid) {
                session.failedAttempts++;
                // Kısmi bilgileri temizle
                delete session.partialName;
                delete session.partialRoom;

                // ── EŞLEŞME YOK → RESEPSİYONA ACİL BİLDİRİM ──────────
                // Her başarısız doğrulamada resepsiyonu bilgilendir
                if (supabase) {
                    const { data: recPersonnel } = await supabase.from('hotel_personnel')
                        .select('*').eq('department', 'RESEPSIYON').eq('is_active', true);
                    if (recPersonnel && recPersonnel.length > 0) {
                        const urgency = session.failedAttempts >= 3 ? '🚨 ACİL' : '⚠️ BİLGİ';
                        const infoMsg = `${urgency} *MİSAFİR DOĞRULAMA BAŞARISIZ*
Bir kullanıcının bilgileri In-House listesiyle eşleşmedi.
👤 *Denenen Ad:* ${resolvedName}
🚪 *Denenen Oda:* ${resolvedRoom}
💬 *Platform ID:* ${chatId}
🔄 *Deneme:* ${session.failedAttempts}/3

_Lütfen In-House verilerinizi kontrol ediniz._`;
                        for (const rec of recPersonnel) {
                            if (rec.platform.toUpperCase() === 'TELEGRAM') {
                                try { await bot.telegram.sendMessage(rec.contact_id, infoMsg, { parse_mode: 'Markdown' }); } 
                                catch (e) {}
                            }
                        }
                    }
                }

                if (session.failedAttempts >= 3) {
                    // 3. başarısız deneme → resepsiyona yönlendir
                    await askForGuestInfo(ctx, 3);
                    session.state = 'blocked';
                    console.warn(`🚫 [DOĞRULAMA BAŞARISIZ x3] chatId: ${chatId} → Resepsiyona yönlendirildi.`);
                } else {
                    const failMsg = `⚠️ Üzgünüm, oda bilgileriniz (Ad/Soyad ve Oda No) konaklayan listemizle eşleşmedi.\n\nLütfen check-in sırasında verdiğiniz bilgileri kontrol edip tekrar yazınız. 🙏\n_(Deneme: ${session.failedAttempts}/3)_`;
                    await ctx.replyWithMarkdown(failMsg);
                    await saveMessageToDashboard(chatId, 'assistant', failMsg);
                }
                return;
            }

            // Bilgi alındı ve doğrulandı, kaydet
            session.name = resolvedName;
            session.room = resolvedRoom;
            session.allergies = resolvedAllergies;
            session.state = 'complete';
            session.failedAttempts = 0; // Başarılı doğrulama, sayacı sıfırla
            // Kısmi bilgileri temizle
            delete session.partialName;
            delete session.partialRoom;

            if (validation.guest) {
                session.real_first_name = validation.guest.first_name;
                session.last_name = validation.guest.last_name;
                session.checkin_date = validation.guest.checkin_date;
                session.checkout_date = validation.guest.checkout_date;
            }

            console.log(`✅ [DOĞRULANDI] Misafir: ${resolvedName}, Oda: ${resolvedRoom}, chatId: ${chatId}`);

            // Alerji Protokolü...
            if (resolvedAllergies && resolvedAllergies.toLowerCase() !== 'yok' && resolvedAllergies.toLowerCase() !== 'none') {
                await alertGuestRelationsAboutAllergy(resolvedName, resolvedRoom, resolvedAllergies);
            }

            // Bekleyen talebi işle
            if (session.pendingAI) {
                const { department, turkishSummary, replyToUser } = session.pendingAI;
                await routeToDepartment(ctx, department, turkishSummary, chatId, resolvedName, resolvedRoom);
                
                // MULTILINGUAL CONFIRMATION: "Request forwarded immediately."
                const finalMsg = await generateFinalConfirmation(resolvedName, resolvedRoom, replyToUser);
                await ctx.reply(finalMsg);
                await saveMessageToDashboard(chatId, 'assistant', finalMsg);
                session.pendingAI = null;
            }
        } else {
            // Bilgi anlaşılmadı veya hiçbir bilgi çıkarılamadı, tekrar sor
            session.failedAttempts++;
            // Kısmi bilgileri temizle (yeni turda baştan başlasın)
            delete session.partialName;
            delete session.partialRoom;
            await askForGuestInfo(ctx, Math.min(session.failedAttempts + 1, 3));
        }
        return;
    }

    // ── BLOCKED durumunda yeni talep gelirse ─────────────────────────
    if (session.state === 'blocked') {
        // Sadece SORU ise yanıtla, TALEP ise resepsiyona yönlendir
        await ctx.sendChatAction('typing');
        const aiResult = await processMessageWithAI(userText, session);
        if (aiResult.isRequest) {
            await ctx.replyWithMarkdown(`Talebiniz için lütfen resepsiyonumuzu arayın:\n📞 *+90 (850) 222 72 75*`);
            return;
        }
        await ctx.reply(aiResult.replyToUser);
        await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
        return;
    }

    // ── NORMAL AKIŞ: AI ile mesajı değerlendir ─────────────────────────
    await ctx.sendChatAction('typing');
    const aiResult = await processMessageWithAI(userText, session);

    // Talep ise departmana yönlendir
    if (aiResult.isRequest && aiResult.department) {
        if (session.state === 'complete' && session.name && session.room) {
            // Misafir zaten tanımlı ve doğrulanmış: AI yanıtını gönder, sonra yönlendir
            await ctx.reply(aiResult.replyToUser);
            await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
            await routeToDepartment(ctx, aiResult.department, aiResult.turkishSummary, chatId, session.name, session.room);
        } else {
            // ══════════════════════════════════════════════════════════
            // KRİTİK: Misafir bilgisi yok / doğrulanmamış!
            // AI'ın replyToUser mesajını GÖNDERMİYORUZ!
            // Çünkü AI kendi başına "oda numaranızı paylaşır mısınız?" diyebilir
            // ve bu standart doğrulama akışını bozar.
            // Bunun yerine sadece askForGuestInfo mesajımızı gönderiyoruz.
            // ══════════════════════════════════════════════════════════
            session.pendingAI = aiResult;
            session.state = 'awaiting_info';
            console.log(`🔒 [DOĞRULAMA GEREKLİ] chatId: ${chatId} | Talep: ${aiResult.turkishSummary} | Dept: ${aiResult.department}`);
            console.log(`   ↳ AI replyToUser ENGELLENDI (doğrulama öncelikli): "${(aiResult.replyToUser || '').substring(0, 80)}..."`);
            await askForGuestInfo(ctx, 1, 'both');
        }
    } else if (!aiResult.isRequest) {
        // ══════════════════════════════════════════════════════════
        // GÜVENLİK AĞI: AI isRequest:false dedi ama mesajda servis
        // talebi anahtar kelimeleri varsa, zorla doğrulama akışını tetikle.
        // Bu, AI'ın talepleri soru olarak sınıflandırması sorununu çözer.
        // ══════════════════════════════════════════════════════════
        if (session.state !== 'complete' && isServiceRequest(userText)) {
            console.warn(`🛡️ [SAFETY_NET] AI isRequest:false döndü ama servis talebi tespit edildi! Doğrulama akışı zorlanıyor.`);
            console.warn(`   ↳ Kullanıcı mesajı: "${userText.substring(0, 100)}"`);
            console.warn(`   ↳ AI yanıtı ENGELLENDİ: "${(aiResult.replyToUser || '').substring(0, 100)}"`);

            const detectedDept = aiResult.department || detectDepartmentFromText(userText);
            session.pendingAI = {
                ...aiResult,
                isRequest: true,
                department: detectedDept,
                turkishSummary: aiResult.turkishSummary || `Misafir talep oluşturdu: ${userText.substring(0, 60)}`,
                replyToUser: 'Talebinizi aldım! Hızlıca iletebilmem için birkaç bilgiye ihtiyacım var. 🙏'
            };
            session.state = 'awaiting_info';
            console.log(`🔒 [DOĞRULAMA GEREKLİ - SAFETY NET] chatId: ${chatId} | Dept: ${detectedDept}`);
            await askForGuestInfo(ctx, 1, 'both');
        } else if (session.state === 'complete' && session.name && session.room && isServiceRequest(userText)) {
            // Doğrulanmış misafir ama AI talebi algılamadı → zorla departmana yönlendir
            console.warn(`🛡️ [SAFETY_NET_VERIFIED] AI isRequest:false döndü ama doğrulanmış misafirde servis talebi tespit edildi!`);
            const detectedDept = aiResult.department || detectDepartmentFromText(userText);
            const summary = aiResult.turkishSummary || `Misafir talep oluşturdu: ${userText.substring(0, 60)}`;
            const confirmMsg = `Talebinizi aldım, hemen ilgili birime iletiyorum! 🙏`;
            await ctx.reply(confirmMsg);
            await saveMessageToDashboard(chatId, 'assistant', confirmMsg);
            await routeToDepartment(ctx, detectedDept, summary, chatId, session.name, session.room);
        } else {
            // Gerçekten soru / bilgi talebi → direkt AI yanıtını gönder (doğrulama gerekmez)
            await ctx.reply(aiResult.replyToUser);
            await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
            console.log(`🤖 [${chatId}] AI: ${aiResult.replyToUser.substring(0, 80)}...`);
        }
    }
}

// ── Buton Aksiyonları ─────────────────────────────────────────────────
bot.action(/ack_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const user = ctx.from.first_name || "Personel";

    if (pendingTickets[ticketId]) {
        if (pendingTickets[ticketId].status === 'escalated') {
            await ctx.answerCbQuery('Süre aşılmıştı, yine de üstlenildi olarak işaretlendi!', { show_alert: true });
        } else {
            await ctx.answerCbQuery('Talep üstlenildi!');
        }

        clearTimeout(pendingTickets[ticketId].timer);
        pendingTickets[ticketId].status = 'acknowledged';

        const tk = pendingTickets[ticketId];
        const ackedAt = new Date().toISOString();
        const responseTimeSec = tk.createdAt
            ? Math.round((new Date(ackedAt) - new Date(tk.createdAt)) / 1000)
            : null;

        // Supabase güncelle
        await dbUpsertTicket({
            ticket_id: ticketId,
            status: 'ACKNOWLEDGED',
            acked_at: ackedAt,
            acked_by: user,
            response_time_sec: responseTimeSec
        });
        await dbLogEvent(ticketId, 'ACKNOWLEDGED', user, `Processing started. Response time: ${responseTimeSec ?? '?'}s`);

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(
            `${oldMsg}\n\n👷‍♂️ *Status:* ${user} (Acknowledged / Processing)`,
            { parse_mode: 'Markdown' }
        );

        await saveMessageToDashboard(tk.guestChatId, 'system',
            `${ticketId} acknowledged by ${user}.`, 'SLA_BOT');
    } else {
        await ctx.answerCbQuery('Ticket not found or expired.', { show_alert: true });
    }
});

bot.action(/busy_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const user = ctx.from.first_name || "Staff";

    if (pendingTickets[ticketId]) {
        await ctx.answerCbQuery('Marked as Busy / Delayed');
        
        const tk = pendingTickets[ticketId];
        await dbUpsertTicket({
            ticket_id: ticketId,
            status: 'BUSY_DELAYED',
            updated_at: new Date().toISOString()
        });
        await dbLogEvent(ticketId, 'BUSY_DELAYED', user, 'Staff is currently busy, request might be delayed.');

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(
            `${oldMsg}\n\n⏳ *Status:* ${user} (Busy / Delayed)`,
            { parse_mode: 'Markdown' }
        );

        // Notify guest about the delay
        try {
            await bot.telegram.sendMessage(tk.guestChatId, 
                `⏳ Sayın misafirimiz, talebinizle (${ticketId}) ilgileniyoruz ancak şu an yoğunluk nedeniyle kısa bir gecikme yaşanabilir. Anlayışınız için teşekkür ederiz. 🙏`);
        } catch (e) {}
    } else {
        await ctx.answerCbQuery('Ticket not found.', { show_alert: true });
    }
});

// ── /start ────────────────────────────────────────────────────────────
bot.start(async (ctx) => {
    const chatId = ctx.chat.id;
    // Oturumu sıfırla (blocked dahil tüm durumları kaldır)
    guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };

    const welcomeMsg = `🏨 *The Green Park Gaziantep'e Hoş Geldiniz!*

Sayın misafirimiz, otelimizdeki konaklamanızı keyifli ve konforlu hale getirmek için buradayız.

Memnuniyetiniz bizim için son derece önemlidir. Herhangi bir sorunuz ya da talebiniz olduğunda lütfen buradan bize bildirin — ekibimiz en kısa sürede ilgilenecektir. 🙏

━━━━━━━━━━━━━━━━━━━━━
🏨 Oda bilgileri ve fiyatlar
🍽️ Restoran & kahvaltı
💆 SPA & wellness
🏊 Havuz bilgileri
🏛️ Gaziantep gezi önerileri
🚗 Otopark & ulaşım
━━━━━━━━━━━━━━━━━━━━━

Sorunuzu *yazabilir* ya da *sesli mesaj* gönderebilirsiniz! 😊

📞 +90 (850) 222 72 75
📧 info@thegreenpark.com`;

    await ctx.replyWithMarkdown(welcomeMsg);
    await saveMessageToDashboard(chatId, 'assistant', welcomeMsg);

    // Otel krokisi / haritasını gönder
    const mapPath = path.resolve(__dirname, 'assets', 'hotel_harita.png');
    if (fs.existsSync(mapPath)) {
        try {
            await ctx.replyWithPhoto(
                { source: fs.createReadStream(mapPath) },
                { caption: '🗺️ *The Green Park Gaziantep — Otel Krokisi*\nTesisin genel yerleşim haritası aşağıdadır. İyi konaklamalar!', parse_mode: 'Markdown' }
            );
        } catch (e) {
            console.warn('Harita gönderilemedi:', e.message);
        }
    }
});



// ── /harita komutu ───────────────────────────────────────────────────
bot.command('harita', async (ctx) => {
    await sendHotelMap(ctx);
});

// ── Metin mesajları ───────────────────────────────────────────────────
bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const textMsg = ctx.message.text;
    console.log(`📨 [${chatId}] Müşteri: ${textMsg}`);

    // Harita / Kroki anahtar kelimesi algıla
    const mapKeywords = ['harita', 'kroki', 'map', 'floor plan', 'plan', 'layout', 'nerede', 'where is', 'şema'];
    if (mapKeywords.some(k => textMsg.toLowerCase().includes(k))) {
        await sendHotelMap(ctx);
        return;
    }

    await handleIncomingMessage(ctx, textMsg);
});

// ── Sesli mesajlar ────────────────────────────────────────────────────
bot.on('voice', async (ctx) => {
    const chatId = ctx.chat.id;
    try {
        const loadingMessage = await ctx.reply("🎤 Sesli mesajınız dinleniyor, lütfen bekleyin...");
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

        const response = await axios({ method: 'GET', url: fileUrl, responseType: 'stream' });

        const tempOgg = path.resolve(__dirname, `${fileId}.ogg`);
        const tempMp3 = path.resolve(__dirname, `${fileId}.mp3`);

        const writer = fs.createWriteStream(tempOgg);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        if (!openai) {
            fs.unlinkSync(tempOgg);
            await ctx.telegram.editMessageText(ctx.chat.id, loadingMessage.message_id, undefined,
                "⚙️ OpenAI API anahtarı tanımlı değil. Sesli mesajlar çalışmıyor.");
            return;
        }

        await convertOggToMp3(tempOgg, tempMp3);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempMp3),
            model: "whisper-1"
        });

        const transcribedText = transcription.text;

        await ctx.telegram.editMessageText(
            ctx.chat.id,
            loadingMessage.message_id,
            undefined,
            `🎤 *Duyduğum:* "${transcribedText}"\n\n⏳ İşleniyor...`,
            { parse_mode: 'Markdown' }
        );

        if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);

        console.log(`🎤 [${chatId}] Sesli -> Metin: ${transcribedText}`);
        await handleIncomingMessage(ctx, transcribedText);

    } catch (err) {
        console.error("Sesli mesaj hatası:", err);
        await ctx.reply("Ses dosyasını işlerken bir hata oluştu. Lütfen tekrar deneyin.");
    }
});

// ── Webhook Endpoint for Instagram / ManyChat (n8n integration) ───────
app.post('/api/webhook/instagram', async (req, res) => {
    try {
        const payload = req.body;
        console.log("📨 [INSTAGRAM WEBHOOK] Veri geldi:", payload);

        const contactId = payload.contact_id;
        const msgText = payload.text;
        const roomNo = payload.room_number || "Bilinmiyor";
        const fullName = payload.full_name || "Instagram Misafiri";
        const platform = payload.platform || "instagram";

        if (!msgText) {
            return res.status(400).json({ success: false, error: "Mesaj metni (text) eksik." });
        }

        // 1. Dashboard'a mesajı 'user' rolüyle kaydet
        await saveMessageToDashboard(contactId, 'user', msgText, platform);
        console.log(`🤖 Instagram'dan gelen mesaj yapay zekaya gönderiliyor... (Kişi: ${fullName})`);

        // 2. Mesajı analiz et (isRequest, department, summary, replyToUser)
        const dummySession = {
            state: 'complete',
            real_first_name: fullName.split(' ')[0] || 'Misafir',
            last_name: fullName.split(' ').slice(1).join(' ') || '',
            room: roomNo,
            checkin_date: 'Bilinmiyor',
            checkout_date: 'Bilinmiyor'
        };
        const aiResult = await processMessageWithAI(msgText, dummySession);

        // 3. İstek ise ODA/İSİM doğrulaması (STRICT CHECK)
        if (aiResult.isRequest && aiResult.department) {
            
            // WEBHOOK'ta da GUEST VALIDATION mecburidir.
            const validation = await validateGuestInHouse(fullName, roomNo);
            
            if (!validation.valid) {
                const failMsg = `⚠️ İşleminiz gerçekleştirilemiyor. Belirttiğiniz ad ve oda numarası aktif konaklayan in-house misafir listemizle eşleşmedi. Lütfen bilgilerinizi kontrol ediniz.`;
                await saveMessageToDashboard(contactId, 'assistant', failMsg, platform);
                console.log(`🚫 [WEBHOOK BANNED] İn-House eşleşmedi: ${fullName} / Oda: ${roomNo}`);
                return res.json({
                    success: false,
                    action: "REJECTED_NOT_IN_HOUSE",
                    reply_text: failMsg
                });
            }

            // Doğrulandıysa routeToDepartment (ctx=null gönderip platform='instagram' ekliyoruz)
            await routeToDepartment(
                null,
                aiResult.department,
                aiResult.turkishSummary,
                contactId,
                fullName,
                roomNo,
                platform
            );

            // Dashboard'a AI cevabını 'assistant' olarak kaydet
            await saveMessageToDashboard(contactId, 'assistant', aiResult.replyToUser, platform);

            // ManyChat / n8n'e hemen JSON döner
            return res.json({
                success: true,
                action: "ROUTED_TO_DEPARTMENT",
                department: aiResult.department,
                reply_text: aiResult.replyToUser
            });
        } else {
            // Sadece bir soru ise (Question/Greeting)
            await saveMessageToDashboard(contactId, 'assistant', aiResult.replyToUser, platform);

            return res.json({
                success: true,
                action: "REPLIED_BY_AI",
                reply_text: aiResult.replyToUser
            });
        }
    } catch (err) {
        console.error("Instagram webhook işlenirken hata:", err);
        return res.status(500).json({ success: false, error: "Sunucu hatası" });
    }
});

// Express API'yi başlat
app.listen(EXPRESS_PORT, () => {
    console.log(`🌐 Express API (Instagram Webhook için) ${EXPRESS_PORT} portunda dinliyor.`);
});

// ── Botu Başlat (İptal Edildi - Telegram Worker'a taşındı) ─────────────
console.log("🚀 The Green Park Gaziantep Webhook API başlatıldı! (Telegraf Long-Polling iptal edildi)");
console.log(`🔗 Dashboard API: ${DASHBOARD_API}`);
console.log(`🤖 AI Model: GPT-4o`);
console.log(`⏱️  SLA Sistemi: Aktif (60 saniye)`);
console.log(`👤 Telegram Guest Interaction: telegram_worker.js üzerinden ilerleyecek`);

// Telegram işlemleri webhook tetiklendiğinde bot.telegram.sendMessage üzerinden yürütüldüğü için
// polling başlatmaya (bot.launch) gerek kalmadı.
process.once('SIGINT', () => process.exit(0));
process.once('SIGTERM', () => process.exit(0));

