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

// ── ÇOK BOT MİMARİSİ: Yöneticilerin kendi botlarını da başlat ───────
// Her yöneticinin farklı token'ı varsa ayrı bir Telegraf instance oluştur
const secondaryBots = [];
if (telegramConfig.managers) {
    for (const [managerId, manager] of Object.entries(telegramConfig.managers)) {
        if (manager.botToken && manager.botToken !== botToken) {
            const secBot = new Telegraf(manager.botToken);
            secBot._managerName = manager.name;
            secBot._managerId = managerId;
            secondaryBots.push(secBot);
            console.log(`🤖 [MULTI-BOT] ${manager.name} için ek bot instance oluşturuldu (token: ...${manager.botToken.slice(-8)})`);
        }
    }
}

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

// ── Departman Türkçe Görüntüleme Adları ────────────────────────────────
function getDepartmentDisplayName(dept) {
    const names = {
        'HOUSEKEEPING': 'KAT HİZMETLERİ',
        'TEKNIK': 'TEKNİK SERVİS',
        'RESEPSIYON': 'RESEPSİYON',
        'F&B': 'YİYECEK & İÇECEK',
        'GUEST_RELATIONS': 'MİSAFİR İLİŞKİLERİ',
        'SPA': 'SPA'
    };
    return names[dept] || dept;
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
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
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
// Factory-based skill'ler: bot ve supabase inject edilerek oluşturuluyor
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

// ── AI ile mesaj işle (Soru mu, Talep mi?) ────────────────────────────
async function processMessageWithAI(userText, session = null) {
    if (!openai) {
        return { replyToUser: "⚙️ OpenAI API anahtarı tanımlı değil.", isRequest: false };
    }

    let targetDepartment = detectDepartmentFromText(userText);
    let locationData = null;

    // Eğer Konum/Adres/Nerede gibi bir soruysa, DB'den konumu çek (RESEPSIYON a yönlenir)
    if (supabase) {
        const locKeywords = ['konum', 'lokasyon', 'nerede', 'adres', 'nasıl gelirim', 'navigasyon', 'harita', 'yol tarifi', 'ulaşım', 'neredesiniz', 'nasıl gelir', 'yol'];
        const locMatched = locKeywords.find(k => userText.toLowerCase().includes(k));

        // ── NİYET (INTENT) FİLTRESİ ──────────────────────────────────────
        // Kullanıcı sadece teşekkür/onay/kabul ediyorsa lokasyon GÖNDERME.
        // Keyword geçse bile bağlam "talep" değilse ateşleme.
        const thankYouPatterns = [
            'teşekkür', 'tesekkur', 'teşekkürler', 'sağ ol', 'sag ol',
            'tamam', 'tamamdır', 'anladım', 'anladim', 'harika', 'güzel', 'süper',
            'mükemmel', 'çok iyi', 'aldım', 'aldim', 'gördüm', 'gordum',
            'oldu', 'tamam oldu', 'evet tamam', 'ok', '👍', '🙏', '❤️', '😊'
        ];
        const isThankYouOnly = thankYouPatterns.some(p => userText.toLowerCase().includes(p))
            && !['nerede', 'nasıl', 'hangi', 'ne zaman', 'ver', 'gönder',
                 'istiyorum', 'lazım', 'olur mu', 'yardım', '?'].some(q => userText.toLowerCase().includes(q));

        if (locMatched && !isThankYouOnly) {
            console.log(`[LOCATION_TRIGGER] Keyword eşleşti: "${locMatched}" → Supabase'den hotel_location çekiliyor...`);
            try {
                const { data, error } = await supabase
                    .from('hotel_settings')
                    .select('value')
                    .eq('key', 'hotel_location')
                    .single();
                
                if (error) {
                    console.error('[LOCATION_FETCH_ERROR] Supabase hatası:', error.message);
                } else if (!data || !data.value) {
                    console.warn('[LOCATION_FETCH_WARN] Supabase\'den boş veri döndü!');
                } else {
                    locationData = data.value;
                    console.log(`✅ [LOCATION_LOADED] url: ${locationData.url} | desc: ${locationData.description?.substring(0,40)}...`);
                    // Konum sorusu → MUTLAKA RESEPSIYON promptu kullanılsın (location kuralları orada)
                    targetDepartment = 'RESEPSIYON';
                    console.log(`[LOCATION_DEPT_OVERRIDE] Departman RESEPSIYON olarak zorlandı.`);
                }
            } catch (e) {
                console.warn("[LOCATION_FETCH_ERROR]:", e.message);
            }
        } else if (locMatched && isThankYouOnly) {
            console.log(`[LOCATION_SKIP] Keyword "${locMatched}" geçti ama bağlam teşekkür/onay — lokasyon gönderilmiyor.`);
        }
    }

    let agencyData = null;
    // Eğer Rezervasyon/Acenta gibi bir konuysa, DB'den rezervasyon/acenta ayarlarını çek
    if (supabase) {
        const agencyKeywords = ['rezervasyon', 'acenta', 'acente', 'rezervasyon link', 'booking', 'fiyat', 'yer ayırt', 'oda ayırt', 'oda ayirt'];
        if (agencyKeywords.some(k => userText.toLowerCase().includes(k))) {
            try {
                const { data, error } = await supabase
                    .from('hotel_settings')
                    .select('value')
                    .eq('key', 'hotel_agencies')
                    .single();
                
                if (!error && data && data.value) {
                    agencyData = data.value;
                }
            } catch (e) {
                console.warn("[AGENCY_FETCH_ERROR]:", e.message);
            }
        }
    }

    const basePrompt = getPromptForDepartment(targetDepartment, locationData, agencyData);

    // Modüler bilgi bankası: Sadece ilgili bilgiyi yükle (token tasarrufu)
    const hotelKnowledge = getRelevantKnowledge(userText);

    // IBAN bilgisini sadece havale/EFT talep eden misafire sun
    let ibanData = null;
    if (supabase) {
        const ibanKeywords = ['iban', 'havale', 'eft', 'banka hesab', 'hesap numar', 'para gönder', 'transfer'];
        if (ibanKeywords.some(k => userText.toLowerCase().includes(k))) {
            try {
                const { data, error } = await supabase
                    .from('hotel_settings')
                    .select('value')
                    .eq('key', 'reception_settings')
                    .single();
                if (!error && data && data.value && data.value.ibanText) {
                    ibanData = data.value.ibanText;
                }
            } catch (e) {
                console.warn('[IBAN_FETCH_ERROR]:', e.message);
            }
        }
    }

    const nowStr = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "full", timeStyle: "short" });
    const isVerified = session && session.state === 'complete' && !!session.room;
    let requestHandlingRules = "";
    
    if (isVerified) {
        requestHandlingRules = `\n[ONAYLI MİSAFİR]\nMisafir doğrulandı (İsim: ${session.real_first_name || 'Mevcut'}, Oda: ${session.room}). Eğer fiziksel bir iş (talep) ise "isRequest": true ver ve "Talebinizi departmana ilettim" yaz. Misafire ismiyle hitap et.`;
    } else {
        requestHandlingRules = `\n[ONAYSIZ MİSAFİR]\nDoğrulanmamış misafir! Eğer fiziksel bir iş (talep) ise, KESİNLİKLE "Talebinizi aldım, lütfen isim soyisim ve oda numaranızı yazınız" cevabı ver. Başka hiçbir şey uydurma.`;
    }

    // "Ben kimim?" sorusuna cevap verebilmesi için
    let identityContext = '';
    if (isVerified && session) {
        identityContext = `\n[MİSAFİR KİMLİĞİ]\nBu misafiri tanıyorsun: ${session.real_first_name || ''} ${session.last_name || ''}, Oda: ${session.room}. Eğer misafir "ben kimim", "beni tanıyor musun" gibi bir soru sorarsa bu bilgiyi kullan ve kendisine güzel, nazik bir şekilde hitap et.`;
    }

    // IBAN kuralı
    let ibanRule = '';
    if (ibanData) {
        ibanRule = `\n[IBAN BİLGİSİ — SADECE TALEP EDİLDİĞİNDE VER]\nMisafir açıkça IBAN, havale veya EFT talep etti. Aşağıdaki bilgileri paylaş:\n${ibanData}`;
    } else {
        ibanRule = `\n[IBAN KURALI]\nIBAN bilgisi sadece misafir açıkça "IBAN", "havale", "EFT", "banka hesabı" gibi ödeme talebi yaptığında paylaşılır. Otel hakkında genel bilgi isteyenlere KESİNLİKLE IBAN verilmez.`;
    }

    // ── Çıkış / Giriş Tarihi Bilgisi (Misafir kendi rezervasyon tarihini soruyorsa DB'den al) ──
    let checkoutRule = '';
    if (session && session.state === 'complete' && session.checkout_date) {
        const dateKeywords = ['çıkış', 'cikis', 'check-out', 'checkout', 'ne zaman ayrılıyorum', 'ne zaman çıkıyorum', 'ayrılma', 'giriş tarihi', 'checkin', 'check-in', 'ne zaman geldim', 'tarihim', 'tarihimiz', 'rezervasyonum'];
        if (dateKeywords.some(k => userText.toLowerCase().includes(k))) {
            const checkoutFormatted = new Date(session.checkout_date).toLocaleDateString('tr-TR', {
                year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
            });
            const checkinFormatted = session.checkin_date
                ? new Date(session.checkin_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })
                : null;
            checkoutRule = `\n[ÖZEL DURUM — REZERVASYOn TARİH BİLGİSİ]\nMisafir kendi çıkış veya giriş tarihini sordu. Bu tartışmasız BİLGİ isteğidir. KESİNLİKLE "isRequest": false döndür, resepsiyona YÖNLENDIRME!\nMisafirin sisteme kayıtlı çıkış tarihi: ${checkoutFormatted}${checkinFormatted ? `\nMisafirin giriş tarihi: ${checkinFormatted}` : ''}\nYapman gereken:\n1. Misafire ismiyle (${session.real_first_name}) nazikçe hitap et.\n2. "Çıkış tarihiniz ${checkoutFormatted} olarak görünüyor." şeklinde bilgi ver.\n3. Eğer misafir tarihi UZATMAK veya DEĞİŞTİRMEK isterse yalnızca şunu söyle: "Bu konuda resepsiyonumuzla irtibata geçmenizi öneririm." — başka işlem yapma, isRequest: false olarak kal.`;
            console.log(`[CHECKOUT_RULE] ${session.real_first_name} için çıkış tarihi prompt'a enjekte edildi: ${checkoutFormatted}`);
        }
    }

    // ÇOK SIKI VE KISA SYSTEM PROMPT (DİNAMİK)
    const SYSTEM_PROMPT = `${basePrompt}\n\nOtel Bilgileri:\n${hotelKnowledge}\n\nTarih/Saat: ${nowStr}${requestHandlingRules}${identityContext}${ibanRule}${checkoutRule}\n\n⛔ ASLA UYDURMA İSİM veya ODA KULLANMA. JSON FORMATINDA SADECE İSTENENİ DÜN.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userText }
            ],
            response_format: { type: "json_object" },
            max_tokens: 800,
            temperature: 0.0 // SIFIR halüsinasyon — kurumsal kullanım için yaratıcılık tamamen kapatıldı
        });
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

// ── Supabase'ten Oturum Geri Yükleme (Session Restore) ──────────────
async function restoreSessionFromDB(chatId) {
    if (!supabase) {
        console.log(`[SESSION_RESTORE] Supabase bağlantısı yok, restore atlanıyor. chatId: ${chatId}`);
        return null;
    }
    try {
        console.log(`[SESSION_RESTORE] chatId: ${chatId} için DB sorgusu yapılıyor...`);
        const { data, error } = await supabase
            .from('in_house_guests')
            .select('*')
            .eq('telegram_chat_id', String(chatId))
            .limit(1);

        if (error) {
            console.error(`[SESSION_RESTORE] DB hatası: ${error.message}`);
            return null;
        }

        if (!data || data.length === 0) {
            console.log(`[SESSION_RESTORE] chatId: ${chatId} için kayıt bulunamadı.`);
            return null;
        }

        const guest = data[0];
        console.log(`[SESSION_RESTORE] DB'den bulundu: ${guest.first_name} ${guest.last_name || ''} / Oda: ${guest.room_number} / Check-in: ${guest.checkin_date || 'YOK'} / Check-out: ${guest.checkout_date || 'YOK'}`);

        // Tarih kontrolü — tarihler var ve geçerliyse kontrol et
        if (guest.checkin_date && guest.checkout_date) {
            const now = new Date();
            const checkin = new Date(guest.checkin_date);
            const checkout = new Date(guest.checkout_date);

            // Geçersiz tarih kontrolü (Invalid Date)
            if (isNaN(checkin.getTime()) || isNaN(checkout.getTime())) {
                console.warn(`[SESSION_RESTORE] Geçersiz tarih formatı (checkin: ${guest.checkin_date}, checkout: ${guest.checkout_date}). Tarih kontrolü atlanıyor, oturum yükleniyor.`);
            } else {
                checkout.setHours(23, 59, 59, 999);
                if (now < checkin || now > checkout) {
                    console.log(`[SESSION_RESTORE] Tarih aralığı dışında. Şimdi: ${now.toISOString()} / Check-in: ${checkin.toISOString()} / Check-out: ${checkout.toISOString()}`);
                    return null; // Konaklama dönemi dışında
                }
            }
        } else {
            // Tarihler yoksa telegram_chat_id eşleşmesine güven (test/yedek mod)
            console.warn(`[SESSION_RESTORE] Tarih bilgisi eksik, telegram_chat_id eşleşmesine dayanarak oturum yükleniyor.`);
        }

        console.log(`♻️ [SESSION DB RESTORE] chatId: ${chatId} → ${guest.first_name} ${guest.last_name || ''} / Oda: ${guest.room_number}`);
        return {
            name: `${guest.first_name} ${guest.last_name || ''}`.trim(),
            room: guest.room_number,
            state: 'complete',
            pendingAI: null,
            failedAttempts: 0,
            real_first_name: guest.first_name,
            last_name: guest.last_name,
            checkin_date: guest.checkin_date,
            checkout_date: guest.checkout_date
        };
    } catch (e) {
        console.error('[SESSION_RESTORE] Hata:', e.message);
        return null;
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

    // ── YÖNETİCİYE ÖZEL DEPARTMAN YÖNLENDİRME ──────────────────────
    // Mesajı hangi bot aldıysa, o bot'un yöneticisinin departman gruplarına gönder.
    // Bu sayede Kemal'in bot'undan gelen talep → Kemal'in HK grubuna,
    // Özgür'ün bot'undan gelen talep → Özgür'ün HK grubuna gider.
    let configChatIds = [];
    try {
        const fs = require('fs');
        const path = require('path');
        const configPath = path.join(__dirname, 'skills', 'telegram_config.json');
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            
            // Hangi bot'un token'ı ile mesaj alındığını tespit et
            const currentBotToken = ctx.telegram && ctx.telegram.token ? ctx.telegram.token : botToken;
            
            // Bu token'a ait yöneticiyi bul
            let matchedManager = null;
            if (config.managers) {
                for (const [managerId, manager] of Object.entries(config.managers)) {
                    if (manager.botToken === currentBotToken) {
                        matchedManager = manager;
                        console.log(`🎯 [ROUTING] Yönetici eşleşti: ${manager.name} (bot token: ...${currentBotToken.slice(-8)})`);
                        break;
                    }
                }
            }
            
            if (matchedManager && matchedManager.departments && matchedManager.departments[department]) {
                // Yöneticinin kendi departman grubuna gönder
                const deptInfo = matchedManager.departments[department];
                if (deptInfo.chatId) {
                    configChatIds = [deptInfo.chatId];
                    console.log(`📍 [ROUTING] ${department} → ${deptInfo.groupName} (chatId: ${deptInfo.chatId})`);
                }
            } else if (config.departments && config.departments[department] && config.departments[department].active) {
                // Yönetici eşleşemedi → fallback: ilk chatId'yi kullan (ana yönetici)
                const chatIds = config.departments[department].chatIds;
                if (chatIds && chatIds.length > 0) {
                    configChatIds = [chatIds[0]]; // Sadece ilk (ana) yöneticiyi kullan
                    console.warn(`⚠️ [ROUTING] Yönetici eşleşemedi, fallback: ${department} → ilk chatId: ${chatIds[0]}`);
                }
            }
        }
    } catch (e) {
        console.error("Telegram config okunurken hata:", e.message);
    }

    // Tüm config chatId'lerini targetPersonnel'e ekle (duplikat kontrolü ile)
    if (configChatIds.length > 0) {
        // ── DÜZELTME: Veritabanından gelen TELEGRAM platformlu olanlar arasında ──
        // ── o anki yöneticinin grubuna AİT OLMAYANLARI filtrele (yani Özgür'ün botunda Kemal'in ID'sini sil) ──
        targetPersonnel = targetPersonnel.filter(p => {
            if (p.platform.toUpperCase() !== 'TELEGRAM') return true; // WhatsApp vs. kalsın
            return configChatIds.includes(String(p.contact_id)); // Sadece bu yöneticinin ID'sine eşleşenler kalsın
        });

        // Config'deki ID henüz listede yoksa kendimiz ekleyelim
        for (const cid of configChatIds) {
            const hasGroup = targetPersonnel.some(p => String(p.contact_id) === String(cid));
            if (!hasGroup) {
                targetPersonnel.push({ full_name: `${department} (Grup)`, platform: 'TELEGRAM', contact_id: cid });
            }
        }
    } else {
        // Fallback: Eskiden kalan env yöntemine düş
        let envContactId = null;
        switch(department) {
            case 'HOUSEKEEPING': envContactId = process.env.DEPT_HOUSEKEEPING_ID; break;
            case 'TEKNIK': envContactId = process.env.DEPT_TEKNIK_ID; break;
            case 'RESEPSIYON': envContactId = process.env.DEPT_RESEPSIYON_ID; break;
            case 'F&B': envContactId = process.env.DEPT_FB_ID; break;
            case 'GUEST_RELATIONS': envContactId = process.env.DEPT_GUEST_RELATIONS_ID; break;
            case 'SPA': envContactId = process.env.DEPT_SPA_ID; break;
        }
        if (envContactId) {
            const hasGroup = targetPersonnel.some(p => String(p.contact_id) === String(envContactId));
            if (!hasGroup) {
                targetPersonnel.push({ full_name: `${department} (Grup)`, platform: 'TELEGRAM', contact_id: envContactId });
            }
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
    const taskMessage = `🔔 *GÖREV BİLDİRİMİ*
    
[${guestRoom} | ${turkishSummary}]

⏰ *SLA:* 1 Dakika
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

        // 3. HER BİR YETKİLİYE — mesajı alan bot üzerinden gönder (ctx.telegram)
        // Bu sayede Kemal'in bot'undan gelen talep → Kemal'in bot'u ile Kemal'in gruplarına gider
        const senderTelegram = ctx.telegram || bot.telegram;
        for (const person of targetPersonnel) {
            if (person.platform.toUpperCase() === 'TELEGRAM') {
                try {
                    const sentMsg = await senderTelegram.sendMessage(person.contact_id, taskMessage, {
                        parse_mode: 'Markdown',
                        ...Markup.inlineKeyboard([
                            Markup.button.callback('👍 Onaylandı - Hemen İlgileniyorum', `ack_${ticketId}`),
                            Markup.button.callback('⏳ Meşgulüm - En Kısa Sürede İlgileneceğim', `busy_${ticketId}`)
                        ])
                    });
                    if (!firstMessageId) firstMessageId = sentMsg.message_id;
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

        // 4. RESEPSİYONA KOPYA BİLGİ VERME (Yöneticinin kendi Resepsiyon grubuna)
        if (department !== "RESEPSIYON") {
            try {
                const currentBotToken = ctx.telegram && ctx.telegram.token ? ctx.telegram.token : botToken;
                const _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'skills', 'telegram_config.json'), 'utf8'));
                let resChatId = null;
                
                // Yöneticinin kendi RESEPSIYON grubunu bul
                if (_cfg.managers) {
                    for (const [, mgr] of Object.entries(_cfg.managers)) {
                        if (mgr.botToken === currentBotToken && mgr.departments && mgr.departments.RESEPSIYON) {
                            resChatId = mgr.departments.RESEPSIYON.chatId;
                            break;
                        }
                    }
                }

                if (resChatId) {
                    const infoMsg = `📋 *BİLGİ (Kopyası)*
👤 *Misafir:* ${guestName} | 🚪 *Oda:* ${guestRoom}
➡️ *Yönlendirilen Departman:* ${getDepartmentDisplayName(department)}
📝 *Talep:* ${turkishSummary}`;
                    try {
                        await senderTelegram.sendMessage(resChatId, infoMsg, { parse_mode: 'Markdown' });
                        console.log(`📋 [RESEPSİYON KOPYA] ${department} talebi → Resepsiyon grubuna bilgi gitti (chatId: ${resChatId})`);
                    } catch (e) {
                        console.warn(`⚠️ Resepsiyon kopya gönderilemedi: ${e.message}`);
                    }
                }
            } catch (e) {
                console.warn('Resepsiyon bilgi kopyası hatası:', e.message);
            }
        }

        // 5. SLA ZAMANLAYICISINI (Dinamik: Departman bazlı veya varsayılan 1 dk) BAŞLAT
        let slaMin = 1;
        if (supabase) {
            const { data: deptData } = await supabase.from('departments').select('sla_timeout_min').eq('name', department).single();
            if (deptData && deptData.sla_timeout_min) slaMin = deptData.sla_timeout_min;
        }

        // Hangi bot ile eskalasyon gönderilecek — yakalayıp ticket'a kaydet
        const escalationBotToken = ctx.telegram && ctx.telegram.token ? ctx.telegram.token : botToken;

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
            escalationBotToken, // Hangi bot ile eskalasyon gönderileceğini kaydet
            timer: setTimeout(async () => {
                let shouldEscalate = false;
                
                // Bellek kontrolü (DB kuralı kaldırıldı — live_tickets tablosu kullanılıyor)
                const tk = pendingTickets[ticketId];
                if (tk && tk.status === 'pending') shouldEscalate = true;

                if (shouldEscalate) {
                    if (pendingTickets[ticketId]) pendingTickets[ticketId].status = 'escalated';
                    const escalatedAt = new Date().toISOString();
                    console.log(`⚠️ SLA AŞIMI: ${ticketId} - Resepsiyona iletiliyor...`);

                    // SLA Aşıldı -> DB Güncellemesi
                    const failureReason = `${getDepartmentDisplayName(department)} departmanı ${slaMin} dakika içinde yanıt vermedi.`;
                    await dbUpsertTicket({ 
                        ticket_id: ticketId, 
                        status: 'ESCALATED', 
                        escalated_at: escalatedAt,
                        failure_reason: failureReason
                    });
                    await dbLogEvent(ticketId, 'ESCALATED', 'system', failureReason);

                    // ── ESKALASYON HEDEFİ: Yöneticinin kendi RESEPSIYON grubuna gönder ──
                    let escalationChatId = null;
                    let escalationBot = bot; // Varsayılan: ana bot
                    
                    try {
                        const _cfgEsc = JSON.parse(fs.readFileSync(path.join(__dirname, 'skills', 'telegram_config.json'), 'utf8'));
                        if (_cfgEsc.managers) {
                            for (const [, mgr] of Object.entries(_cfgEsc.managers)) {
                                if (mgr.botToken === escalationBotToken && mgr.departments && mgr.departments.RESEPSIYON) {
                                    escalationChatId = mgr.departments.RESEPSIYON.chatId;
                                    // Doğru botu bul (ana veya ikincil)
                                    if (mgr.botToken === botToken) {
                                        escalationBot = bot;
                                    } else {
                                        const matched = secondaryBots.find(sb => sb.telegram && sb.telegram.token === mgr.botToken);
                                        if (matched) escalationBot = matched;
                                    }
                                    console.log(`🎯 [ESKALASYON] Hedef: ${mgr.name} Resepsiyon grubu (chatId: ${escalationChatId})`);
                                    break;
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Eskalasyon config okuma hatası:', e.message);
                    }
                    
                    // Fallback: Resepsiyon grubu bulunamazsa gönderenin chat'ine düş
                    if (!escalationChatId) {
                        escalationChatId = String(guestChatId);
                        console.warn(`⚠️ [ESKALASYON] Resepsiyon grubu bulunamadı, fallback chatId: ${escalationChatId}`);
                    }

                    const escalationMsg = `🔴 *ACİL BİLDİRİM (SLA Uyarısı)*

🏢 *Departman:* ${getDepartmentDisplayName(department)}
👤 *Misafir:* ${guestName} | 🚪 *Oda:* ${guestRoom}
📝 *Talep:* ${turkishSummary}

⏰ _Belirtilen süre (${slaMin} dk) içinde ilgili departmandan yanıt alınamadı._

⚠️ Lütfen aşağıdaki butona basarak aksiyonu kaydedin.
_Bu not raporlarda görünecektir._`;

                    pendingTickets[ticketId].escalateTarget = escalationChatId;

                    try {
                        await escalationBot.telegram.sendMessage(escalationChatId, escalationMsg, {
                            parse_mode: 'Markdown',
                            ...Markup.inlineKeyboard([
                                Markup.button.callback('⚠️ ACİL: İnceleme Notu Ekle', `note_${ticketId}`)
                            ])
                        });
                        console.log(`🚨 [ESKALASYON GÖNDERİLDİ] ${ticketId} → Resepsiyon (chatId: ${escalationChatId})`);
                    } catch (e) {
                        console.warn('Eskalasyon mesajı gönderilemedi:', e.message);
                    }

                    await saveMessageToDashboard(guestChatId, 'system',
                        `SLA Eskalasyonu: ${ticketId} - ${guestName} (Oda ${guestRoom}) yanıt vermedi, Resepsiyona iletildi.`, 'SLA_BOT');
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
    const deptName = tk ? getDepartmentDisplayName(tk.department) : '?';

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
🏢 *Departman:* ${deptName}
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
🏢 *Departman:* ${getDepartmentDisplayName(department)}
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
        console.log(`[SESSION] chatId: ${chatId} için bellekte oturum yok, DB'den restore deneniyor...`);
        // Önce DB'den restore etmeyi dene (bot restart sonrası bile çalışır)
        const restored = await restoreSessionFromDB(chatId);
        if (restored) {
            guestSessions[chatId] = restored;
            console.log(`[SESSION] ✅ DB'den restore edildi: ${restored.name} / Oda: ${restored.room} / Durum: ${restored.state}`);
        } else {
            guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };
            console.log(`[SESSION] ⚠️ DB'de kayıt bulunamadı, yeni oturum oluşturuldu. chatId: ${chatId}`);
        }
    } else {
        console.log(`[SESSION] chatId: ${chatId} bellekte mevcut — Durum: ${guestSessions[chatId].state} / Ad: ${guestSessions[chatId].name || 'Yok'} / Oda: ${guestSessions[chatId].room || 'Yok'}`);
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

            // Başarılı doğrulamada telegram_chat_id'yi DB'ye kaydet (session persistence)
            if (supabase && validation.guest) {
                try {
                    await supabase
                        .from('in_house_guests')
                        .update({ telegram_chat_id: String(chatId) })
                        .eq('room_number', String(resolvedRoom))
                        .ilike('first_name', `%${resolvedName.split(' ')[0]}%`);
                    console.log(`💾 [CHAT_ID SAVED] chatId: ${chatId} → in_house_guests kaydedildi.`);
                } catch (e) {
                    console.error('[CHAT_ID SAVE] Hata:', e.message);
                }
            }

            // Alerji Protokolü...
            if (resolvedAllergies && resolvedAllergies.toLowerCase() !== 'yok' && resolvedAllergies.toLowerCase() !== 'none') {
                await alertGuestRelationsAboutAllergy(resolvedName, resolvedRoom, resolvedAllergies, chatId);
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

    // ── POST-AI DOĞRULAMA: Yanlış Sınıflandırma Kontrolü ──────────────
    // AI isRequest:true döndü ama mesaj çok kısa bir selamlama ise (ör: "merhaba", "selam")
    // muhtemelen yanlış sınıflandırma — sadece bu durumda override et.
    // NOT: AI (GPT-4o) bağlamsal anlama konusunda anahtar kelime listesinden üstündür.
    // "Odama pizza alabilir miyim?" gibi talepler artık ENGELLENMİYOR.
    const greetingOnlyPatterns = /^(merhaba|selam|hey|hi|hello|meraba|slm|sa|selamlar|iyi günler|günaydın|iyi akşamlar|iyi geceler|nasılsınız|naber)\s*[?.!]*$/i;
    if (aiResult.isRequest && greetingOnlyPatterns.test(userText.trim())) {
        console.warn(`🔄 [AI SINIFLANDIRMA OVERRIDE] AI isRequest:true döndü ama mesaj sadece selamlama.`);
        console.warn(`   ↳ Mesaj: "${userText.substring(0, 100)}"`);
        console.warn(`   ↳ Soru olarak işleniyor, talep akışı engellendi.`);
        aiResult.isRequest = false;
    }

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
        await dbLogEvent(ticketId, 'ACKNOWLEDGED', user, `İşleme alındı. Yanıt süresi: ${responseTimeSec ?? '?'} sn`);

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(
            `${oldMsg}\n\n👷‍♂️ *Durum:* ${user} (Onaylandı / İşleme Alındı)`,
            { parse_mode: 'Markdown' }
        );

        await saveMessageToDashboard(tk.guestChatId, 'system',
            `${ticketId} ${user} tarafından onaylandı.`, 'SLA_BOT');
    } else {
        await ctx.answerCbQuery('Talep bulunamadı veya süresi dolmuş.', { show_alert: true });
    }
});

