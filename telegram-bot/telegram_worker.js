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
const { createHealthMonitor } = require('./skills/health_monitor');

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

// Resepsiyon teyit bekleme deposu: chatId -> { name, room, allergies, pendingAI, timer, lang }
const pendingVerifications = {};

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

// ── Dil Tespiti (6 Dil) ────────────────────────────────────────────────
// Mesajın diline göre 'TR' | 'EN' | 'DE' | 'RU' | 'AR' | 'FR' döner
function detectLanguage(text) {
    if (!text) return 'TR';
    const t = text.toLowerCase();
    // Arapça unicode bloğu
    if (/[\u0600-\u06FF]/.test(text)) return 'AR';
    // Kiril (Rusça)
    if (/[\u0400-\u04FF]/.test(text)) return 'RU';
    // Türkçe'ye özgü karakterler
    if (/[çğışöüÇĞİŞÖÜ]/.test(text)) return 'TR';
    // Almanca'ya özgü karakterler
    if (/[äöüÄÖÜß]/.test(text)) return 'DE';
    // Fransızca'ya özgü karakterler
    if (/[àâäéèêëîïôùûüœæç]/i.test(text)) return 'FR';
    // İngilizce anahtar kelimeler (Latin alfabe + İngilizce kalıplar)
    const enWords = ['i need', 'i want', 'please', 'could you', 'can you', 'my room', 'room number', 'i am', "i'm", 'hello', 'hi ', 'good morning', 'good evening', 'thank'];
    if (enWords.some(w => t.includes(w))) return 'EN';
    // Almanca kelimeler
    const deWords = ['ich ', 'bitte', 'danke', 'zimmer', 'brauche', 'guten', 'hallo', 'können sie'];
    if (deWords.some(w => t.includes(w))) return 'DE';
    // Fransızca kelimeler
    const frWords = ['je ', 'vous ', 'merci', 'bonjour', "s'il vous plaît", 'chambre', 'pouvez'];
    if (frWords.some(w => t.includes(w))) return 'FR';
    // Varsayılan: Latin alfabe ağırlıklıysa İngilizce, değilse Türkçe
    const latinRatio = (text.match(/[a-zA-Z]/g) || []).length / Math.max(text.length, 1);
    return latinRatio > 0.5 ? 'EN' : 'TR';
}

