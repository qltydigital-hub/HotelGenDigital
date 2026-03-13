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
• Açılış: 2018 | Son Renovasyon: 2024
• Toplam Alan: 85.000 m² | Sahil: 350 metre özel kum plaj
• Adres: Beldibi Mah. Atatürk Cad. No:42, Kemer / Antalya
• Telefon: +90 242 824 00 00

ODA TİPLERİ & KAPASİTELER:
• Standart Oda Bahçe: 180 adet, 28m², max 3 kişi
• Standart Oda Deniz: 120 adet, 28m², max 3 kişi
• Superior Oda: 80 adet, 36m², max 3 kişi
• Deluxe Oda: 45 adet, 42m², max 3+1 kişi
• Aile Odası: 35 adet, 55m², max 4+1 kişi
• Junior Suite: 20 adet, 65m², max 4 kişi
• King Suite: 8 adet, 90m², max 4 kişi
• Royal Suite: 2 adet, 140m², max 4+2 kişi
• TOPLAM: 500 oda | 1.200 kişi kapasitesi

ODA ÖZELLİKLERİ (STANDART):
• Bireysel split klima, 55 inç LED Smart TV, ücretsiz minibar (günlük dolum)
• Laptop boyutu kasa, duş+küvet (suite'lerde jakuzi), terlik & bornoz
• Ücretsiz yüksek hızlı Wi-Fi, möbleli balkon

RESTORANLAR & BARLAR:
• Ana Restoran (Lale): Açık büfe, 600 kişi - Yıl boyu
• İtalyan (Bella Vista): A La Carte, 80 kişi - 1 Nis/31 Eki
• Uzak Doğu (Sakura): A La Carte, 60 kişi - 1 May/30 Eyl
• Türk Mutfağı (Saray): A La Carte, 70 kişi - Yıl boyu
• Balık (Fener): A La Carte, 50 kişi - 1 May/30 Eyl
• NOT: A La Carte restoranlar rezervasyon gerektirir, konaklama başına 1 kez ücretsiz

HAVUZLAR:
• Ana Havuz: 1.200m², açık, ısıtmalı - 1 Nis/31 Eki (08:00-19:00)
• Kapalı Havuz: 400m², yıl boyu, 27°C sabit (08:00-20:00)
• Çocuk Havuzu: 300m², derinlik 40-80cm - 15 Nis/15 Eki
• Aquapark: 2.000m², 5 kaydırak - 1 May/30 Eyl
• Relax Havuz (18+): 200m², sessiz alan - 1 May/30 Eyl

SPA & WELLNESS:
• Türk Hamamı: Ücretsiz | Sauna & Buhar Odası: Ücretsiz
• Fitness: Ücretsiz (yaz sezonu 24 saat)
• Masaj: Ücretli (Bali 70€, Thai 85€, Hot Stone 80€, Çift masaj 130€)

AKTİVİTELER (ÜCRETSİZ):
• Plaj voleybolu, su topu, tenis (2 kort), mini golf, okçuluk
• Mini Club 4-12 yaş, Teens Club, gündüz animasyon, gece şovları (21:30)

GENEL KURALLAR:
• Check-in: 14:00 | Check-out: 12:00
• Evcil hayvan kabul edilmez
• Odalarda ve kapalı alanlarda sigara yasak

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FİYAT & KAMPANYA TABLOSU (2025 Sezonu - EUR, kişi başı/gece)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SEZONLAR:
• Düşük Sezon: 1 Oca-31 Mar, 1 Kas-31 Ara
• Orta Sezon: 1 Nis-31 May, 16 Eyl-31 Eki
• Yüksek Sezon: 1 Haz-15 Tem, 1-15 Eyl
• Pik Sezon: 16 Tem-31 Ağu, Bayram dönemleri

ODA FİYATLARI (EUR/kişi/gece):
• Standart Bahçe: Düşük 55€ | Orta 85€ | Yüksek 130€ | Pik 165€
• Standart Deniz: Düşük 70€ | Orta 100€ | Yüksek 150€ | Pik 190€
• Superior: Düşük 90€ | Orta 125€ | Yüksek 180€ | Pik 230€
• Deluxe: Düşük 120€ | Orta 160€ | Yüksek 220€ | Pik 280€
• Aile Odası: Düşük 100€ | Orta 140€ | Yüksek 195€ | Pik 250€
• Junior Suite: Düşük 150€ | Orta 200€ | Yüksek 280€ | Pik 350€
• King Suite: Düşük 220€ | Orta 300€ | Yüksek 420€ | Pik 520€
• Royal Suite: Düşük 400€ | Orta 550€ | Yüksek 750€ | Pik 950€

ÇOCUK POLİTİKASI:
• 0-2 yaş: Ücretsiz | 3-6 yaş: %75 indirim | 7-12 yaş: %50 indirim | 13-17 yaş: %25 indirim

İPTAL POLİTİKASI:
• 30+ gün önce: Ücretsiz | 15-30 gün: %25 kesinti | 7-15 gün: %50 kesinti | 0-7 gün: %100 kesinti

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PERİYODİK & SEZONLUK BİLGİ
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ANA RESTORAN SAATLER:
• Kahvaltı: Yaz 07:00-10:30 | Kış 07:30-10:00
• Öğle: Yaz 12:00-14:30 | Kış 12:30-14:00
• Akşam: Yaz 19:00-22:00 | Kış 19:00-21:00

BAR SAATLER:
• Lobby Bar: 10:00-23:00 (Yaz 00:00'ye kadar), yıl boyu
• Havuz Bar: Mayıs-Eylül 10:00-18:00
• Disco Bar: Haziran-Eylül 23:00-03:00

YANIT KURALLARI:
• Türkçe sorulara Türkçe, İngilizce sorulara İngilizce cevap ver
• Kısa, net ve sıcak bir dil kullan
• Belirsizlik varsa "+90 242 824 00 00" yönlendir
• Misafir otel haritası veya krokisi isterse: "Otel haritamızı /harita yazarak alabilirsiniz." de
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

EK GÖREVİN:
Sana gelen mesajları dikkatle incele ve JSON formatında geri dönüş yap.
1) Gelen mesaj sadece bilgi amaçlı bir "Soru" ise (restoran saati, fiyatlar, havuz bilgisi vb.):
   - "isRequest": false
   - "replyToUser": Müşteriye uygun dildeki detaylı yanıt.
2) Gelen mesaj bir "İstek, Şikayet veya Fiziksel Görev" ise (yastık, klima arızası, temizlik, yiyecek-içecek vb.):
   - "isRequest": true
   - "department": "HOUSEKEEPING" | "TEKNIK" | "RESEPSIYON" | "F&B"
     (yastık/havlu/temizlik->HOUSEKEEPING; bozuk/arızalı/klima->TEKNIK; sipariş/içecek/yemek->F&B; diğer->RESEPSIYON)
   - "turkishSummary": Kısa, net Türkçe görev tanımı. (Örn: "Misafir ekstra yastık istiyor.")
   - "replyToUser": Talebinin alındığını bildiren, müşterinin dilindeki kısa profesyonel yanıt.