bot.action(/busy_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const user = ctx.from.first_name || "Personel";

    if (pendingTickets[ticketId]) {
        await ctx.answerCbQuery('Meşgul / Gecikmeli olarak işaretlendi');
        
        const tk = pendingTickets[ticketId];
        await dbUpsertTicket({
            ticket_id: ticketId,
            status: 'BUSY_DELAYED',
            updated_at: new Date().toISOString()
        });
        await dbLogEvent(ticketId, 'BUSY_DELAYED', user, 'Personel şu anda meşgul, talep gecikebilir.');

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(
            `${oldMsg}\n\n⏳ *Durum:* ${user} (Meşgul / Gecikmeli)`,
            { parse_mode: 'Markdown' }
        );

        // Notify guest about the delay
        try {
            await bot.telegram.sendMessage(tk.guestChatId, 
                `⏳ Sayın misafirimiz, talebinizle ilgileniyoruz ancak şu an yoğunluk nedeniyle kısa bir gecikme yaşanabilir. Anlayışınız için teşekkür ederiz. 🙏`);
        } catch (e) {}
    } else {
        await ctx.answerCbQuery('Talep bulunamadı.', { show_alert: true });
    }
});

// ── /start Handler (Paylaşılan fonksiyon — tüm botlar için ortak) ─────
async function handleStart(ctx) {
    const chatId = ctx.chat.id;
    
    // Önce DB'den oturum restore et — daha önce doğrulanmış misafirse sıfırlama
    let existingSession = null;
    const restored = await restoreSessionFromDB(chatId);
    if (restored) {
        guestSessions[chatId] = restored;
        existingSession = restored;
        console.log(`♻️ [/START] chatId: ${chatId} → Mevcut oturum korunuyor: ${restored.name} / Oda: ${restored.room}`);
    } else {
        // DB'de kayıt yok veya süresi dolmuş — oturumu sıfırla
        guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };
        console.log(`[/START] chatId: ${chatId} → Yeni oturum oluşturuldu.`);
    }

    // Kişiselleştirilmiş karşılama
    let greetingName = '';
    if (existingSession && existingSession.real_first_name) {
        greetingName = `\n\nTekrar hoş geldiniz, *${existingSession.real_first_name} ${existingSession.last_name || ''}*! 🎉 Sizi tekrar görmekten mutluluk duyuyoruz.`;
    }

    const welcomeMsg = `🏨 *The Green Park Gaziantep'e Hoş Geldiniz!*${greetingName}

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
📧 info@thegreenpark.com
🌐 www.thegreenpark.com/gaziantep`;

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

    // ── OTOMATİK KONUM GÖNDERİMİ (DB'den) ──────────────────────────
    if (supabase) {
        try {
            const { data: locData, error: locError } = await supabase
                .from('hotel_settings')
                .select('value')
                .eq('key', 'hotel_location')
                .single();
            if (!locError && locData && locData.value && locData.value.url) {
                const locMsg = `📍 *Otel Konumu & Yol Tarifi*\n\n${locData.value.description || 'Aşağıdaki linkten bize kolayca ulaşabilirsiniz.'}\n\n🗺️ Harita: ${locData.value.url}`;
                await ctx.replyWithMarkdown(locMsg);
                await saveMessageToDashboard(chatId, 'assistant', locMsg);
                console.log(`📍 [/START] Konum bilgisi otomatik gönderildi → chatId: ${chatId}`);
            }
        } catch (e) {
            console.warn('[/START LOCATION] Konum gönderimi hatası:', e.message);
        }
    }
}
bot.start(handleStart);



