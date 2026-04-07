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

// Misafir oturum bilgileri: chatId -> { name, room, state, pendingAI }
// state: 'complete' | 'awaiting_info'
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

// ── OTEL KNOWLEDGE BASE ────────────────────────────────────────────────────────
const HOTEL_KNOWLEDGE = `
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
• Rezervasyon Önceliği: Önce otel üzerinden direkt rezervasyon. Müşteri otel üzerinden yapmak isterse veya websitemizi değerlendirirse, Front Office'in yüklediği banka IBAN bilgilerini müşteriyle paylaşarak direkt seçenek sun:
  - Alıcı: Azure Coast Otel İşletmeleri A.Ş.
  - Banka: Garanti BBVA - Antalya Ticari Şubesi
  - IBAN: TR98 0006 2000 0000 1234 5678 90
• Güven Sorunu/Acenta: Eğer müşteri direkt rezervasyon yapmakta güven sorunu yaşarsa veya bunu hissettirirse o zaman müşteriyi kaybetmemek adına "Çalıştığımız güvenilir acentalarımız da mevcuttur." diyerek acenta alternatiflerini sun.
  - Front Office'in yüklediği acenta linkleri: https://www.etstur.com/Azure-Coast, https://www.jollytur.com/Azure-Coast

REZERVASYON MÜSAİTLİK VE FİYAT:
• Eğer rezervasyon ile ilgili soru geliyorsa ve saatler 09:00 ile 18:00 arasındaysa "Rezervasyon departmanımıza iletiyorum" diyebilirsin ama hemen kapatıp atma.
• Tarih, müsaitlik ve fiyat sorulduğunda dönemsel ücretleri inceleyerek yanıt ver. Eğer otelin kendi sayfasından ileri tarihler için kontrol yapamıyorsan ve müsaitliği garanti edemiyorsan, çok hoş bir üslupla "Bunlar çalıştığımız acentalarımız, size daha uygun olması açısından hemen ileriki tarihler için rezervasyonunuzu yapıp avantajlardan yararlanabilirsiniz" diyerek acenta adreslerini yönlendir. Acenta ve otel temsilcisinin irtibat bilgilerini istenirse memnuniyetle ver.

BÖLGESEL BİLGİLER (PERPLEXITY PROTOCOL):
• Eğer "Dışarıda yemek yenecek güzel bir yer var mı?", "Buralarda gezilecek yer nereler?", "En yakın hastane nerede?" gibi otel dışı ama bölge ile alakalı bir soru gelirse, bir Perplexity/detaylı arama motoru gibi hareket et! Bildiğin en iyi, detaylı bilgileri dök. O mekanın neyi meşhur, özellikleri neler ve lokasyonuyla/konumuyla beraber çok iyi bir açıklama ile ilet. Müşteri memnuniyetini zirvede tut.

YAZIM HATALARI, ANLAMA VE TALEP OLUŞTURMA:
• "istiyorum" yerine "isiyorım", "yastık" yerine "yaztık" gibi yazım ve klavye otomatik düzeltme hatalarına karşı çok dikkatli ol. Bunları doğru analiz et. Eğer anlamak için yeterli açıklık varsa, TEKRAR ONAY İSTEMEDEN doğrudan cevabını verip talebi oluştur ("hemen gönderiyoruz" gibi).
• ODA SERVİSİ/HİZMET TALEPLERİ (ÇOK ÖNEMLİ): Eğer müşteri "Odama bir yastık daha istiyorum" vs yazmışsa bu bir GÖREV ve İSTEKTİR. Mutlaka bir sistemsel request dönmelisin ki (JSON içinde isRequest: true), sistem müşteriye Ad-Soyad-Oda no sorabilsin. Yoksa havaya onay vermiş olursun, sistem çalışmaz. Eğer müşteri odasını/ismini söylememişse sadece talebi doğrula ve JSON "isRequest": true ver!

ODA TİPLERİ VE DİĞER BİLGİLER... 
• Standart Oda Bahçe: 180 adet, 28m², max 3 kişi
`;

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
async function processMessageWithAI(userText) {
    if (!openai) {
        return { replyToUser: "⚙️ OpenAI API anahtarı tanımlı değil.", isRequest: false };
    }

    const SYSTEM_PROMPT = `Sen Azure Coast Resort & SPA'nın akıllı misafir asistanısın.

===== OTEL BİLGİLERİ =====
${HOTEL_KNOWLEDGE}
==========================

!!! ÖNEMLİ KURALLAR - KESİNLİKLE UY !!!
1) REZERVASYON: Önce Front Office banka IBAN'ı ile direkt rezervasyonu yap. Yalnızca müşteri güvensiz veya acenta isterse Front Office acenta linklerini (ETS/Jolly vb.) paylaş. Müsaitlik bulamazsan "size daha uygun olması açısından güvenilir acentalarımızla rezervasyon yapabilirsiniz" diyip acenta linklerini gönder.
2) BÖLGESEL BİLGİ: Otel çevresi gezilecek yer vb sorulduğunda adeta bir detaylı arama motoru gibi konumlarıyla beraber muazzam detayda sun.
3) YAZIM HATALARI: "yaztık" vs gibi klavye hatalarını doğru anla. Teyit etmeden doğrudan onay ver.
4) ASLA İSİM UYDURMA VE SEN SORMA: Karşıdaki kişinin adını BİLMİYORSUN. Yanıtlarında ASLA isim uydurma! Yalnızca "Sayın Misafirimiz" de.
5) TALEPLER (ÇOK KRİTİK): Müşteri (oda numarası belirtmese bile) "yastık", "havlu", "su istiyorum" gibi odaya fiziksel bir şey isterse, sen SADECE "isRequest": true ve departman JSON verisini dön! SEN MÜŞTERİYE "ODA NUMARANIZ NEDİR?" DİYE SORU SORMAYACAKSIN. Bırak onu yazılım sistemi otomatik halletsin. Sen sadece talebi anla, "isRequest": true işaretle ve "İlgili birime iletiyorum" de. Başka hiçbir şeyi dert etme! Eğet false yaparsan yazılım bu işi algılayamaz ve otel işlemez.

EK GÖREVİN JSON ŞABLONU:
Gelen mesajı incele ve ŞU JSON'U dön:
1) Gelen mesaj bir "İstek, Sipariş veya Görev" ise (müşteri ismini bilmesen bile):
   - "isRequest": true
   - "department": "HOUSEKEEPING" | "TEKNIK" | "RESEPSIYON" | "F&B" | "GUEST_RELATIONS"
   - "turkishSummary": Kısa, net Türkçe görev tanımı.
   - "replyToUser": Talebin alındığını bildiren kısa onay mesajı ("Hemen ilgili departmana iletiyorum" vb.)
2) Gelen mesaj sadece bilgi amaçlı bir "Soru" ise (restoran saati, lokal bilgiler, rezervasyon vb.):
   - "isRequest": false
   - "replyToUser": Müşteriye uygun dildeki detaylı yanıt.

ÖNEMLİ: Yalnızca JSON objesi döndür! Markdown kullanma.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userText }
            ],
            response_format: { type: "json_object" },
            max_tokens: 800,
            temperature: 0.1 // Kurumsal kullanım için yaratıcılık (halüsinasyon) minimuma indirildi
        });
        return JSON.parse(response.choices[0].message.content);
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
                content: 'Kullanıcının mesajından ad, soyad, oda numarası ve varsa alerji/özel diyet bilgisini çıkar. EĞER cümlede kişinin adı veya oda numarası açıkça geçmiyorsa ASLA SAKIN İSİM VEYA RAKAM UYDURMA, o alanlara null döndür. Sadece JSON döndür: {"name": "Ad Soyad veya null", "room": "Oda No veya null", "allergies": "Alerji bilgisi veya null"}. Eğer emin değilsen değerlere null ver.'
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
async function askForGuestInfo(ctx) {
    const msg = `Talebinizi iletebilmem için birkaç bilgiye ihtiyacım var 🙏

1️⃣ *Adınız Soyadınız*
2️⃣ *Oda Numaranız*
3️⃣ *Varsa Alerji veya Özel Diyet İhtiyacınız* (Yoksa "Yok" yazabilirsiniz)

_ (Örnek: Ahmet Yılmaz, Oda 305, Alerjim yok )_`;
    await ctx.replyWithMarkdown(msg);
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
        guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null };
    }
    const session = guestSessions[chatId];

    await saveMessageToDashboard(chatId, 'user', userText);

    // ── DURUM: Misafir bilgisi bekleniyor ──────────────────────────────
    if (session.state === 'awaiting_info') {
        await ctx.sendChatAction('typing');

        const guestInfo = await extractGuestInfo(userText);

        if (guestInfo && guestInfo.name && guestInfo.room) {
            // In-House Doğrulaması
            const validation = await validateGuestInHouse(guestInfo.name, guestInfo.room);
            
            if (!validation.valid) {
                const failMsg = `⚠️ Üzgünüm, oda bilgileriniz (Ad/Soyad ve Oda No) konaklayan listemizle eşleşmedi. Lütfen bilgilerinizi kontrol edip tekrar yazınız. 🙏`;
                await ctx.reply(failMsg);
                return;
            }

            // Bilgi alındı ve doğrulandı, kaydet
            session.name = guestInfo.name;
            session.room = guestInfo.room;
            session.allergies = guestInfo.allergies;
            session.state = 'complete';

            console.log(`✅ Misafir doğrulandı: ${guestInfo.name}, Room: ${guestInfo.room}`);

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
                // Prompt template ensures it's in guest's language.
                await ctx.reply(finalMsg);
                await saveMessageToDashboard(chatId, 'assistant', finalMsg);
                session.pendingAI = null;
            }
        } else {
            // Bilgi anlaşılmadı, tekrar sor
            const retryMsg = `Üzgünüm, bilgileri anlayamadım 😊 Lütfen şu formatta yazabilir misiniz?

*Ad Soyad, Oda [numara]*
_(Örnek: Mehmet Kaya, Oda 412)_`;
            await ctx.replyWithMarkdown(retryMsg);
            await saveMessageToDashboard(chatId, 'assistant', retryMsg);
        }
        return;
    }

    // ── NORMAL AKIŞ: AI ile mesajı değerlendir ─────────────────────────
    await ctx.sendChatAction('typing');
    const aiResult = await processMessageWithAI(userText);

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
    // Oturumu sıfırla
    guestSessions[chatId] = { name: null, room: null, state: 'new', pendingAI: null };

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
        const aiResult = await processMessageWithAI(msgText);

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