// ── Çok Dilli Mesajlar ──────────────────────────────────────────────────
const MULTILANG_MESSAGES = {
    askBoth: {
        TR: `Talebinizi hızlıca iletebilmem için birkaç bilgiye ihtiyacım var 🙏\n\n1️⃣ *Oda Numaranız*\n2️⃣ *Adınız Soyadınız*\n\n_(Örnek: Mehmet Kaya, Oda 412)_`,
        EN: `To forward your request quickly, I need a few details 🙏\n\n1️⃣ *Your Room Number*\n2️⃣ *Your Full Name*\n\n_(Example: John Smith, Room 412)_`,
        DE: `Um Ihre Anfrage schnell weiterzuleiten, benötige ich einige Angaben 🙏\n\n1️⃣ *Ihre Zimmernummer*\n2️⃣ *Ihr vollständiger Name*\n\n_(Beispiel: Hans Müller, Zimmer 412)_`,
        RU: `Чтобы быстро передать вашу просьбу, мне нужны несколько данных 🙏\n\n1️⃣ *Номер вашего номера*\n2️⃣ *Ваше полное имя*\n\n_(Пример: Иван Иванов, номер 412)_`,
        AR: `لتوجيه طلبك بسرعة، أحتاج إلى بعض المعلومات 🙏\n\n1️⃣ *رقم غرفتك*\n2️⃣ *اسمك الكامل*\n\n_(مثال: أحمد محمد، غرفة 412)_`,
        FR: `Pour traiter votre demande rapidement, j'ai besoin de quelques informations 🙏\n\n1️⃣ *Votre numéro de chambre*\n2️⃣ *Votre nom complet*\n\n_(Exemple : Jean Dupont, chambre 412)_`,
    },
    askName: {
        TR: `Teşekkürler, oda numaranızı aldım! 🙏\n\nŞimdi *adınızı ve soyadınızı* da yazabilir misiniz?\n\n_(Örnek: Mehmet Kaya)_`,
        EN: `Thank you, I have your room number! 🙏\n\nCould you also provide your *full name*?\n\n_(Example: John Smith)_`,
        DE: `Danke, ich habe Ihre Zimmernummer! 🙏\n\nKönnten Sie auch Ihren *vollständigen Namen* angeben?\n\n_(Beispiel: Hans Müller)_`,
        RU: `Спасибо, я записал номер вашего номера! 🙏\n\nМогли бы вы также указать ваше *полное имя*?\n\n_(Пример: Иван Иванов)_`,
        AR: `شكراً، لقد حصلت على رقم غرفتك! 🙏\n\nهل يمكنك أيضاً إخباري *باسمك الكامل*؟\n\n_(مثال: أحمد محمد)_`,
        FR: `Merci, j'ai votre numéro de chambre ! 🙏\n\nPourriez-vous également indiquer votre *nom complet* ?\n\n_(Exemple : Jean Dupont)_`,
    },
    askRoom: {
        TR: `Teşekkürler! 🙏\n\nTablebinizi iletebilmem için *oda numaranızı* da yazabilir misiniz?\n\n_(Örnek: 412)_`,
        EN: `Thank you! 🙏\n\nCould you also provide your *room number*?\n\n_(Example: 412)_`,
        DE: `Danke! 🙏\n\nKönnten Sie auch Ihre *Zimmernummer* angeben?\n\n_(Beispiel: 412)_`,
        RU: `Спасибо! 🙏\n\nМогли бы вы также указать *номер вашего номера*?\n\n_(Пример: 412)_`,
        AR: `شكراً! 🙏\n\nهل يمكنك أيضاً إخباري *برقم غرفتك*؟\n\n_(مثال: 412)_`,
        FR: `Merci ! 🙏\n\nPourriez-vous également indiquer votre *numéro de chambre* ?\n\n_(Exemple : 412)_`,
    },
    retryFormat: {
        TR: `Üzgünüm, bilgileri anlayamadım 😊 Lütfen şu formatta yazabilir misiniz?\n\n*Ad Soyad, Oda [numara]*\n_(Örnek: Mehmet Kaya, Oda 412)_`,
        EN: `I'm sorry, I couldn't understand the details 😊 Could you write in this format?\n\n*Full Name, Room [number]*\n_(Example: John Smith, Room 412)_`,
        DE: `Entschuldigung, ich konnte die Angaben nicht verstehen 😊 Könnten Sie in diesem Format schreiben?\n\n*Vorname Nachname, Zimmer [Nummer]*\n_(Beispiel: Hans Müller, Zimmer 412)_`,
        RU: `Извините, я не смог понять данные 😊 Не могли бы вы написать в таком формате?\n\n*Имя Фамилия, Номер [цифра]*\n_(Пример: Иван Иванов, Номер 412)_`,
        AR: `آسف، لم أتمكن من فهم التفاصيل 😊 هل يمكنك الكتابة بهذا الشكل؟\n\n*الاسم الكامل، غرفة [رقم]*\n_(مثال: أحمد محمد، غرفة 412)_`,
        FR: `Désolé, je n'ai pas compris les informations 😊 Pourriez-vous écrire dans ce format ?\n\n*Nom Prénom, chambre [numéro]*\n_(Exemple : Jean Dupont, chambre 412)_`,
    },
    callReception: {
        TR: `Maalesef bilgilerinizi doğrulayamıyoruz. 😔\nLütfen resepsiyonumuzu arayarak destek alabilirsiniz:\n📞 *+90 (850) 222 72 75*\n\n_Resepsiyonumuz 7/24 hizmetinizdedir._`,
        EN: `Unfortunately, we were unable to verify your information. 😔\nPlease call our reception for assistance:\n📞 *+90 (850) 222 72 75*\n\n_Our reception is available 24/7._`,
        DE: `Leider konnten wir Ihre Informationen nicht verifizieren. 😔\nBitte rufen Sie unsere Rezeption an:\n📞 *+90 (850) 222 72 75*\n\n_Unsere Rezeption ist rund um die Uhr erreichbar._`,
        RU: `К сожалению, мы не смогли подтвердить ваши данные. 😔\nПожалуйста, позвоните на нашу стойку регистрации:\n📞 *+90 (850) 222 72 75*\n\n_Наша стойка работает круглосуточно._`,
        AR: `للأسف، لم نتمكن من التحقق من معلوماتك. 😔\nيرجى الاتصال بالاستقبال للمساعدة:\n📞 *+90 (850) 222 72 75*\n\n_الاستقبال متاح 24/7._`,
        FR: `Malheureusement, nous n'avons pas pu vérifier vos informations. 😔\nVeuillez appeler notre réception pour obtenir de l'aide :\n📞 *+90 (850) 222 72 75*\n\n_Notre réception est disponible 24h/24._`,
    },
    // Eşleşme yok — resepsiyonsuz senaryo (personel/grup bulunamadı)
    mismatchNoReception: {
        TR: `⚠️ Bilgilerinizi sistemimizle doğrulayamadık.\n\nEğer arkadaşlarınız veya aile üyelerinizle oda değişikliği yaptıysanız kayıtlarda karışıklık olmuş olabilir. Lütfen resepsiyonumuzu arayarak hemen düzeltilmesini sağlayın:\n📞 *+90 (850) 222 72 75*`,
        EN: `⚠️ We could not verify your information in our system.\n\nIf you have swapped rooms with friends, family members, or colleagues, there may be a mix-up in our records. Please call our reception immediately to get it sorted:\n📞 *+90 (850) 222 72 75*`,
        DE: `⚠️ Wir konnten Ihre Angaben in unserem System nicht verifizieren.\n\nFalls Sie mit Freunden oder Familienmitgliedern Zimmer getauscht haben, könnte es zu einer Verwechslung in unseren Unterlagen gekommen sein. Bitte rufen Sie sofort unsere Rezeption an:\n📞 *+90 (850) 222 72 75*`,
        RU: `⚠️ Мы не смогли подтвердить ваши данные в нашей системе.\n\nЕсли вы поменялись номерами с друзьями или членами семьи, в наших записях могла возникнуть путаница. Пожалуйста, немедленно позвоните на стойку регистрации:\n📞 *+90 (850) 222 72 75*`,
        AR: `⚠️ لم نتمكن من التحقق من معلوماتك في نظامنا.\n\nإذا كنت قد تبادلت الغرفة مع أصدقاء أو أفراد العائلة، فقد يكون هناك خلط في سجلاتنا. يرجى الاتصال باستقبالنا فوراً:\n📞 *+90 (850) 222 72 75*`,
        FR: `⚠️ Nous n'avons pas pu vérifier vos informations dans notre système.\n\nSi vous avez échangé votre chambre avec des amis ou des membres de votre famille, il peut y avoir une confusion dans nos dossiers. Veuillez appeler immédiatement notre réception :\n📞 *+90 (850) 222 72 75*`,
    },
    // Teyit bekleniyor — resepsiyona mesaj gönderildi
    awaitingVerify: {
        TR: `⏳ Bilgileriniz resepsiyona iletildi. Birkaç dakika içinde teyit alarak talebinizi işleme alacağız.\n\nLütfen bekleyin... 🙏`,
        EN: `⏳ Your information has been forwarded to our reception. We will verify and process your request within a few minutes.\n\nPlease wait... 🙏`,
        DE: `⏳ Ihre Angaben wurden an unsere Rezeption weitergeleitet. Wir werden Ihre Anfrage innerhalb weniger Minuten prüfen und bearbeiten.\n\nBitte warten Sie... 🙏`,
        RU: `⏳ Ваши данные переданы на стойку регистрации. Мы проверим и обработаем ваш запрос в течение нескольких минут.\n\nПожалуйста, подождите... 🙏`,
        AR: `⏳ تم إرسال معلوماتك إلى الاستقبال. سنتحقق ونعالج طلبك في غضون دقائق قليلة.\n\nالرجاء الانتظار... 🙏`,
        FR: `⏳ Vos informations ont été transmises à notre réception. Nous allons vérifier et traiter votre demande dans quelques minutes.\n\nVeuillez patienter... 🙏`,
    },
    // Resepsiyon reddi
    verifyRejected: {
        TR: `⚠️ Bilgileriniz sistemimizde kayıtlı olanlarla eşleşmedi.\n\nEğer arkadaşlarınız veya aile üyelerinizle oda değişikliği yaptıysanız kayıtlarda karışıklık olmuş olabilir. Lütfen resepsiyonumuzu arayarak hemen düzeltilmesini sağlayın:\n📞 *+90 (850) 222 72 75*`,
        EN: `⚠️ Your details did not match our records.\n\nIf you have swapped rooms with friends, family members, or colleagues, there may be a mix-up in our records. Please call our reception immediately:\n📞 *+90 (850) 222 72 75*`,
        DE: `⚠️ Ihre Angaben stimmen nicht mit unseren Unterlagen überein.\n\nFalls Sie mit Freunden oder Familienmitgliedern Zimmer getauscht haben, könnte eine Verwechslung vorliegen. Bitte rufen Sie sofort unsere Rezeption an:\n📞 *+90 (850) 222 72 75*`,
        RU: `⚠️ Ваши данные не совпадают с нашими записями.\n\nЕсли вы поменялись номерами с друзьями или членами семьи, в наших записях могла возникнуть путаница. Пожалуйста, немедленно позвоните на регистрацию:\n📞 *+90 (850) 222 72 75*`,
        AR: `⚠️ لم تتطابق بياناتك مع سجلاتنا.\n\nإذا كنت قد تبادلت الغرفة مع أصدقاء أو أفراد عائلتك، فقد يكون هناك خلط. يرجى الاتصال باستقبالنا فوراً:\n📞 *+90 (850) 222 72 75*`,
        FR: `⚠️ Vos informations ne correspondent pas à nos dossiers.\n\nSi vous avez échangé votre chambre avec des amis ou des membres de votre famille, il pourrait y avoir une confusion. Veuillez appeler notre réception immédiatement :\n📞 *+90 (850) 222 72 75*`,
    },
    // Teyit zaman aşımı
    verifyTimeout: {
        TR: `⚠️ Resepsiyondan zamanında yanıt alınamadı.\n\nEğer arkadaşlarınız veya aile üyelerinizle oda değişikliği yaptıysanız kayıtlarda karışıklık olmuş olabilir. Lütfen resepsiyonumuzu arayarak hemen düzeltilmesini sağlayın:\n📞 *+90 (850) 222 72 75*`,
        EN: `⚠️ We did not receive a timely response from reception.\n\nIf you have swapped rooms with friends or family members, there may be a mix-up in our records. Please call our reception immediately to get it sorted:\n📞 *+90 (850) 222 72 75*`,
        DE: `⚠️ Wir haben keine rechtzeitige Antwort von der Rezeption erhalten.\n\nFalls Sie Zimmer getauscht haben, könnte eine Verwechslung vorliegen. Bitte rufen Sie sofort unsere Rezeption an:\n📞 *+90 (850) 222 72 75*`,
        RU: `⚠️ Мы не получили своевременного ответа от стойки регистрации.\n\nЕсли вы поменялись номерами, в записях могла возникнуть путаница. Пожалуйста, срочно позвоните на стойку:\n📞 *+90 (850) 222 72 75*`,
        AR: `⚠️ لم نتلقَ رداً في الوقت المناسب من الاستقبال.\n\nإذا كنت قد تبادلت الغرفة، فقد يكون هناك خلط. يرجى الاتصال باستقبالنا فوراً:\n📞 *+90 (850) 222 72 75*`,
        FR: `⚠️ Nous n'avons pas reçu de réponse de la réception dans les délais impartis.\n\nSi vous avez échangé votre chambre, il peut y avoir une confusion. Veuillez appeler immédiatement notre réception :\n📞 *+90 (850) 222 72 75*`,
    },
    blockedCallReception: {
        TR: `Talebiniz için lütfen resepsiyonumuzu arayın:\n📞 *+90 (850) 222 72 75*`,
        EN: `For your request, please call our reception:\n📞 *+90 (850) 222 72 75*`,
        DE: `Für Ihre Anfrage rufen Sie bitte unsere Rezeption an:\n📞 *+90 (850) 222 72 75*`,
        RU: `По вашему запросу позвоните на нашу стойку регистрации:\n📞 *+90 (850) 222 72 75*`,
        AR: `لطلبك، يرجى الاتصال باستقبالنا:\n📞 *+90 (850) 222 72 75*`,
        FR: `Pour votre demande, veuillez appeler notre réception :\n📞 *+90 (850) 222 72 75*`,
    },
};