ÖNEMLİ: Yalnızca JSON objesi döndür! Markdown kulllanma.`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: userText }
            ],
            response_format: { type: "json_object" },
            max_tokens: 800,
            temperature: 0.7
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
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: 'Kullanıcının mesajından ad, soyad ve oda numarasını çıkar. Sadece JSON döndür: {"name": "Ad Soyad", "room": "Oda No"}. Bulanamazsa null döndür.'
            }, {
                role: 'user',
                content: text
            }],
            response_format: { type: "json_object" },
            max_tokens: 100
        });
        const result = JSON.parse(response.choices[0].message.content);
        if (result.name && result.room) return result;
        return null;
    } catch (e) {
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

    // Eğer veritabanında o departmana atanmış kimse yoksa Fallback (Yedek/Test) Modu
    if (targetPersonnel.length === 0) {
        console.warn(`⚠️ [SLA UYARI] ${department} için aktif yetkili bulunamadı! Yedek (Test) moduna geçiliyor.`);
        const fallbackId = (platform === 'Telegram' || !platform) ? String(guestChatId) : "758605940";
        targetPersonnel = [{ full_name: 'Test Yöneticisi', platform: 'TELEGRAM', contact_id: fallbackId }];
        isMock = true;
    }

    const ticketId = `HTL-${Math.floor(Math.random() * 10000)}`;
    const taskMessage = `🔔 *YENİ GÖREV BİLDİRİMİ*
