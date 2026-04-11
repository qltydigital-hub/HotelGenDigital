require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { OpenAI } = require('openai');
const { createClient } = require('@supabase/supabase-js');
const express = require('express');
const cors = require('cors');

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
app.use(cors());
app.use(express.json());

const EXPRESS_PORT = process.env.EXPRESS_PORT || 3005;

const botToken = process.env.TELEGRAM_TOKEN || '8525541333:AAFlgjZezQBY9ao77JqABKGMS3Znq5g0uRw';
const bot = new Telegraf(botToken);

const DASHBOARD_API = process.env.DASHBOARD_API_URL || 'http://localhost:3000';

// SLA Takip Deposu
const pendingTickets = {};

// Misafir oturum bilgileri: chatId -> { name, room, state, pendingAI, failedAttempts }
// state: 'complete' | 'awaiting_info' | 'blocked'
const guestSessions = {};

// Resepsiyon not ekleme durumu: chatId -> { ticketId, department, guestName, guestRoom }
const receptionNoteStates = {};

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

// ── DİNAMİK .MD DOSYA OKUYUCU (DOCS LOADER) ────────────────────────────────
// Bot başlangıcında docs/ klasöründeki kuralları ve bilgi bankasını yükler.
// Tüm .md dosyaları TEK KLASÖRDE toplanmıştır (Single Source of Truth).
// README.md (Sistem Anayasası) proje root'undan ayrıca yüklenir.
// .md dosyaları güncellendiğinde bot restart ile değişiklikler otomatik aktif olur.

const DOCS_DIR = path.resolve(__dirname, '..', 'docs');
const ROOT_DIR = path.resolve(__dirname, '..');

function loadDocFile(filename) {
    const filePath = path.join(DOCS_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log(`📄 [DOCS] ${filename} yüklendi (${content.length} karakter)`);
            return content;
        } else {
            console.warn(`⚠️ [DOCS] ${filename} bulunamadı: ${filePath}`);
            return '';
        }
    } catch (e) {
        console.error(`❌ [DOCS] ${filename} okunamadı:`, e.message);
        return '';
    }
}

// Root dizininden dosya yükle (README.md gibi docs/ dışındaki anayasa dosyaları için)
function loadRootFile(filename) {
    const filePath = path.join(ROOT_DIR, filename);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            console.log(`📜 [ROOT] ${filename} yüklendi (${content.length} karakter)`);
            return content;
        } else {
            console.warn(`⚠️ [ROOT] ${filename} bulunamadı: ${filePath}`);
            return '';
        }
    } catch (e) {
        console.error(`❌ [ROOT] ${filename} okunamadı:`, e.message);
        return '';
    }
}

// ── SİSTEM ANAYASASI (ROOT — README.md) ────────────────────────────────────
// README.md proje root'unda bulunur (GitHub uyumu), bot onu buradan yükler.
const SISTEM_ANAYASASI = loadRootFile('README.md');

// ── TÜM KURAL DOSYALARINI YÜKLE (docs/ — Tek Kaynak) ───────────────────────
const DOCS = {
    bilgiBankasi:      loadDocFile('OTEL_BILGI_BANKASI.md'),
    davranisKurallari: loadDocFile('AI_DAVRANIS_KURALLARI.md'),
    talepYonetimi:     loadDocFile('TALEP_YONETIMI.md'),
    misafirDogrulama:  loadDocFile('MISAFIR_DOGRULAMA.md'),
    departmanSLA:      loadDocFile('DEPARTMAN_SLA_YONETIMI.md'),
    zamanYonetimi:     loadDocFile('ZAMAN_YONETIMI.md'),
    guvenlik:          loadDocFile('GUVENLIK_VE_ERISIM.md'),
    hafizaYonetimi:    loadDocFile('HAFIZA_YONETIMI.md'),
};

// ── GENİŞLETİLMİŞ BİLGİ BANKASI (Aynı klasörden, ek dosyalar) ─────────────
const KNOWLEDGE = {
    konusmaSenaryolari: loadDocFile('KONUSMA_AKIS_SENARYOLARI.md'),
    hataSenaryolari:    loadDocFile('HATA_SENARYOLARI.md'),
    vipProtokolu:       loadDocFile('VIP_PROTOKOLU.md'),
    acilDurum:          loadDocFile('ACIL_DURUM_PROTOKOLU.md'),
    kanalEntegrasyon:   loadDocFile('KANAL_ENTEGRASYONU.md'),
    raporlama:          loadDocFile('RAPORLAMA_VE_ANALITIK.md'),
    cokluDil:           loadDocFile('COKLU_DIL_YONETIMI.md'),
    sistemBakim:        loadDocFile('SISTEM_BAKIM_VE_IZLEME.md'),
};