// Dil koduna göre çok dilli mesaj getir (fallback: TR)
function getLangMsg(key, lang) {
    const msgs = MULTILANG_MESSAGES[key];
    if (!msgs) return '';
    return msgs[lang] || msgs['TR'];
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
    console.log(`🔑 [API KEY] OpenAI key yüklendi: ${OPENAI_KEY.substring(0, 12)}...${OPENAI_KEY.slice(-6)} (uzunluk: ${OPENAI_KEY.length})`);
} else {
    console.error('❌ [FATAL] OPENAI_API_KEY .env dosyasında bulunamadı! AI yanıtları çalışmayacak.');
}

// ── BAŞLANGIÇ SAĞLIK KONTROLÜ — OpenAI API Key Doğrulaması ───────────
(async () => {
    if (!openai) return;
    try {
        const testResp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5
        });
        console.log('✅ [HEALTH] OpenAI API key geçerli ve çalışıyor.');
    } catch (e) {
        console.error(`❌ [HEALTH] OpenAI API key ÇALIŞMIYOR! Hata: ${e.message}`);
        console.error(`   ↳ Kullanılan key: ${OPENAI_KEY?.substring(0, 15)}...`);
        console.error('   ↳ Lütfen .env dosyasındaki OPENAI_API_KEY değerini kontrol edin.');
    }
})();

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
const alertGuestRelationsAboutAllergy = createAllergyProtocol(bot, supabase, telegramConfig, secondaryBots);
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

    // Lokasyon + Acenta + IBAN: paralel blokta (aşağıda) çekiliyor.

    // ── PARALEL DB SORGULARI (Hız optimizasyonu) ────────────────────────
    // Location + Agency + IBAN sorguları aynı anda başlatılır — 3 ayrı await yerine 1 Promise.all
    let agencyData = null;
    let ibanData = null;

    if (supabase) {
        const locKeywords = [
            // Türkçe
            'konum', 'lokasyon', 'nerede', 'adres', 'nasıl gelirim', 'navigasyon', 'harita', 'yol tarifi', 'ulaşım', 'neredesiniz', 'nasıl gelir', 'yol',
            // İngilizce
            'location', 'where', 'directions', 'map', 'address', 'how to get', 'how do i get',
            // Almanca
            'wo', 'wie komme', 'adresse', 'standort', 'wegbeschreibung', 'anfahrt',
            // Rusça
            'местоположение', 'адрес', 'как добраться', 'где находится', 'где',
            // Fransızca
            'où', 'comment venir', 'emplacement', 'itinéraire',
            // Arapça
            'الموقع', 'العنوان', 'كيف أصل', 'أين',
            // İspanyolca
            'ubicación', 'dirección', 'cómo llegar', 'dónde'
        ];
        const agencyKeywords = [
            'rezervasyon', 'acenta', 'acente', 'rezervasyon link', 'booking', 'fiyat', 'yer ayırt', 'oda ayırt', 'oda ayirt',
            'reservation', 'reserve', 'room', 'price',
            'Reservierung', 'Zimmer', 'Preis',
            'бронирование', 'номер', 'цена',
            'réservation', 'chambre', 'prix',
            'حجز', 'غرفة', 'سعر',
            'reserva', 'habitación', 'precio'
        ];
        const ibanKeywords  = ['iban', 'havale', 'eft', 'banka hesab', 'hesap numar', 'para gönder', 'transfer', 'bank account', 'wire transfer'];
        const lower         = userText.toLowerCase();

        const locMatched    = locKeywords.find(k => lower.includes(k));
        const needsAgency   = agencyKeywords.some(k => lower.includes(k));
        const needsIban     = ibanKeywords.some(k => lower.includes(k));

        // ─ İntent filtresi: teşekkür/onay için lokasyon tetikleme ─
        const thankYouPatterns = [
            // Türkçe
            'teşekkür', 'tesekkur', 'sağ ol', 'sag ol', 'tamam', 'anladım', 'harika',
            'güzel', 'süper', 'mükemmel', 'aldım', 'gördüm',
            // İngilizce
            'ok', 'thank', 'thanks', 'thank you', 'got it', 'great', 'perfect', 'noted',
            // Almanca
            'danke', 'danke schön', 'vielen dank', 'alles klar', 'verstanden',
            // Rusça
            'спасибо', 'благодарю', 'понял', 'понятно', 'хорошо',
            // Fransızca
            'merci', 'merci beaucoup', 'compris', 'parfait', "d'accord",
            // Arapça
            'شكرا', 'شكراً', 'تمام', 'حسناً',
            // İspanyolca
            'gracias', 'entendido', 'perfecto',
            // Emoji
            '👍', '🙏', '❤️', '😊'
        ];
        const requestWords = [
            'nerede', 'nasıl', 'hangi', 'ver', 'gönder', 'istiyorum', 'lazım', '?',
            'where', 'how', 'send', 'give', 'show', 'can you', 'could you', 'please',
            'wo', 'wie', 'können', 'bitte',
            'где', 'как', 'пожалуйста', 'покажите',
            'où', 'comment', 'pouvez', 'envoyez',
            'أين', 'كيف', 'من فضلك',
            'dónde', 'cómo', 'por favor'
        ];
        const isThankYouOnly = thankYouPatterns.some(p => lower.includes(p))
            && !requestWords.some(q => lower.includes(q));

        if (locMatched && !isThankYouOnly) {
            console.log(`[LOCATION_TRIGGER] Keyword: "${locMatched}"`);
        } else if (locMatched && isThankYouOnly) {
            console.log(`[LOCATION_SKIP] "${locMatched}" geçti ama bağlam teşekkür — atlanıyor.`);
        }

        // Paralel sorgular
        const safeQuery = async (key) => {
            try {
                const { data, error } = await supabase.from('hotel_settings').select('value').eq('key', key).single();
                return error ? null : data;
            } catch (e) { return null; }
        };

        const [locResult, agencyResult, ibanResult] = await Promise.all([
            (locMatched && !isThankYouOnly) ? safeQuery('hotel_location')      : null,
            needsAgency                     ? safeQuery('hotel_agencies')       : null,
            needsIban                       ? safeQuery('reception_settings')   : null,
        ]);

        // Lokasyon işle
        if (locResult?.value) {
            locationData = locResult.value;
            targetDepartment = 'RESEPSIYON';
            console.log(`✅ [LOCATION_LOADED] url: ${locationData.url}`);
        }

        // Acenta işle
        if (agencyResult?.value) {
            agencyData = agencyResult.value;
        }

        // IBAN işle
        if (ibanResult?.value?.ibanText) {
            ibanData = ibanResult.value.ibanText;
        }
    }

    const basePrompt = getPromptForDepartment(targetDepartment, locationData, agencyData);

    // Modüler bilgi bankası: Sadece ilgili bilgiyi yükle (token tasarrufu)
    const hotelKnowledge = getRelevantKnowledge(userText);


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
            const checkoutFormatted = new Date(session.checkout_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
            const checkinFormatted = session.checkin_date ? new Date(session.checkin_date).toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }) : null;
            checkoutRule = `\n[ÖZEL DURUM — REZERVASYON TARİH BİLGİSİ]\nMisafir kendi çıkış veya giriş tarihini sordu. Bu tartışmasız BİLGİ isteğidir. KESİNLİKLE "isRequest": false döndür!\nÇıkış: ${checkoutFormatted}${checkinFormatted ? `\nGiriş: ${checkinFormatted}` : ''}\n1. Misafire ismiyle (${session.real_first_name}) hitap et.\n2. Çıkış tarihini bildir.\n3. Tarih uzatma/değiştirme talebi → "Resepsiyonumuzla irtibata geçiniz" de.`;
            console.log(`[CHECKOUT_RULE] ${session.real_first_name} için tarih enjekte edildi.`);
        }
    }

    // DİL KURALI + SYSTEM PROMPT
    const LANG_RULE = `\n[DİL KURALI — ZORUNLU / MANDATORY LANGUAGE RULE]\nMisafir hangi dilde yazmışsa KESİNLİKLE o dilde yanıtla (Türkçe, İngilizce, Almanca, Fransızca, Arapça, Rusça vb.). Dili asla değiştirme veya karıştırma. Otel bilgileri Türkçe olsa bile misafirin diline çevirerek sun.\n⚠️ LANGUAGE: You MUST respond in the SAME language as the guest. If the guest writes in English, respond ONLY in English. If German, respond in German. NEVER default to Turkish for non-Turkish messages. Translate all hotel information to the guest's language.`;
    const SYSTEM_PROMPT = `${basePrompt}\n\nOtel Bilgileri:\n${hotelKnowledge}\n\nTarih/Saat: ${nowStr}${requestHandlingRules}${identityContext}${ibanRule}${checkoutRule}${LANG_RULE}\n\n⛔ ASLA UYDURMA İSİM veya ODA KULLANMA. JSON FORMATINDA SADECE İSTENENİ VER.`;

    try {
        const t0 = Date.now();
        // 15 saniye timeout — OpenAI yavaşlarsa bot kilitlenmesin
        const abortController = new AbortController();
        const aiTimeout = setTimeout(() => abortController.abort(), 15000);
        let response;
        try {
            response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
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
        console.log(`⏱️ [AI] gpt-4o-mini yanıt süre: ${Date.now() - t0}ms`);
        
        // Güvenli JSON parse (kesilmiş JSON'a karşı koruma)
        let parsed;
        try {
            parsed = JSON.parse(response.choices[0].message.content);
        } catch (parseErr) {
            console.error('[AI JSON PARSE HATASI] Ham yanıt:', response.choices[0].message.content?.substring(0, 200));
            // Dil tespiti yap ve o dilde hata ver
            const lowerText = userText.toLowerCase();
            const isEnglish = /[a-z]/.test(userText) && !/[çğışöü]/.test(userText);
            return { 
                replyToUser: isEnglish
                    ? "I'm sorry, I couldn't process your request. Please try again or contact our reception at +90 (850) 222 72 75."
                    : "Üzgünüm, mesajınızı işleyemedim. Lütfen tekrar deneyin veya resepsiyonumuzu arayın: +90 (850) 222 72 75.",
                isRequest: false 
            };
        }
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
        console.error("OpenAI Hatası:", error.message, error.status || '');
        // Dil tespit: Latin harfleri varsa ve Türkçe karakter yoksa İngilizce say
        const hasLatinOnly = /[a-z]/i.test(userText) && !/[çğışöüÇĞİŞÖÜ]/.test(userText);
        const errMsg = hasLatinOnly
            ? "I'm sorry, something went wrong. Please try again or contact our reception at +90 (850) 222 72 75."
            : "Üzgünüm, bir hata oluştu. Lütfen tekrar deneyin veya resepsiyonumuzla iletişime geçin: +90 (850) 222 72 75.";
        return { replyToUser: errMsg, isRequest: false };
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

// ── Misafir bilgisi sor (ÇOK DİLLİ) ─────────────────────────────────
// missingField: 'both' | 'name' | 'room' — ne eksik olduğunu belirtir
// lang: 'TR' | 'EN' | 'DE' | 'RU' | 'AR' | 'FR'
async function askForGuestInfo(ctx, attempt = 1, missingField = 'both', lang = 'TR') {
    let msg;
    if (attempt === 1) {
        if (missingField === 'name') {
            msg = getLangMsg('askName', lang);
        } else if (missingField === 'room') {
            msg = getLangMsg('askRoom', lang);
        } else {
            msg = getLangMsg('askBoth', lang);
        }
    } else if (attempt === 2) {
        msg = getLangMsg('retryFormat', lang);
    } else {
        msg = getLangMsg('callReception', lang);
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

// ── Mesaj İşleme Kilidi (Duplikasyon Önleme) ──────────────────────────
// Aynı chatId için eşzamanlı mesaj işlemeyi engeller
const processingLocks = {};
const processingLockTimers = {}; // Auto-release timer'ları

// ── Ortak mesaj işleyici (text ve voice için) ─────────────────────────
async function handleIncomingMessage(ctx, userText) {
    const chatId = ctx.chat.id;

    // ── DUPLİKASYON KİLİDİ (30sn AUTO-RELEASE) ─────────────────────
    // Aynı chatId için zaten işlenen bir mesaj varsa, bu mesajı atla
    if (processingLocks[chatId]) {
        console.warn(`🔒 [LOCK] chatId: ${chatId} için zaten bir mesaj işleniyor, bu mesaj atlanıyor: "${userText.substring(0, 50)}"`);
        return;
    }
    processingLocks[chatId] = true;
    // ⏱️ 30 saniye sonra kilit otomatik açılır (eski: süresiz kilitleme riski vardı)
    processingLockTimers[chatId] = setTimeout(() => {
        if (processingLocks[chatId]) {
            console.warn(`⚠️ [LOCK_AUTO_RELEASE] chatId: ${chatId} kilidi 30sn sonra otomatik serbest bırakıldı!`);
            delete processingLocks[chatId];
        }
    }, 30000);

    try {

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


    // Dil tespiti: her mesajda kullanicinin dilini guncelle
    const detectedLang = detectLanguage(userText);
    if (!session.lang || session.lang === 'TR') {
        session.lang = detectedLang;
    }
    const guestLang = session.lang || 'TR';
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
                // K\u0131smi bilgileri temizle
                delete session.partialName;
                delete session.partialRoom;

                const lang = session.lang || 'TR';

                // \u2500\u2500 E\u015eLEME YOK \u2192 RESEPS\u0130YONA TEYI\u0130T \u0130STE\u011e\u0130 G\u00d6NDER \u2500\u2500\u2500\u2500\u2500\u2500
                console.warn(`\u26a0\ufe0f [DO\u011eRULAMA UYDE\u015eMEZ] ${resolvedName} / Oda ${resolvedRoom} \u2192 Resepsiyona teyit g\u00f6nderiliyor.`);

                // Resepsiyon personeli veya grubunu bul
                let receptionTargets = [];
                if (supabase) {
                    const { data: recPersonnel } = await supabase.from('hotel_personnel')
                        .select('*').eq('department', 'RESEPSIYON').eq('is_active', true);
                    if (recPersonnel && recPersonnel.length > 0) {
                        receptionTargets = recPersonnel.filter(p => p.platform.toUpperCase() === 'TELEGRAM');
                    }
                }
                // Config'den RESEPSIYON grup ID'sini de ekle
                try {
                    const currentBotToken = ctx.telegram && ctx.telegram.token ? ctx.telegram.token : botToken;
                    const _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'skills', 'telegram_config.json'), 'utf8'));
                    if (_cfg.managers) {
                        for (const [, mgr] of Object.entries(_cfg.managers)) {
                            if (mgr.botToken === currentBotToken && mgr.departments && mgr.departments.RESEPSIYON) {
                                const resChatId = mgr.departments.RESEPSIYON.chatId;
                                if (resChatId && !receptionTargets.some(p => String(p.contact_id) === String(resChatId))) {
                                    receptionTargets.push({ full_name: 'Resepsiyon Grubu', platform: 'TELEGRAM', contact_id: resChatId });
                                }
                                break;
                            }
                        }
                    }
                } catch (e) { /* config okuma hatas\u0131 */ }

                if (receptionTargets.length === 0) {
                    // B Se\u00e7ene\u011fi: Resepsiyon yoksa misafiri y\u00f6nlendir (oda de\u011fi\u015fikli\u011fi a\u00e7\u0131klamas\u0131yla)
                    console.warn(`\u26a0\ufe0f [TEYI\u0130T] Resepsiyon personeli/grubu bulunamad\u0131. Misafir y\u00f6nlendiriliyor.`);
                    const noRecMsg = getLangMsg('mismatchNoReception', lang);
                    await ctx.replyWithMarkdown(noRecMsg);
                    await saveMessageToDashboard(chatId, 'assistant', noRecMsg);
                    session.state = 'blocked';
                    return;
                }

                // Resepsiyona teyit mesaj\u0131 g\u00f6nder (Onayla / Reddet butonlar\u0131)
                const verifyMsg = `\ud83d\udd14 *M\u0130SAF\u0130R TEYI\u0130T TALEB\u0130*\n\nA\u015fa\u011f\u0131daki bilgilerle giri\u015f yapmaya \u00e7al\u0131\u015fan bir misafir var, ancak kay\u0131tlarda e\u015fle\u015fme bulunamad\u0131.\n\n\ud83d\udc64 *\u0130ddia Edilen Ad:* ${resolvedName}\n\ud83d\udeaa *\u0130ddia Edilen Oda:* ${resolvedRoom}\n\ud83d\udcac *Telegram ID:* ${chatId}\n\n_Bu ki\u015fi ger\u00e7ekten bu odada m\u0131 kal\u0131yor? Kontrol edip onaylay\u0131n veya reddedin._`;

                const verifyKeyboard = Markup.inlineKeyboard([
                    Markup.button.callback('\u2705 Evet, Onayl\u0131yorum', `verify_yes_${chatId}`),
                    Markup.button.callback('\u274c Hay\u0131r, Reddediyorum', `verify_no_${chatId}`)
                ]);

                const senderTelegram = ctx.telegram || bot.telegram;
                let msgSent = false;
                for (const target of receptionTargets) {
                    try {
                        await senderTelegram.sendMessage(target.contact_id, verifyMsg, {
                            parse_mode: 'Markdown',
                            ...verifyKeyboard
                        });
                        msgSent = true;
                        console.log(`\ud83d\udce8 [TEYI\u0130T] Resepsiyona g\u00f6nderildi \u2192 ${target.full_name} (${target.contact_id})`);
                    } catch (e) {
                        console.error(`\u274c [TEYI\u0130T] ${target.full_name} i\u00e7in g\u00f6nderilemedi:`, e.message);
                    }
                }

                if (!msgSent) {
                    // Mesaj g\u00f6nderilemedi \u2192 B se\u00e7ene\u011fi
                    const noRecMsg = getLangMsg('mismatchNoReception', lang);
                    await ctx.replyWithMarkdown(noRecMsg);
                    await saveMessageToDashboard(chatId, 'assistant', noRecMsg);
                    session.state = 'blocked';
                    return;
                }

                // Misafiri teyit bekleme moduna al
                session.state = 'awaiting_reception_verify';
                const waitMsg = getLangMsg('awaitingVerify', lang);
                await ctx.replyWithMarkdown(waitMsg);
                await saveMessageToDashboard(chatId, 'assistant', waitMsg);

                // 3 dakika timeout \u2014 resepsiyon yan\u0131t vermezse y\u00f6nlendir
                const verifyTimer = setTimeout(async () => {
                    if (guestSessions[chatId] && guestSessions[chatId].state === 'awaiting_reception_verify') {
                        console.warn(`\u23f0 [TEYI\u0130T TIMEOUT] chatId: ${chatId} \u2014 3 dk ge\u00e7ti, resepsiyon yan\u0131t vermedi.`);
                        guestSessions[chatId].state = 'blocked';
                        const timeoutMsg = getLangMsg('verifyTimeout', lang);
                        try {
                            await senderTelegram.sendMessage(chatId, timeoutMsg, { parse_mode: 'Markdown' });
                        } catch (e) {}
                        delete pendingVerifications[chatId];
                    }
                }, 3 * 60 * 1000); // 3 dakika

                // Bekleyen teyit bilgilerini kaydet
                pendingVerifications[chatId] = {
                    resolvedName,
                    resolvedRoom,
                    resolvedAllergies,
                    pendingAI: session.pendingAI,
                    lang,
                    timer: verifyTimer,
                    senderTelegramToken: ctx.telegram && ctx.telegram.token ? ctx.telegram.token : botToken
                };

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
            await askForGuestInfo(ctx, Math.min(session.failedAttempts + 1, 3), 'both', session.lang || 'TR');
        }
        return;
    }

    // -- TEYIT BEKLENIYOR: Misafir resepsiyon onayini bekliyor ---
    if (session.state === 'awaiting_reception_verify') {
        const lang = session.lang || 'TR';
        const stillWaitMsg = getLangMsg('awaitingVerify', lang);
        await ctx.replyWithMarkdown(stillWaitMsg);
        return;
    }


    // ── BLOCKED durumunda yeni talep gelirse ─────────────────────────
    if (session.state === 'blocked') {
        const lang = session.lang || 'TR';
        // Sadece SORU ise yanıtla, TALEP ise resepsiyona yönlendir
        await ctx.sendChatAction('typing');
        const aiResult = await processMessageWithAI(userText, session);
        if (aiResult.isRequest) {
            await ctx.replyWithMarkdown(getLangMsg('blockedCallReception', session.lang || 'TR'));
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
    const greetingOnlyPatterns = /^(merhaba|selam|hey|hi|hello|meraba|slm|sa|selamlar|iyi günler|günaydın|iyi akşamlar|iyi geceler|nasılsınız|naber|good morning|good afternoon|good evening|good night|good day|greetings|howdy|bonjour|bonsoir|bonne nuit|salut|hallo|guten tag|guten morgen|guten abend|hola|buenos días|buenos tardes|buenos noches|ciao|buongiorno|buonasera|مرحبا|أهلاً|السلام عليكم|здравствуйте|привет|добрый день|добрый вечер)\s*[?.!🙏👋😊]*$/i;
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

    } catch (globalErr) {
        // ── GLOBAL HATA YAKALAYICI — Bot ASLA çökmemeli ──────────────────
        console.error(`💥 [GLOBAL_ERROR] chatId: ${chatId} | Hata:`, globalErr.message || globalErr);
        try {
            const hasLatin = /[a-z]/i.test(userText) && !/[çğışöüÇĞİŞÖÜ]/.test(userText);
            const safeMsg = hasLatin
                ? "I apologize for the inconvenience. Our system is experiencing a temporary issue. Please try again in a moment, or contact our reception: +90 (850) 222 72 75."
                : "Bir aksaklık yaşanıyor, lütfen birkaç saniye sonra tekrar deneyin. Acil durumlar için resepsiyonumuz 7/24 hizmetinizdedir: +90 (850) 222 72 75 📞";
            await ctx.reply(safeMsg);
        } catch (replyErr) {
            console.error(`💥 [REPLY_ERROR] Yanıt da gönderilemedi:`, replyErr.message);
        }
    } finally {
        // ── KİLİDİ SERBEST BIRAK ────────────────────────────────────────
        delete processingLocks[chatId];
        if (processingLockTimers[chatId]) {
            clearTimeout(processingLockTimers[chatId]);
            delete processingLockTimers[chatId];
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
        await ctx.answerCbQuery('Talep bulunamad\u0131.', { show_alert: true });
    }
});

// \u2500\u2500 Resepsiyon Teyit Buton Handler\u2019lar\u0131: ONAYLA / REDDET \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function handleVerifyYes(ctx) {
    const guestChatId = parseInt(ctx.match[1], 10);
    const verif = pendingVerifications[guestChatId];
    const receptionist = ctx.from.first_name || 'Resepsiyon';

    await ctx.answerCbQuery('Onaylan\u0131yor...', { show_alert: false });

    if (!verif) {
        await ctx.editMessageText(
            (ctx.callbackQuery.message.text || '') + '\n\n\u2139\ufe0f Bu talep zaten i\u015flendi veya s\u00fcresi doldu.'
        ).catch(() => {});
        return;
    }

    clearTimeout(verif.timer);
    delete pendingVerifications[guestChatId];

    const { resolvedName, resolvedRoom, resolvedAllergies, pendingAI, lang } = verif;

    // Session\u2019\u0131 tamamlanm\u0131\u015f olarak i\u015faretle
    if (!guestSessions[guestChatId]) {
        guestSessions[guestChatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0, lang };
    }
    const session = guestSessions[guestChatId];
    session.name = resolvedName;
    session.room = resolvedRoom;
    session.allergies = resolvedAllergies;
    session.state = 'complete';
    session.failedAttempts = 0;
    session.real_first_name = resolvedName.split(' ')[0];
    session.lang = lang;
    session.pendingAI = null;

    console.log(`\u2705 [VERIFY_YES] ${receptionist} onaylad\u0131: ${resolvedName} / Oda ${resolvedRoom} (chatId: ${guestChatId})`);

    // Misafiri dili ile bilgilendir ve beklenen talebi i\u015fle
    const senderTelegram = ctx.telegram || bot.telegram;
    if (pendingAI) {
        const { department, turkishSummary, replyToUser } = pendingAI;
        // routeToDepartment i\u00e7in minimal ctx benzeri obje yap
        const fakeCtx = {
            telegram: senderTelegram,
            chat: { id: guestChatId },
            reply: async (msg) => senderTelegram.sendMessage(guestChatId, msg).catch(() => {}),
            replyWithMarkdown: async (msg) => senderTelegram.sendMessage(guestChatId, msg, { parse_mode: 'Markdown' }).catch(() => {})
        };
        await routeToDepartment(fakeCtx, department, turkishSummary, guestChatId, resolvedName, resolvedRoom);
        const finalMsg = await generateFinalConfirmation(resolvedName, resolvedRoom, replyToUser);
        try { await senderTelegram.sendMessage(guestChatId, finalMsg); } catch (e) {}
    } else {
        const confirmMsgs = {
            TR: 'Kimli\u011finiz do\u011fruland\u0131! Art\u0131k talebinizi iletebilirsiniz. \ud83d\ude4f',
            EN: 'Your identity has been verified! You can now make your request. \ud83d\ude4f',
            DE: 'Ihre Identit\u00e4t wurde best\u00e4tigt! Sie k\u00f6nnen jetzt Ihre Anfrage stellen. \ud83d\ude4f',
            RU: '\u0412\u0430\u0448\u0430 \u043b\u0438\u0447\u043d\u043e\u0441\u0442\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043d\u0430! \u0422\u0435\u043f\u0435\u0440\u044c \u0432\u044b \u043c\u043e\u0436\u0435\u0442\u0435 \u043e\u0442\u043f\u0440\u0430\u0432\u0438\u0442\u044c \u0437\u0430\u043f\u0440\u043e\u0441. \ud83d\ude4f',
            AR: '\u062a\u0645 \u0627\u0644\u062a\u062d\u0642\u0642 \u0645\u0646 \u0647\u0648\u064a\u062a\u0643! \u064a\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062a\u0642\u062f\u064a\u0645 \u0637\u0644\u0628\u0643. \ud83d\ude4f',
            FR: 'Votre identit\u00e9 a \u00e9t\u00e9 v\u00e9rifi\u00e9e ! Vous pouvez maintenant faire votre demande. \ud83d\ude4f'
        };
        const confirmMsg = confirmMsgs[lang] || confirmMsgs['TR'];
        try { await senderTelegram.sendMessage(guestChatId, confirmMsg); } catch (e) {}
    }

    // Resepsiyona bilgi ver
    const oldMsg = ctx.callbackQuery.message.text || '';
    await ctx.editMessageText(
        oldMsg + '\n\n\u2705 *Onaylanm\u0131\u015f* \u2014 ' + receptionist + ' taraf\u0131ndan onayland\u0131.',
        { parse_mode: 'Markdown' }
    ).catch(() => {});
    console.log(`\ud83d\udce8 [VERIFY_YES] Talep departmana iletildi.`);
}