🏢 *Departman:* ${department}
👤 *Misafir:* ${guestName}
🚪 *Oda No:* ${guestRoom}
📝 *Talep:* ${turkishSummary}
⏰ *Yanıt süresi:* 1 Dakika
${isMock ? '\n_(Test modu: Veritabanında atalı yetkili eksik olduğu için varsayılan adrese gönderildi.)_' : ''}`;

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
                            Markup.button.callback('👍 İlgileniyorum', `ack_${ticketId}`),
                            Markup.button.callback('✅ Tamamlandı', `done_${ticketId}`)
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

        // 5. SLA ZAMANLAYICISINI (1 Dakika) BAŞLAT
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
                    await dbUpsertTicket({ ticket_id: ticketId, status: 'ESCALATED', escalated_at: escalatedAt });
                    await dbLogEvent(ticketId, 'ESCALATED', 'system', `${department} 1 dk içinde yanıt vermedi.`);

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

                    const escalationMsg = `🚨 *ACİL ESKALASYON*
🏢 *Yanıtsız Departman:* ${department}
👤 *Misafir:* ${guestName} | 🚪 *Oda:* ${guestRoom}
📝 *Talep:* ${turkishSummary}

⏰ _${department} departmanı belirlenen süre içinde yanıt VERMEDİ._
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
                        `SLA Eskalasyon: ${ticketId} - ${guestName} (Oda ${guestRoom}) talebi cevapsız kaldı, resepsiyona aktarıldı.`, 'SLA_BOT');
                    // Misafire panik mesajı GİTMEZ.
                }
            }, 60000) // 1 Dakika
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

Lütfen *adınız soyadınız* ve *oda numaranızı* paylaşır mısınız?