// Yükleme özeti (16 docs + 1 root README = 17 toplam)
const docsCount = Object.values(DOCS).filter(d => d.length > 0).length;
const knowledgeCount = Object.values(KNOWLEDGE).filter(d => d.length > 0).length;
const anayasaLoaded = SISTEM_ANAYASASI.length > 0 ? 1 : 0;
const totalLoaded = docsCount + knowledgeCount + anayasaLoaded;
console.log(`\n🗂️  [DOCS LOADER] ${totalLoaded}/17 dosya yüklendi.`);
console.log(`   ├── 📜 Sistem Anayasası (README.md): ${anayasaLoaded ? '✅ YÜKLENDİ' : '❌ BULUNAMADI'}`);
console.log(`   ├── Ana Kurallar (docs/): ${docsCount}/8`);
console.log(`   └── Bilgi Bankası (docs/): ${knowledgeCount}/8\n`);

// ── OTEL KNOWLEDGE BASE (DOCS'TAN DİNAMİK YÜKLEME) ────────────────────────
// Eğer .md dosyası yüklendiyse onu kullan, yoksa hardcoded fallback
const HOTEL_KNOWLEDGE = DOCS.bilgiBankasi || `
Sen Azure Coast Resort & SPA'nın akıllı misafir asistanısın. Aşağıdaki bilgileri kullanarak soruları yanıtla.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HOTEL FACTSHEET - GENEL SABİTLER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

GENEL BİLGİLER:
• Otel Adı: Azure Coast Resort & SPA
• Yıldız: 5 Yıldız | Konsept: Ultra Her Şey Dahil
• Adres: Beldibi Mah. Atatürk Cad. No:42, Kemer / Antalya
• Telefon: +90 242 824 00 00
• Rezervasyon Çalışma Saatleri: 09:00 - 18:00

REZERVASYON VE BANKA BİLGİLERİ (IBAN):
• Önce otel üzerinden direkt rezervasyon sun.
  - Alıcı: Azure Coast Otel İşletmeleri A.Ş.
  - Banka: Garanti BBVA - Antalya Ticari Şubesi
  - IBAN: TR98 0006 2000 0000 1234 5678 90
• Güven sorunu varsa acenta linklerini sun:
  - ETS Tur: https://www.etstur.com/Azure-Coast
  - Jolly Tur: https://www.jollytur.com/Azure-Coast
`;

// ── AI DAVRANIŞ KURALLARI (DOCS'TAN DİNAMİK YÜKLEME) ──────────────────────
// System prompt'a ek kural olarak enjekte edilecek
const AI_RULES_FROM_DOCS = DOCS.davranisKurallari || '';


// ── Otel haritasını gönder ────────────────────────────────────────────
async function sendHotelMap(ctx) {
    const mapPath = path.resolve(__dirname, 'assets', 'hotel_harita.png');
    if (fs.existsSync(mapPath)) {
        await ctx.replyWithPhoto(
            { source: fs.createReadStream(mapPath) },
            { caption: '🗺️ *Azure Coast Resort & SPA — Otel Krokisi*\nTesisin genel yerleşim haritası. İyi tatiller! 🏖️', parse_mode: 'Markdown' }
        );
    } else {
        await ctx.reply('🗺️ Otel haritası şu an yüklenemiyor. Resepsiyonumuza danışabilirsiniz.');
    }
}

// ── Dashboard'a mesaj kaydet ──────────────────────────────────────────
async function saveMessageToDashboard(chatId, role, text, platform = 'Telegram') {
    try {
        await axios.post(`${DASHBOARD_API}/api/messages`, {
            chatId: String(chatId),
            role,
            text,
            platform
        }, { timeout: 3000 });
    } catch (err) {
        console.warn('⚠️  Dashboard API ulaşılamıyor (Timeout veya Hata):', err.message);
    }
}