async function handleVerifyNo(ctx) {
    const guestChatId = parseInt(ctx.match[1], 10);
    const verif = pendingVerifications[guestChatId];
    const receptionist = ctx.from.first_name || 'Resepsiyon';

    await ctx.answerCbQuery('Reddedildi.', { show_alert: false });

    if (!verif) {
        await ctx.editMessageText(
            (ctx.callbackQuery.message.text || '') + '\n\n\u2139\ufe0f Bu talep zaten i\u015flendi veya s\u00fcresi doldu.'
        ).catch(() => {});
        return;
    }

    clearTimeout(verif.timer);
    delete pendingVerifications[guestChatId];

    const lang = verif.lang || 'TR';

    // Session\u2019\u0131 blocked yap
    if (guestSessions[guestChatId]) {
        guestSessions[guestChatId].state = 'blocked';
    }

    console.log(`\u274c [VERIFY_NO] ${receptionist} reddetti (chatId: ${guestChatId})`);

    // Misafire dili ile oda de\u011fi\u015fikli\u011fi a\u00e7\u0131klamas\u0131n\u0131 i\u00e7eren mesaj g\u00f6nder
    const senderTelegram = ctx.telegram || bot.telegram;
    const rejMsg = getLangMsg('verifyRejected', lang);
    try { await senderTelegram.sendMessage(guestChatId, rejMsg, { parse_mode: 'Markdown' }); } catch (e) {}

    // Resepsiyona bilgi ver
    const oldMsg = ctx.callbackQuery.message.text || '';
    await ctx.editMessageText(
        oldMsg + '\n\n\u274c *Reddedildi* \u2014 ' + receptionist + ' taraf\u0131ndan reddedildi.',
        { parse_mode: 'Markdown' }
    ).catch(() => {});
}