// ── /harita Handler (Paylaşılan) ──────────────────────────────────────
async function handleHarita(ctx) {
    await sendHotelMap(ctx);
}
bot.command('harita', handleHarita);

// ── Metin mesajları Handler (Paylaşılan) ──────────────────────────────
async function handleText(ctx) {
    const chatId = ctx.chat.id;
    const textMsg = ctx.message.text;
    console.log(`📨 [${chatId}] Müşteri: ${textMsg}`);

    // ── ÇEVRE SORUSU? → Perplexity ile yanıtla ────────────────────────
    // NOT: 'nerede', 'konum' gibi kelimeler lokasyon için handleIncomingMessage'da da işleniyor.
    // Sadece gerçek çevre soruları (restoran, gezi, müze vb.) buraya düşsün.
    if (isSurroundingsQuestion(textMsg)) {
        // Lokasyon/adres soruları Perplexity'ye değil, DB'deki konum verisine gitsin
        const locOnlyKeywords = ['konum', 'lokasyon', 'adres', 'nasıl gelirim', 'yol tarifi', 'neredesiniz'];
        const isLocOnly = locOnlyKeywords.some(k => textMsg.toLowerCase().includes(k))
            && !['restoran', 'kafe', 'müze', 'gezi', 'gezilecek', 'yakın', 'nearby', 'yakında', 'civar', 'etraf', 'ne var', 'nereye'].some(k => textMsg.toLowerCase().includes(k));

        if (!isLocOnly) {
            console.log(`[PERPLEXITY] Çevre sorusu tespit edildi, arama başlatılıyor...`);
            await ctx.sendChatAction('typing');
            const searchResult = await searchSurroundings(textMsg, openai);
            if (searchResult && searchResult.content) {
                const sourceTag = searchResult.source === 'perplexity' ? '🔍 *Güncel Bilgi*' : '📍 *Bölge Bilgisi*';
                const reply = `${sourceTag}\n\n${searchResult.content}\n\n_The Green Park Gaziantep — Misafir Asistanı_`;
                await ctx.replyWithMarkdown(reply);
                await saveMessageToDashboard(chatId, 'assistant', reply);
                console.log(`✅ [PERPLEXITY] Yanıt gönderildi → chatId: ${chatId} (kaynak: ${searchResult.source})`);
                return;
            }
        }
    }

    // Harita / Kroki anahtar kelimesi algıla (sadece otel içi kroki, lokasyon değil)
    const mapKeywords = ['kroki', 'map', 'floor plan', 'plan', 'layout', 'kat planı', 'şema'];
    if (mapKeywords.some(k => textMsg.toLowerCase().includes(k))) {
        await sendHotelMap(ctx);
        return;
    }

    await handleIncomingMessage(ctx, textMsg);
}
bot.on('text', handleText);