// ── Alerji Alarmı (Guest Relations'a anında uyarı) ───────────────────
async function alertGuestRelationsAboutAllergy(guestName, guestRoom, allergies) {
    if (!supabase) return;
    try {
        // Guest Relations yetkililerini bul
        const { data: grPersonnel } = await supabase
            .from('hotel_personnel')
            .select('*')
            .eq('department', 'GUEST_RELATIONS')
            .eq('is_active', true);

        const alertMsg = `⚠️ *KRİTİK ALERJİ BİLDİRİMİ* ⚠️
👤 *Misafir:* ${guestName}
🚪 *Oda:* ${guestRoom}
🚫 *Alerji/Diyet:* ${allergies}

_Bu misafir sisteme yeni giriş yaptı. Lütfen iletişime geçiniz._`;

        if (grPersonnel && grPersonnel.length > 0) {
            for (const person of grPersonnel) {
                if (person.platform.toUpperCase() === 'TELEGRAM') {
                    await bot.telegram.sendMessage(person.contact_id, alertMsg, { parse_mode: 'Markdown' });
                }
            }
        }
        
        // Log to allergy_alerts table if it exists
        await supabase.from('allergy_alerts').insert({
            guest_name: guestName,
            room_no: guestRoom,
            allergy_details: allergies,
            alert_status: 'NOTIFIED'
        });
    } catch (e) {
        console.error('Allergy alert error:', e.message);
    }
}

// ── OGG → MP3 ─────────────────────────────────────────────────────────
function convertOggToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
}