// Ana bot: verify butonlar\u0131
bot.action(/verify_yes_(-?\d+)/, handleVerifyYes);
bot.action(/verify_no_(-?\d+)/, handleVerifyNo);

// \u2500\u2500 /start Handler (Payla\u015f\u0131lan fonksiyon \u2014 t\u00fcm botlar i\u00e7in ortak) \u2500\u2500\u2500\u2500\u2500

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

// ── POLLING WATCHDOG: Son mesaj alım zamanı ──────────────────────────
let lastPollingUpdateTime = Date.now();

// ── Metin mesajları Handler (Paylaşılan) ──────────────────────────────
async function handleText(ctx) {
    const chatId = ctx.chat.id;
    const textMsg = ctx.message.text;
    lastPollingUpdateTime = Date.now(); // Watchdog: mesaj alındı
    console.log(`📨 [${chatId}] Müşteri: ${textMsg}`);

    // ── 1. SPA SORUSU? → spa_info skill ────────────────────────────────
    if (isSpaQuestion(textMsg)) {
        console.log('[SPA] SPA sorusu tespit edildi.');
        await ctx.sendChatAction('typing');
        const spaInfo = await getSpaInfo(supabase);
        await ctx.replyWithMarkdown(spaInfo.content);
        await saveMessageToDashboard(chatId, 'assistant', spaInfo.content);
        console.log(`✅ [SPA] Yanıt gönderildi (kaynak: ${spaInfo.source})`);
        return;
    }

    // ── 2. OTel İMKANLARI SORUSU? → hotel_facilities skill ─────────────────
    // NOT: Yemek/restoran soruları hem burayı HEM alerji kontrolünü tetikler.
    if (isFoodQuestion(textMsg)) {
        const lowerFood = textMsg.toLowerCase();
        // OTEL DIŞI restoran önerisi mi? (Perplexity'ye yönlenecek)
        const externalKeywords = ['yakın', 'yakında', 'civar', 'dışarı', 'şehir', 'bölge', 'öneri', 'tavsiye', 'nearby', 'around', 'outside', 'recommend', 'рядом', 'поблизости', 'à proximité', 'cerca', 'قريب'];
        const isExternalFood = externalKeywords.some(k => lowerFood.includes(k));

        if (isExternalFood) {
            console.log('[FOOD_EXTERNAL] Otel dışı restoran önerisi → alerji protokolü ATLANIR.');
            // Otel dışı sorularda alerji sorusu SORMA, sadece AI akışına bırak
        } else {
            console.log('[FOOD_INTERNAL] Otel içi yemek sorusu → alerji kontrolü yapılacak.');
            // Alerji sorusu sorulacak mı? Sadece session dogrulanmışsa ve alerji bilgisi yoksa.
            const session = guestSessions[chatId];
            if (session && session.state === 'complete' && session.name && !session.allergyAsked) {
                session.allergyAsked = true; // Bir kez sor
                const allergyQ = `Memnuniyetiniz için kısa bir soru: Herhangi bir gıda alerjiniz var mı? 🍽️\n_(Varsa lütfen belirtin, mutfağımızı önceden bilgilendirelim.)_`;
                await ctx.replyWithMarkdown(allergyQ);
                await saveMessageToDashboard(chatId, 'assistant', allergyQ);
                console.log(`✅ [FOOD_ALLERGY] Alerji sorusu soruldu → chatId: ${chatId}`);
                // Asıl soruya da cevap ver (AI ile devam et)
            }
        }
    }

    // ── 3. ÇEVRE SORUSU? → Perplexity ile yanıtla ────────────────────
    if (isSurroundingsQuestion(textMsg)) {
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

    // ── 4. KROKI / HARITA ──────────────────────────────────────
    const mapKeywords = ['kroki', 'map', 'floor plan', 'plan', 'layout', 'kat planı', 'şema'];
    if (mapKeywords.some(k => textMsg.toLowerCase().includes(k))) {
        await sendHotelMap(ctx);
        return;
    }

    // ── 5. GENEL AI İŞLEME ──────────────────────────────────────
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

// ── Fotoğraf Handler (Teknik servis görsel iletme) ────────────────────
async function handlePhoto(ctx) {
    const chatId = ctx.chat.id;
    const caption = ctx.message.caption || '';
    console.log(`📸 [${chatId}] Fotoğraf alındı. Caption: "${caption}"`);

    // Oturumu kontrol et
    if (!guestSessions[chatId]) {
        const restored = await restoreSessionFromDB(chatId);
        if (restored) {
            guestSessions[chatId] = restored;
        } else {
            guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null, failedAttempts: 0 };
        }
    }
    const session = guestSessions[chatId];

    // Misafir doğrulanmamışsa bilgi iste
    if (session.state !== 'complete' || !session.name || !session.room) {
        session.pendingPhoto = ctx.message.photo[ctx.message.photo.length - 1].file_id;
        session.pendingPhotoCaption = caption;
        session.state = 'awaiting_info';
        session.pendingAI = {
            isRequest: true,
            department: 'TEKNIK',
            turkishSummary: `Fotoğraflı arıza bildirimi: ${caption || 'Açıklama yok'}`,
            replyToUser: 'Fotoğrafınızı aldım! Talebinizi iletebilmem için birkaç bilgiye ihtiyacım var. 🙏'
        };
        await askForGuestInfo(ctx, 1, 'both');
        return;
    }

    // Doğrulanmış misafir → fotoğrafı departmana ilet
    await ctx.sendChatAction('typing');
    const photoFileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    // Departman tespiti (caption'dan veya varsayılan TEKNIK)
    let targetDept = 'TEKNIK';
    if (caption) {
        const lowerCap = caption.toLowerCase();
        if (['temizlik', 'havlu', 'çarşaf', 'yastık', 'housekeeping'].some(k => lowerCap.includes(k))) {
            targetDept = 'HOUSEKEEPING';
        } else if (['yemek', 'restoran', 'sipariş', 'food', 'room service'].some(k => lowerCap.includes(k))) {
            targetDept = 'F&B';
        }
    }

    // Departman grubuna fotoğrafı ilet
    try {
        const _cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'skills', 'telegram_config.json'), 'utf8'));
        const currentBotToken = ctx.telegram.token || botToken;
        let targetChatId = null;
        let senderBot = bot;

        if (_cfg.managers) {
            for (const [, mgr] of Object.entries(_cfg.managers)) {
                if (mgr.botToken === currentBotToken && mgr.departments && mgr.departments[targetDept]) {
                    targetChatId = mgr.departments[targetDept].chatId;
                    if (mgr.botToken !== botToken) {
                        const matched = secondaryBots.find(sb => sb.telegram && sb.telegram.token === mgr.botToken);
                        if (matched) senderBot = matched;
                    }
                    break;
                }
            }
        }

        if (targetChatId) {
            const photoMsg = `📸 *FOTOĞRAFLI BİLDİRİM*\n👤 *Misafir:* ${session.name}\n🚪 *Oda:* ${session.room}\n📝 *Açıklama:* ${caption || 'Açıklama eklenmedi'}\n🏢 *Departman:* ${getDepartmentDisplayName(targetDept)}`;
            await senderBot.telegram.sendPhoto(targetChatId, photoFileId, {
                caption: photoMsg,
                parse_mode: 'Markdown'
            });
            console.log(`✅ [PHOTO] Fotoğraf iletildi → ${targetDept} (chatId: ${targetChatId})`);

            const confirmMsg = `📸 Fotoğrafınız ve bildiriminiz ${getDepartmentDisplayName(targetDept)} departmanına iletildi. En kısa sürede ilgilenilecektir! 🙏`;
            await ctx.reply(confirmMsg);
            await saveMessageToDashboard(chatId, 'assistant', confirmMsg);
        } else {
            // Fallback: caption varsa normal mesaj olarak işle
            if (caption) {
                await handleIncomingMessage(ctx, caption);
            } else {
                await ctx.reply('📸 Fotoğrafınızı aldım. Lütfen sorununuzu kısaca açıklayınız, hemen ilgili departmana ileteceğim. 🙏');
            }
        }
    } catch (e) {
        console.error('[PHOTO_HANDLER] Hata:', e.message);
        await ctx.reply('Fotoğrafınız alındı ancak iletim sırasında bir sorun oluştu. Lütfen sorununuzu yazılı olarak da bildiriniz. 🙏');
    }
}
bot.on('photo', handlePhoto);

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

    secBot.action(/verify_yes_(-?\d+)/, handleVerifyYes);
    secBot.action(/verify_no_(-?\d+)/, handleVerifyNo);
    // Misafir handler'ları
    secBot.start(handleStart);
    secBot.command('harita', handleHarita);
    secBot.on('text', handleText);
    secBot.on('voice', handleVoice);
    secBot.on('photo', handlePhoto);
    console.log(`✅ [MULTI-BOT] ${secBot._managerName} bot handler'ları kaydedildi.`);
}