_(Örnek: Ahmet Yılmaz, Oda 305)_`;
    await ctx.replyWithMarkdown(msg);
}

// ── Misafir bilgisi tamamlandıktan sonra kişisel ve sıcak kapanış mesajı ───────
async function generateFinalConfirmation(guestName, guestRoom, langRef) {
    if (!openai) {
        return `✅ Teşekkürler ${guestName}! Talebiniz ilgili departmana iletildi.`;
    }
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'system',
                content: `Sen bir 5 yıldızlı otel asistanısın. Aşağıdaki referans metinden misafirin dilini algıla ve TAM O DİLDE yaz. Misafirin adını ve oda numarasını kullanarak sıcak, kişisel, kısa (2 cümle max) bir onay mesajı üret. Mesaj şunu İÇERMELI: talebinin alındığı, ilgili departmanın anında haberdar edildiği ve kendisiyle ilgilenileceği. Emoji kullanabilirsin. Markdown kullanma.`
            }, {
                role: 'user',
                content: `Misafir adı: ${guestName}, Oda: ${guestRoom}. Dil referansı: "${langRef}"`
            }],
            max_tokens: 120,
            temperature: 0.8
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
        await dbUpsertTicket({ ticket_id: ticketId, reception_note: userText });
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
            // Bilgi alındı, kaydet
            session.name = guestInfo.name;
            session.room = guestInfo.room;
            session.state = 'complete';

            console.log(`✅ Misafir bilgisi alındı: ${guestInfo.name}, Oda: ${guestInfo.room}`);

            // Bekleyen talebi işle + kişisel kapanış mesajı gönder
            if (session.pendingAI) {
                const { department, turkishSummary, replyToUser } = session.pendingAI;
                // Departmana sessizce yönlendir
                await routeToDepartment(ctx, department, turkishSummary, chatId, guestInfo.name, guestInfo.room);
                // Misafire: kendi dilinde sıcak ve kişisel kapanış mesajı
                const finalMsg = await generateFinalConfirmation(guestInfo.name, guestInfo.room, replyToUser);
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
            // 1. HEMEN kendi dilinde "ilgileniyoruz" gönder
            await ctx.reply(aiResult.replyToUser);
            await saveMessageToDashboard(chatId, 'assistant', aiResult.replyToUser);
            // 2. Ardından isim/oda bilgisi iste
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
            status: 'ACKED',
            acked_at: ackedAt,
            acked_by: user,
            response_time_sec: responseTimeSec
        });
        await dbLogEvent(ticketId, 'ACKED', user, `Yanıt süresi: ${responseTimeSec ?? '?'} saniye`);

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(
            `${oldMsg}\n\n👷‍♂️ *Üstlenen:* ${user} (İşleme Alındı)`,
            { parse_mode: 'Markdown' }
        );

        await saveMessageToDashboard(tk.guestChatId, 'system',
            `${ticketId} numaralı talep (${tk.guestName}, Oda ${tk.guestRoom}) ${user} tarafından işleme alındı. Yanıt süresi: ${responseTimeSec}sn`, 'SLA_BOT');
    } else {
        await ctx.answerCbQuery('Talep bulunamadı veya süresi dolmuş olabilir.', { show_alert: true });
    }
});

bot.action(/done_(.+)/, async (ctx) => {
    const ticketId = ctx.match[1];
    const user = ctx.from.first_name || "Personel";

    if (pendingTickets[ticketId]) {
        clearTimeout(pendingTickets[ticketId].timer);
        pendingTickets[ticketId].status = 'resolved';

        const tk = pendingTickets[ticketId];
        const resolvedAt = new Date().toISOString();
        const resolutionTimeSec = tk.createdAt
            ? Math.round((new Date(resolvedAt) - new Date(tk.createdAt)) / 1000)
            : null;

        // Supabase güncelle
        await dbUpsertTicket({
            ticket_id: ticketId,
            status: 'RESOLVED',
            resolved_at: resolvedAt,
            resolved_by: user,
            resolution_time_sec: resolutionTimeSec
        });
        await dbLogEvent(ticketId, 'RESOLVED', user, `Toplam çözüm süresi: ${resolutionTimeSec ?? '?'} saniye`);

        const oldMsg = ctx.callbackQuery.message.text;
        await ctx.editMessageText(`${oldMsg}\n\n✅ *TAMAMLANDI:* ${user}`, { parse_mode: 'Markdown' });
        await ctx.answerCbQuery('Görev tamamlandı olarak işaretlendi!');

        if (tk.platform === 'Telegram' || !tk.platform) {
            try {
                await bot.telegram.sendMessage(tk.guestChatId,
                    `✅ Talebiniz (${ticketId}) otel personelimiz tarafından tamamlanmıştır. İyi tatiller, ${tk.guestName}! 😊`);
            } catch (e) { }
        }

        await saveMessageToDashboard(tk.guestChatId, 'system',
            `${ticketId} başarıyla kapatıldı. Çözüm süresi: ${resolutionTimeSec}sn (${tk.guestName}, Oda ${tk.guestRoom})`, 'SLA_BOT');
    } else {
        await ctx.answerCbQuery('Talep bulunamadı.', { show_alert: true });
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

        // 3. İstek ise departmana yönlendir ve SLA sürecini başlat
        if (aiResult.isRequest && aiResult.department) {
            // routeToDepartment (ctx=null gönderip platform='instagram' ekliyoruz)
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