// ── AI ile mesaj işle (Soru mu, Talep mi?) ────────────────────────────
async function processMessageWithAI(userText, session = null) {
    if (!openai) {
        return { replyToUser: "⚙️ OpenAI API anahtarı tanımlı değil.", isRequest: false };
    }

    const nowStr = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "full", timeStyle: "short" });

    const SYSTEM_PROMPT = [
        // ═══ KATMAN 0: SİSTEM ANAYASASI (README.md — ROOT) ═══
        // Tüm sistemin temel kuralları ve mimarisi buradan gelir.
        SISTEM_ANAYASASI ? `╔══════════════════════════════════════════════════╗
║          SİSTEM ANAYASASI (README.md)            ║
╚══════════════════════════════════════════════════╝
${SISTEM_ANAYASASI.substring(0, 4000)}` : '',

        // ═══ KATMAN 1: GERÇEK ZAMANLI VERİ ═══
        `╔══════════════════════════════════════════════════╗
║            GERÇEK ZAMANLI SİSTEM VERİSİ          ║
╚══════════════════════════════════════════════════╝
🕰️ ŞU ANKİ TARİH VE SAAT: ${nowStr}
⚠️ KRİTİK: Misafir saat/gün/tarih sorarsa SADECE bu veriyi kullan. "Sisteme bağlı değilim", "araştırıyorum" deme. Anında profesyonelce yanıt ver.
${DOCS.zamanYonetimi ? `
[ZAMAN YÖNETİMİ PROTOKOLÜ]
${DOCS.zamanYonetimi.substring(0, 1500)}` : ''}`,

        // ═══ KATMAN 1.5: MİSAFİR OTURUM BİLGİLERİ ═══
        (session && session.state === 'complete' && session.real_first_name) ? `╔══════════════════════════════════════════════════╗
║             AKTİF MİSAFİR BİLGİSİ                ║
╚══════════════════════════════════════════════════╝
Sen şu an doğrulanmış bir misafirle konuşuyorsun:
- Adı Soyadı: ${session.real_first_name} ${session.last_name || ''}
- Oda Numarası: ${session.room}
- Giriş Tarihi: ${session.checkin_date || 'Bilinmiyor'}
- Çıkış Tarihi: ${session.checkout_date || 'Bilinmiyor'}

Bu misafiri tanıyorsun. Hitap ederken "Sayın ${session.real_first_name} ${session.last_name ? 'Bey/Hanım' : 'Misafirimiz'}" şeklinde hitap edebilirsin.
Giriş veya çıkış tarihlerini sorarsa DİREKT olarak bu bilgileri ver.` : `╔══════════════════════════════════════════════════╗
║             AKTİF MİSAFİR BİLGİSİ                ║
╚══════════════════════════════════════════════════╝
Şu an konuştuğun kişi henüz doğrulanmadı. ADINI, SOYADINI, ODA NUMARASINI ASLA BİLMİYORSUN.
KİŞİYE İSİM UYDURMAN KESİNLİKLE YASAKTIR!
Sadece "Sayın Misafirimiz" diyerek hitap et.`,

        // ═══ KATMAN 2: OTEL BİLGİ BANKASI ═══
        `╔══════════════════════════════════════════════════╗
║              OTEL BİLGİ BANKASI                  ║
╚══════════════════════════════════════════════════╝
${HOTEL_KNOWLEDGE}`,

        // ═══ KATMAN 3: KRİTİK DAVRANIŞ KURALLARI ═══
        `╔══════════════════════════════════════════════════╗
║        KRİTİK KURALLAR — İHLAL EDİLEMEZ          ║
╚══════════════════════════════════════════════════╝

████ KURAL 1: SIFIR HALÜSİNASYON — İSİM UYDURMA MUTLAK YASAK ████
- BAŞKA HİÇBİR İSİM KULLANAMAZSIN (Örneğin test, Haydar Bakır, default, user vs YASAK!).
- Eğer yukarıdaki "AKTİF MİSAFİR BİLGİSİ" bölümünde misafirin adı yazmıyorsa, BİLMİYORSUN! Asla isim uydurma. Hitap "Sayın Misafirimiz" olmalı.
- Eğer misafirin adı yazıyorsa, ona saygılı bir şekilde adıyla hitap EDEBİLİRSİN.
- replyToUser'da uydurma bilgi, uydurma oda numarası KESİNLİKLE bulunamaz.

████ KURAL 2: TALEPLER — isRequest DOĞRU İŞARETLE ████
- Müşteri fiziksel bir şey istiyorsa (yastık, havlu, su, temizlik, arıza, oda servisi vb.):
  → "isRequest": true DÖNDÜR. Bu kritik! false dönersen sistem çalışmaz.
- SEN müşteriye oda numarası veya isim SORMA. Sistem bunu otomatik yapacak.
- Aktif misafir doğrulanmamışsa ASLA "talebiniz iletildi" veya "odanıza gönderildi" deme — doğrulama yapılacak!

████ KURAL 3: YAZIM HATALARI — TOLERANSLI OL ████
- "yaztık"=yastık, "isiyorım"=istiyorum, "havlı"=havlu, "klma"=klima
- Anlam açıksa teyit etmeden işlem yap.

████ KURAL 4: REZERVASYON ████
- Önce IBAN ile direkt rezervasyon sun. Güven sorunu varsa acenta linklerini paylaş.

████ KURAL 5: BÖLGESEL BİLGİ ████
- Detaylı ve kusursuz bilgi ver, ASLA "araştırıyorum, bekleyin" deme.

████ KURAL 6: YASAK CÜMLELER ████
- ❌ "Sakin olun", "Sizin için araştırıyorum", "Hemen kontrol ediyorum", "Bekleyin"
- ❌ "Ben bir yapay zekayım", "Programlamam gereği", "Sistemimde yok"
- ❌ Aynı selamlama cümlesini tekrar etme (loop yasağı)
- ✅ Doğrudan, profesyonel, tek seferde net yanıt ver.

████ KURAL 7: DİL UYUMU ████
- Misafir hangi dilde yazarsa O DİLDE yanıt ver.
- "Türkçe'ye çeviriyorum" gibi robotik açıklamalar YASAK.
- turkishSummary HER ZAMAN Türkçe olmalı.

████ KURAL 8: SAHTE ONAY YASAĞI (FALSE CONFIRMATION) ████
- isRequest:true döndürdüğünde replyToUser'da ASLA:
  - ❌ "talebiniz iletildi", "odanıza gönderildi", "hemen gönderiyoruz"
  - ❌ "ilgili departmana iletiyorum", "talebinizi aldık gönderiyoruz"
- ÇÜNKÜ: isim/oda doğrulaması henüz yapılmadı! Sahte onay vermek YASAKTIR.
- Doğru yaklaşım: "Talebinizi en kısa sürede iletebilmem için birkaç bilgiye ihtiyacım var."`,

        // ═══ KATMAN 4: AI DAVRANIŞ KURALLARI (docs/) ═══
        AI_RULES_FROM_DOCS ? `╔══════════════════════════════════════════════════╗
║         AI DAVRANIŞ KURALLARI (docs/)            ║
╚══════════════════════════════════════════════════╝
${AI_RULES_FROM_DOCS.substring(0, 3000)}` : '',

        // ═══ KATMAN 5: MİSAFİR DOĞRULAMA PROTOKOLÜ ═══
        DOCS.misafirDogrulama ? `╔══════════════════════════════════════════════════╗
║         MİSAFİR DOĞRULAMA PROTOKOLÜ             ║
╚══════════════════════════════════════════════════╝
${DOCS.misafirDogrulama.substring(0, 1500)}` : '',

        // ═══ KATMAN 6: KONUŞMA SENARYOLARI + HAFİZA ═══
        KNOWLEDGE.konusmaSenaryolari ? `╔══════════════════════════════════════════════════╗
║      KONUŞMA AKIŞ SENARYOLARI (DOĞRU/YANLIŞ)    ║
╚══════════════════════════════════════════════════╝
${KNOWLEDGE.konusmaSenaryolari.substring(0, 2000)}` : '',

        // ═══ KATMAN 7: ÇIKTI ŞABLONU ═══
        `╔══════════════════════════════════════════════════╗
║              JSON ÇIKTI ŞABLONU                  ║
╚══════════════════════════════════════════════════╝

3) TALEP/İSTEK (fiziksel hizmet, arıza, şikayet):
   {"isRequest": true, "department": "HOUSEKEEPING|TEKNIK|RESEPSIYON|F&B|GUEST_RELATIONS|SPA|IT|SECURITY", "turkishSummary": "Kısa Türkçe özet", "replyToUser": "İsimsiz, genel onay mesajı"}

2) SORU/BİLGİ (saat, restoran, bölge bilgisi, sohbet):
   {"isRequest": false, "replyToUser": "Doğrudan profesyonel yanıt"}

⛔ MUTLAK KURALLAR:
- Yalnızca JSON objesi döndür! Markdown kullanma.
- MİSAFİR DOĞRULANMAMIŞSA, replyToUser'da isRequest:true ise "iletildi/gönderildi" KELİMELERİ YASAK!`
    ].filter(Boolean).join('\n\n');

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