// (Express API webhook kaldırıldı, bu dosya sadece Telegram Guest Worker olarak hizmet verir)

// ── GLOBAL HATA YAKALAYICI (bot.catch) ────────────────────────────────
// Bu handler olmadan Telegraf "Unhandled error" loglar ve kullanıcıya hiçbir yanıt dönmez
bot.catch(async (err, ctx) => {
    console.error(`💥 [BOT.CATCH ANA BOT] Hata yakalandı:`, err.message || err);
    try {
        if (ctx && ctx.chat) {
            await ctx.reply('Bir aksaklık yaşandı, lütfen tekrar deneyin. Acil durumlar için: +90 (850) 222 72 75 📞');
        }
    } catch (e) { /* yanıt da gönderilemezse sessizce devam et */ }
});

for (const secBot of secondaryBots) {
    secBot.catch(async (err, ctx) => {
        console.error(`💥 [BOT.CATCH ${secBot._managerName}] Hata yakalandı:`, err.message || err);
        try {
            if (ctx && ctx.chat) {
                await ctx.reply('Bir aksaklık yaşandı, lütfen tekrar deneyin. Acil durumlar için: +90 (850) 222 72 75 📞');
            }
        } catch (e) { /* yanıt da gönderilemezse sessizce devam et */ }
    });
}