// ── Sesli mesajlar Handler (Paylaşılan) ───────────────────────────────
async function handleVoice(ctx) {
    const chatId = ctx.chat.id;
    // Hangi bot'un token'ını kullanacağımızı belirle (sesli dosya indirmek için)
    const currentBotToken = ctx.telegram.token || botToken;
    try {
        const loadingMessage = await ctx.reply("🎤 Sesli mesajınız dinleniyor, lütfen bekleyin...");
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${currentBotToken}/${file.file_path}`;

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
}
bot.on('voice', handleVoice);

// ── İKİNCİL BOTLARA HANDLERLARI KAYDET ───────────────────────────────
// Tüm secondary bot'lara aynı handler'ları bağla
for (const secBot of secondaryBots) {
    // Action handler'ları (butonlar)
    secBot.action(/ack_(.+)/, async (ctx) => {
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
            const responseTimeSec = tk.createdAt ? Math.round((new Date(ackedAt) - new Date(tk.createdAt)) / 1000) : null;
            await dbUpsertTicket({ ticket_id: ticketId, status: 'ACKNOWLEDGED', acked_at: ackedAt, acked_by: user, response_time_sec: responseTimeSec });
            await dbLogEvent(ticketId, 'ACKNOWLEDGED', user, `İşleme alındı. Yanıt süresi: ${responseTimeSec ?? '?'} sn`);
            const oldMsg = ctx.callbackQuery.message.text;
            await ctx.editMessageText(`${oldMsg}\n\n👷‍♂️ *Durum:* ${user} (Onaylandı / İşleme Alındı)`, { parse_mode: 'Markdown' });
            await saveMessageToDashboard(tk.guestChatId, 'system', `${ticketId} ${user} tarafından onaylandı.`, 'SLA_BOT');
        } else {
            await ctx.answerCbQuery('Talep bulunamadı veya süresi dolmuş.', { show_alert: true });
        }
    });
    secBot.action(/busy_(.+)/, async (ctx) => {
        const ticketId = ctx.match[1];
        const user = ctx.from.first_name || "Personel";
        if (pendingTickets[ticketId]) {
            await ctx.answerCbQuery('Meşgul / Gecikmeli olarak işaretlendi');
            const tk = pendingTickets[ticketId];
            await dbUpsertTicket({ ticket_id: ticketId, status: 'BUSY_DELAYED', updated_at: new Date().toISOString() });
            await dbLogEvent(ticketId, 'BUSY_DELAYED', user, 'Personel şu anda meşgul, talep gecikebilir.');
            const oldMsg = ctx.callbackQuery.message.text;
            await ctx.editMessageText(`${oldMsg}\n\n⏳ *Durum:* ${user} (Meşgul / Gecikmeli)`, { parse_mode: 'Markdown' });
            try {
                await secBot.telegram.sendMessage(tk.guestChatId,
                    `⏳ Sayın misafirimiz, talebinizle ilgileniyoruz ancak şu an yoğunluk nedeniyle kısa bir gecikme yaşanabilir. Anlayışınız için teşekkür ederiz. 🙏`);
            } catch (e) {}
        } else {
            await ctx.answerCbQuery('Talep bulunamadı.', { show_alert: true });
        }
    });
    secBot.action(/note_(.+)/, async (ctx) => {
        const ticketId = ctx.match[1];
        const chatId = ctx.chat.id;
        const tk = pendingTickets[ticketId];
        receptionNoteStates[chatId] = {
            ticketId,
            department: tk ? tk.department : '?',
            guestName: tk ? tk.guestName : '?',
            guestRoom: tk ? tk.guestRoom : '?'
        };
        await ctx.answerCbQuery();
        await ctx.reply(`📝 *İnceleme Notu Ekle*\n\nNotunuzu aşağıya yazabilirsiniz:`, { parse_mode: 'Markdown' });
    });

    // Misafir handler'ları
    secBot.start(handleStart);
    secBot.command('harita', handleHarita);
    secBot.on('text', handleText);
    secBot.on('voice', handleVoice);
    console.log(`✅ [MULTI-BOT] ${secBot._managerName} bot handler'ları kaydedildi.`);
}

// (Express API webhook kaldırıldı, bu dosya sadece Telegram Guest Worker olarak hizmet verir)
// ── Botları Başlat ────────────────────────────────────────────────────
console.log('⏳ Telegram bağlantıları kuruluyor...');

// Bot başlatma fonksiyonu (tekrar kullanılabilir)
async function launchBot(botInstance, label) {
    try {
        await botInstance.telegram.deleteWebhook({ drop_pending_updates: true });
        console.log(`🔄 [${label}] Webhook temizlendi, polling başlatılıyor...`);
        
        botInstance.launch().then(() => {
            console.log(`🚀 [${label}] Telegram Long-Polling bağlantısı aktif!`);
        }).catch(err => {
            console.error(`❌ [${label}] Launch hatası:`, err.message);
        });

        // 5sn sonra doğrulama
        setTimeout(async () => {
            try {
                const me = await botInstance.telegram.getMe();
                console.log(`✅ [${label}] Bot aktif ve çalışıyor: @${me.username} (ID: ${me.id})`);
            } catch (e) {
                console.error(`❌ [${label}] Bot doğrulama başarısız:`, e.message);
            }
        }, 5000);
    } catch (err) {
        console.error(`❌ [${label}] Başlatma hatası:`, err.message);
    }
}

// Ana bot + ikincil botları başlat
(async () => {
    // 1. Ana botu başlat
    await launchBot(bot, 'ANA BOT');
    
    // 2. İkincil botları başlat (1sn aralıkla, rate limit önlemi)
    for (let i = 0; i < secondaryBots.length; i++) {
        const secBot = secondaryBots[i];
        await new Promise(resolve => setTimeout(resolve, 1000));
        await launchBot(secBot, secBot._managerName || `İKİNCİL BOT ${i + 1}`);
    }
})();

// Bilgilendirme (asenkron beklemeden)
console.log(`🏨 Otel: The Green Park Gaziantep`);
console.log(`🔗 Dashboard API: ${DASHBOARD_API}`);
console.log(`🤖 AI Model: GPT-4o`);
console.log(`⏱️  SLA Sistemi: Aktif (60 saniye)`);
console.log(`👤 Misafir Bilgisi Toplama: Aktif`);
console.log(`📦 Modüler Bilgi Bankası: Aktif (knowledge/)`);
console.log(`🤖 Ana Bot: @${telegramConfig.botUsername || 'n8n_Hotel_Yonetici_Bot'}`);
console.log(`🤖 Toplam Bot: ${1 + secondaryBots.length} adet (Ana + ${secondaryBots.length} İkincil)`);


// Tüm botları durdur
process.once('SIGINT', () => {
    bot.stop('SIGINT');
    secondaryBots.forEach(sb => sb.stop('SIGINT'));
});
process.once('SIGTERM', () => {
    bot.stop('SIGTERM');
    secondaryBots.forEach(sb => sb.stop('SIGTERM'));
});