ÖRNEK DOĞRU ÇIKARIMLAR:
- "Mehmet Kaya, 305" → {"name":"Mehmet Kaya","room":"305","allergies":null}
- "Oda 412, Demir" → {"name":"Demir","room":"412","allergies":null}
- "Ben Ali, 201 nolu odadayım, fıstık alerjim var" → {"name":"Ali","room":"201","allergies":"Fıstık alerjisi"}

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
        if (result.name && (result.room || result.room_no)) return { ...result, room: result.room || result.room_no };
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

    // Grup chat referansını ekle (.env'den)
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
                const tk = pendingTickets[ticketId];
                if (tk && tk.status === 'pending') {
                    tk.status = 'escalated';
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

                    const escalationMsg = `🚨 *ESCALATION ALERT*
🏢 *Unresponsive Dept:* ${department}
👤 *Info:* Room ${guestRoom} | ${guestName}
📝 *TASK:* ${turkishSummary}

⏰ _FAILURE: ${department} failed to respond within SLA._
*Investigate and fulfill request immediately.*
Lütfen aşağıdan inceleme notu ekleyin.`;

                    // İlk Resepsiyon ID'sini referans al
                    pendingTickets[ticketId].escalateTarget = escalationTargets[0].contact_id;

                    for (const rec of escalationTargets) {
                        if (rec.platform.toUpperCase() === 'TELEGRAM') {
                            try {
                                await bot.telegram.sendMessage(rec.contact_id, escalationMsg, {
                                    parse_mode: 'Markdown',
                                    ...Markup.inlineKeyboard([
                                        Markup.button.callback('📝 İnceleme Notu Ekle', `note_${ticketId}`)
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

    await ctx.answerCbQuery();
    await ctx.reply(
        `📝 *İnceleme Notu Ekle*\n\nNotunuzu aşağıya yazabilirsiniz:`,
        { parse_mode: 'Markdown' }
    );
});

// ── Misafir bilgisi sor ───────────────────────────────────────────────
async function askForGuestInfo(ctx, attempt = 1) {
    let msg;
    if (attempt === 1) {
        msg = `Talebinizi hızlıca iletebilmem için birkaç bilgiye ihtiyacım var 🙏

1️⃣ *Adınız Soyadınız*
2️⃣ *Oda Numaranız*

_(Örnek: Mehmet Kaya, Oda 412)_`;
    } else if (attempt === 2) {
        msg = `Üzgünüm, bilgileri anlayamadım 😊 Lütfen şu formatta yazabilir misiniz?

*Ad Soyad, Oda [numara]*
_(Örnek: Mehmet Kaya, Oda 412)_`;
    } else {
        msg = `Maalesef bilgilerinizi doğrulayamıyoruz. 😔
Lütfen resepsiyonumuzu arayarak destek alabilirsiniz:
📞 *+90 242 824 00 00*

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
            failure_reason: `Management Review: ${userText}` // Failure explanation for reporting
        });
        await dbLogEvent(ticketId, 'RECEPTION_NOTE', actor, userText);

        console.log(`📝 [RESEPSIYON NOTU] ${ticketId} - ${actor}: ${userText}`);

        // Not ekleme modundan çık
        delete receptionNoteStates[chatId];

        // Resepsiyona onay (Not kaydedildi)
        await ctx.replyWithMarkdown(
            `✅ *Notunuz kaydedildi.*\n\n*Yazan:* ${actor}\n*Not:* ${userText}`
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

        if (guestInfo && guestInfo.name && guestInfo.room) {
            // ── GÜVENLIK KONTROLÜ: AI uydurmuş olabilir mi? ──────────
            // Eğer çıkarılan isim orijinal mesajda hiç geçmiyorsa → reddet
            const nameFirstPart = guestInfo.name.split(' ')[0].toLowerCase();
            if (!userText.toLowerCase().includes(nameFirstPart)) {
                console.warn(`⚠️ [FABRİKASYON TESPİT] AI "${guestInfo.name}" üretti ama mesajda "${nameFirstPart}" geçmiyor!`);
                session.failedAttempts++;
                await askForGuestInfo(ctx, 2);
                return;
            }

            // In-House Doğrulaması
            const validation = await validateGuestInHouse(guestInfo.name, guestInfo.room);
            
            if (!validation.valid) {
                session.failedAttempts++;
                if (session.failedAttempts >= 3) {
                    // 3. başarısız deneme → resepsiyona yönlendir
                    await askForGuestInfo(ctx, 3);
                    session.state = 'blocked';
                    console.warn(`🚫 [DOĞRULAMA BAŞARISIZ x3] chatId: ${chatId} → Resepsiyona yönlendirildi.`);
                    
                    // Resepsiyona bilgi ver
                    if (supabase) {
                        const { data: recPersonnel } = await supabase.from('hotel_personnel')
                            .select('*').eq('department', 'RESEPSIYON').eq('is_active', true);
                        if (recPersonnel && recPersonnel.length > 0) {
                            const infoMsg = `🚨 *DIŞ KULLANICI / DOĞRULAMA BAŞARISIZ*
Bir kullanıcı 3 kez sisteme hatalı bilgi girerek bloke oldu. Lütfen In-House verilerinizi kontrol ediniz.
👤 *Denenen Ad:* ${guestInfo.name}
🚪 *Denenen Oda:* ${guestInfo.room}
💬 *Uygulama ID:* ${chatId}`;
                            recPersonnel.forEach(async (rec) => {
                                if (rec.platform.toUpperCase() === 'TELEGRAM') {
                                    try { await bot.telegram.sendMessage(rec.contact_id, infoMsg, { parse_mode: 'Markdown' }); } 
                                    catch (e) {}
                                }
                            });
                        }
                    }
                } else {
                    const failMsg = `⚠️ Üzgünüm, oda bilgileriniz (Ad/Soyad ve Oda No) konaklayan listemizle eşleşmedi.\n\nLütfen check-in sırasında verdiğiniz bilgileri kontrol edip tekrar yazınız. 🙏\n_(Deneme: ${session.failedAttempts}/3)_`;
                    await ctx.replyWithMarkdown(failMsg);
                    await saveMessageToDashboard(chatId, 'assistant', failMsg);
                }
                return;
            }

            // Bilgi alındı ve doğrulandı, kaydet
            session.name = guestInfo.name;
            session.room = guestInfo.room;
            session.allergies = guestInfo.allergies;
            session.state = 'complete';
            session.failedAttempts = 0; // Başarılı doğrulama, sayacı sıfırla

            if (validation.guest) {
                session.real_first_name = validation.guest.first_name;
                session.last_name = validation.guest.last_name;
                session.checkin_date = validation.guest.checkin_date;
                session.checkout_date = validation.guest.checkout_date;
            }

            console.log(`✅ [DOĞRULANDI] Misafir: ${guestInfo.name}, Oda: ${guestInfo.room}, chatId: ${chatId}`);

            // Alerji Protokolü...
            if (guestInfo.allergies && guestInfo.allergies.toLowerCase() !== 'yok' && guestInfo.allergies.toLowerCase() !== 'none') {
                await alertGuestRelationsAboutAllergy(guestInfo.name, guestInfo.room, guestInfo.allergies);
            }

            // Bekleyen talebi işle
            if (session.pendingAI) {
                const { department, turkishSummary, replyToUser } = session.pendingAI;
                await routeToDepartment(ctx, department, turkishSummary, chatId, guestInfo.name, guestInfo.room);
                
                // MULTILINGUAL CONFIRMATION: "Request forwarded immediately."
                const finalMsg = await generateFinalConfirmation(guestInfo.name, guestInfo.room, replyToUser);
                await ctx.reply(finalMsg);
                await saveMessageToDashboard(chatId, 'assistant', finalMsg);
                session.pendingAI = null;
            }
        } else {
            // Bilgi anlaşılmadı, tekrar sor
            session.failedAttempts++;
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
            await ctx.replyWithMarkdown(`Talebiniz için lütfen resepsiyonumuzu arayın:\n📞 *+90 242 824 00 00*`);
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
            // Misafir zaten tanımlı: AI yanıtını gönder, sonra yönlendir
            await ctx.reply(aiResult.replyToUser);
            await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
            await routeToDepartment(ctx, aiResult.department, aiResult.turkishSummary, chatId, session.name, session.room);
        } else {
            // Misafir bilgisi yok:
            // 1. Önce isim/oda bilgisi iste (Talebi henüz iletmeden önce)
            session.pendingAI = aiResult;
            session.state = 'awaiting_info';
            await askForGuestInfo(ctx);
        }
    } else if (!aiResult.isRequest) {
        // Soru ise direkt AI yanıtını gönder
        await ctx.reply(aiResult.replyToUser);
        await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
        console.log(`🤖 [${chatId}] AI: ${aiResult.replyToUser.substring(0, 80)}...`);
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

    const welcomeMsg = `🌊 *Azure Coast Resort & SPA'ya Hoş Geldiniz!*

Sayın misafirimiz, otelimizdeki konaklamanızı keyifli ve konforlu hale getirmek için buradayız.

Memnuniyetiniz bizim için son derece önemlidir. Herhangi bir sorunuz ya da talebiniz olduğunda lütfen buradan bize bildirin — ekibimiz en kısa sürede ilgilenecektir. 🙏

━━━━━━━━━━━━━━━━━━━━━
🏨 Oda bilgileri ve fiyatlar
🏊 Havuz & plaj saatleri
🍽️ Restoran & bar saatleri
💆 SPA & wellness
🎯 Aktiviteler & animasyon
✈️ Transfer hizmetleri
━━━━━━━━━━━━━━━━━━━━━

Sorunuzu *yazabilir* ya da *sesli mesaj* gönderebilirsiniz! 😊

📞 +90 242 824 00 00
📧 info@azurecoastresort.com`;

    await ctx.replyWithMarkdown(welcomeMsg);
    await saveMessageToDashboard(chatId, 'assistant', welcomeMsg);

    // Otel krokisi / haritasını gönder
    const mapPath = path.resolve(__dirname, 'assets', 'hotel_harita.png');
    if (fs.existsSync(mapPath)) {
        try {
            await ctx.replyWithPhoto(
                { source: fs.createReadStream(mapPath) },
                { caption: '🗺️ *Azure Coast Resort & SPA — Otel Krokisi*\nTesisin genel yerleşim haritası aşağıdadır. İyi tatiller!', parse_mode: 'Markdown' }
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

// ── Botu Başlat ───────────────────────────────────────────────────────
bot.launch().then(() => {
    console.log("🚀 Azure Coast Resort Telegram Botu başlatıldı!");
    console.log(`🏨 Otel: Azure Coast Resort & SPA`);
    console.log(`🔗 Dashboard API: ${DASHBOARD_API}`);
    console.log(`🤖 AI Model: GPT-4o`);
    console.log(`⏱️  SLA Sistemi: Aktif (60 saniye)`);
    console.log(`👤 Misafir Bilgisi Toplama: Aktif`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