// ── Botları Başlat ────────────────────────────────────────────────────
console.log('⏳ Telegram bağlantıları kuruluyor...');

// Bot ba\u015flatma fonksiyonu \u2014 409 Conflict durumunda bekleyip retry yapar (PM2'yi asla sonland\u0131rmaz)
async function launchBot(botInstance, label, attempt = 1) {
    try {
        // ⚠️ drop_pending_updates: false → Bot restart olduğunda bekleyen mesajlar KORUNUR
        // Eski ayar (true) mesajları siliyordu ve kullanıcılar cevap alamıyordu!
        await botInstance.telegram.deleteWebhook({ drop_pending_updates: false });
        console.log(`🔄 [${label}] Webhook temizlendi, polling başlatılıyor... (deneme ${attempt})`);

        botInstance.launch().catch(err => {
            if (err.message && err.message.includes('409')) {
                // 409: Telegram sunucusunda eski bağlantı var
                // Hızlı retry: 15sn (eski: 75sn) — her seferinde webhook temizlenir
                const waitSec = attempt <= 3 ? 15 : 30;
                console.warn(`⚠️ [${label}] 409 Conflict (deneme ${attempt}/${attempt <= 5 ? '5' : '∞'}). ${waitSec}sn sonra tekrar denenecek...`);
                setTimeout(() => launchBot(botInstance, label, attempt + 1), waitSec * 1000);
            } else {
                console.error(`❌ [${label}] Launch hatası:`, err.message);
                // Diğer hatalarda 10sn bekleyip tekrar dene
                setTimeout(() => launchBot(botInstance, label, attempt + 1), 10000);
            }
        });

        // 8sn sonra doğrulama
        setTimeout(async () => {
            try {
                const me = await botInstance.telegram.getMe();
                console.log(`✅ [${label}] Bot aktif ve çalışıyor: @${me.username} (ID: ${me.id})`);
            } catch (e) {
                console.warn(`⚠️ [${label}] getMe hatası (polling devam ediyor olabilir):`, e.message);
            }
        }, 8000);
    } catch (err) {
        console.error(`❌ [${label}] deleteWebhook hatası:`, err.message);
        console.log(`🔄 [${label}] 10sn sonra tekrar denenecek...`);
        setTimeout(() => launchBot(botInstance, label, attempt + 1), 10000);
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

    // 3. Sağlık izleme sistemini başlat (AI Agent Manager)
    const healthMonitor = createHealthMonitor({
        openai,
        supabase,
        bot,
        secondaryBots,
        adminChatId: telegramConfig.managers?.ozgur_ozen?.telegramId || '758605940'
    });
    healthMonitor.startPeriodicCheck();

    // 4. POLLING WATCHDOG — Bot sessizce polling kaybederse otomatik yeniden başlat
    const WATCHDOG_CHECK_INTERVAL = 3 * 60 * 1000;  // Her 3 dakikada kontrol
    const WATCHDOG_MAX_SILENCE    = 5 * 60 * 1000;  // 5 dakika sessizlik = sorun
    let watchdogRestartInProgress = false;

    setInterval(async () => {
        const silenceMs = Date.now() - lastPollingUpdateTime;
        const silenceMin = Math.round(silenceMs / 60000);

        if (silenceMs > WATCHDOG_MAX_SILENCE && !watchdogRestartInProgress) {
            watchdogRestartInProgress = true;
            console.error(`🐕 [WATCHDOG] ${silenceMin} dakikadır hiç mesaj alınmadı! Bot polling'i yeniden başlatılıyor...`);

            // Admin'e bildirim gönder
            const adminId = telegramConfig.managers?.ozgur_ozen?.telegramId || '758605940';
            try {
                await bot.telegram.sendMessage(adminId,
                    `🐕 *WATCHDOG UYARISI*\n\n${silenceMin} dakikadır hiç mesaj alınmadı.\nBot polling yeniden başlatılıyor...\n\n⏰ ${new Date().toLocaleTimeString('tr-TR')}`,
                    { parse_mode: 'Markdown' }
                );
            } catch (e) { /* admin bildirimi başarısız olabilir */ }

            // Bot'u durdur ve yeniden başlat
            try {
                bot.stop('WATCHDOG_RESTART');
                for (const sb of secondaryBots) {
                    try { sb.stop('WATCHDOG_RESTART'); } catch (e) {}
                }
            } catch (e) {
                console.warn('[WATCHDOG] Bot durdurma hatası:', e.message);
            }

            // 3 saniye bekle, sonra yeniden başlat
            await new Promise(r => setTimeout(r, 3000));
            lastPollingUpdateTime = Date.now(); // Reset timer
            await launchBot(bot, 'ANA BOT (WATCHDOG)');
            for (let i = 0; i < secondaryBots.length; i++) {
                await new Promise(r => setTimeout(r, 1000));
                await launchBot(secondaryBots[i], secondaryBots[i]._managerName || `İKİNCİL BOT ${i + 1} (WATCHDOG)`);
            }
            watchdogRestartInProgress = false;
            console.log('🐕 [WATCHDOG] Bot yeniden başlatıldı.');
        }
    }, WATCHDOG_CHECK_INTERVAL);
    console.log(`🐕 [WATCHDOG] Polling izleme aktif (${WATCHDOG_MAX_SILENCE / 60000}dk sessizlik eşiği)`);
})();

// Bilgilendirme (asenkron beklemeden)
console.log(`🏨 Otel: The Green Park Gaziantep`);
console.log(`🔗 Dashboard API: ${DASHBOARD_API}`);
console.log(`🤖 AI Model: GPT-4o-mini (hız optimizasyonu)`);
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
