require('dotenv').config();
const { Telegraf } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

ffmpeg.setFfmpegPath(ffmpegPath);

// ══════════════════════════════════════════════════════════════════
//  AZURE COAST RESORT — Yönetici Rapor Botu
// ══════════════════════════════════════════════════════════════════

const REPORT_BOT_TOKEN = process.env.REPORT_BOT_TOKEN;
if (!REPORT_BOT_TOKEN) {
    console.error('❌ REPORT_BOT_TOKEN .env dosyasında tanımlı değil!');
    process.exit(1);
}

// Yetkili yönetici Telegram ID'leri (virgülle ayrılmış)
const AUTHORIZED_IDS = (process.env.REPORT_AUTHORIZED_IDS || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

const bot = new Telegraf(REPORT_BOT_TOKEN);

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const botToken = REPORT_BOT_TOKEN;

// ── Yetkili Yönetici Kontrolü ─────────────────────────────────────
// Önce Supabase'den okur (dashboard yönetimi için)
// Supabase'de tablo yoksa veya boşsa .env listesine döner
const ENV_AUTHORIZED_IDS = (process.env.REPORT_AUTHORIZED_IDS || '')
    .split(',').map(id => id.trim()).filter(Boolean);

async function isAuthorized(ctx) {
    const userId = String(ctx.from?.id);

    // 1. Supabase'den kontrol et (dashboard'dan yönetilen liste)
    try {
        const { data, error } = await supabase
            .from('authorized_managers')
            .select('telegram_id')
            .eq('telegram_id', userId)
            .eq('is_active', true)
            .single();

        if (!error && data) return true;  // DB'de varsa yetkili
        if (!error && !data) return false; // DB aktif ama bu ID yok
    } catch (e) {
        // Tablo yoksa .env'e dön (sessizce)
    }

    // 2. .env listesine dön (fallback)
    if (ENV_AUTHORIZED_IDS.length === 0) return true; // Geliştirme modu
    return ENV_AUTHORIZED_IDS.includes(userId);
}

// ── Tarihi Türkçe Formatla (gün.ay.yıl saat:dakika:saniye) ────────
function formatTR(isoStr) {
    if (!isoStr) return 'N/A';
    const d = new Date(isoStr);
    return d.toLocaleString('tr-TR', {
        timeZone: 'Europe/Istanbul',
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
}

// ── Süreyi Okunabilir Formata Çevir ──────────────────────────────
function formatDuration(sec) {
    if (!sec && sec !== 0) return 'N/A';
    if (sec < 60) return `${sec} saniye`;
    if (sec < 3600) return `${Math.round(sec / 60)} dakika`;
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return `${h} saat ${m} dakika`;
}

// ── Doğal Dil → Tarih Aralığı Dönüştür (AI) ──────────────────────
async function parseDateRange(userText) {
    // Türkiye saati: UTC+3
    const nowUTC = new Date();
    const nowTR = new Date(nowUTC.getTime() + (3 * 60 * 60 * 1000));
    const nowStr = nowTR.toISOString().replace('T', ' ').substring(0, 19);

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{
            role: 'system',
            content: `Şu anki Türkiye saati: ${nowStr} (UTC+3)
Kullanıcının tarih/zaman talebini analiz et ve JSON döndür:
{"start": "YYYY-MM-DDTHH:mm:ss+03:00", "end": "YYYY-MM-DDTHH:mm:ss+03:00", "label": "Türkçe açıklama"}

Örnekler:
- "son 7 gün" → bugünden tam 7 gün öncesi ile şu an arası
- "son 24 saat" → 24 saat öncesi ile şu an
- "şubat 1 ile 8 arası" → 2026-02-01T00:00:00+03:00 ile 2026-02-08T23:59:59+03:00
- "bugün" → bugün 00:00:00 ile şu an
- "bu hafta" → Pazartesi 00:00:00 ile şu an
- "geçen ay" → önceki ayın 1. günü ile son günü
- "ocak ayı" → 2026-01-01T00:00:00+03:00 ile 2026-01-31T23:59:59+03:00
- "dün" → dünün 00:00:00 ile 23:59:59

label kısmı kullanıcının talebini Türkçe özetle (örn: "Son 7 gün (26.02.2026 - 04.03.2026)")
Sadece JSON döndür.`
        }, {
            role: 'user',
            content: userText
        }],
        response_format: { type: "json_object" },
        max_tokens: 200,
        temperature: 0.1
    });

    return JSON.parse(response.choices[0].message.content);
}

// ── Supabase'den Rapor Verisi Çek ve Formatla ─────────────────────
async function buildReport(startDate, endDate, label) {
    const { data: tickets, error } = await supabase
        .from('live_tickets')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Supabase hatası: ${error.message}`);
    if (!tickets || tickets.length === 0) {
        return `📊 *RAPOR — ${label}*\n\n❌ Bu dönemde hiç talep kaydı bulunamadı.`;
    }

    const total = tickets.length;
    const resolved = tickets.filter(t => t.status === 'RESOLVED').length;
    const escalated = tickets.filter(t => t.status === 'ESCALATED').length;
    const acked = tickets.filter(t => t.status === 'ACKED').length;
    const open = tickets.filter(t => t.status === 'OPEN').length;
    const slaRate = Math.round(((total - escalated) / total) * 100);

    // Departman bazlı analiz
    const depts = {};
    for (const t of tickets) {
        const d = t.department || 'BELİRSİZ';
        if (!depts[d]) {
            depts[d] = {
                count: 0, resolved: 0, escalated: 0, open: 0,
                respTotal: 0, respCount: 0,
                resolTotal: 0, resolCount: 0,
                ackers: {}
            };
        }
        depts[d].count++;
        if (t.status === 'RESOLVED') depts[d].resolved++;
        if (t.status === 'ESCALATED') depts[d].escalated++;
        if (t.status === 'OPEN') depts[d].open++;
        if (t.response_time_sec) { depts[d].respTotal += t.response_time_sec; depts[d].respCount++; }
        if (t.resolution_time_sec) { depts[d].resolTotal += t.resolution_time_sec; depts[d].resolCount++; }
        if (t.acked_by) depts[d].ackers[t.acked_by] = (depts[d].ackers[t.acked_by] || 0) + 1;
    }

    // En çok talep eden odalar
    const roomCounts = {};
    for (const t of tickets) {
        if (t.room_no) roomCounts[t.room_no] = (roomCounts[t.room_no] || 0) + 1;
    }
    const topRooms = Object.entries(roomCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Rapor metni
    let r = '';
    r += `📊 *YÖNETİCİ PERFORMANS RAPORU*\n`;
    r += `🏨 Azure Coast Resort & SPA\n`;
    r += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    r += `📅 *Dönem:* ${label}\n`;
    r += `🕐 *Rapor Tarihi:* ${formatTR(new Date().toISOString())}\n`;
    r += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

    r += `📋 *GENEL ÖZET*\n`;
    r += `• Toplam Talep: *${total}*\n`;
    r += `• ✅ Tamamlanan: *${resolved}* (%${Math.round(resolved / total * 100)})\n`;
    r += `• 🔄 Devam Eden: *${acked + open}*\n`;
    r += `• 🚨 Eskalasyon: *${escalated}*\n`;
    r += `• 📈 SLA Uyum Oranı: *%${slaRate}*\n\n`;

    r += `🏢 *DEPARTMAN ANALİZİ*\n`;
    const deptEmojis = { HOUSEKEEPING: '🛏️', TEKNIK: '🔧', RESEPSIYON: '🏨', 'F&B': '🍽️', BELİRSİZ: '❓' };
    for (const [dept, s] of Object.entries(depts)) {
        const emoji = deptEmojis[dept] || '🏢';
        const avgResp = s.respCount > 0 ? formatDuration(Math.round(s.respTotal / s.respCount)) : 'N/A';
        const avgResol = s.resolCount > 0 ? formatDuration(Math.round(s.resolTotal / s.resolCount)) : 'N/A';
        const topPersonel = Object.entries(s.ackers).sort((a, b) => b[1] - a[1])[0];
        r += `\n${emoji} *${dept}*\n`;
        r += `  📌 Talep: ${s.count} | ✅ Tamamlanan: ${s.resolved} | 🚨 Eskalasyon: ${s.escalated}\n`;
        r += `  ⏱ Ort. Yanıt: ${avgResp} | ⏱ Ort. Çözüm: ${avgResol}\n`;
        if (topPersonel) r += `  👷 En aktif personel: ${topPersonel[0]} (${topPersonel[1]} talep)\n`;
    }

    if (topRooms.length > 0) {
        r += `\n🚪 *EN FAZLA TALEP EDEN ODALAR*\n`;
        topRooms.forEach(([room, count], i) => {
            r += `  ${i + 1}. Oda ${room}: ${count} talep\n`;
        });
    }

    r += `\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    r += `_Rapor ${formatTR(new Date().toISOString())} tarihinde oluşturuldu._`;

    return r;
}

// ── OGG → MP3 Dönüşümü ───────────────────────────────────────────
function convertOggToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .on('end', () => resolve(outputPath))
            .on('error', reject)
            .save(outputPath);
    });
}

// ── Rapor Alma İşlemi (Text veya Voice'tan gelen metin) ───────────
async function processReportRequest(ctx, userText) {
    const loadMsg = await ctx.reply('🔍 Veriler analiz ediliyor, lütfen bekleyin...');

    try {
        // 1. Tarih aralığını AI ile parse et
        const dateRange = await parseDateRange(userText);
        console.log(`📅 Tarih aralığı: ${dateRange.start} → ${dateRange.end}`);

        // 2. Raporu oluştur
        const report = await buildReport(dateRange.start, dateRange.end, dateRange.label);

        // 3. Yükleme mesajını sil ve raporu gönder
        await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => { });
        await ctx.replyWithMarkdown(report);

    } catch (err) {
        console.error('Rapor hatası:', err.message);
        await ctx.telegram.deleteMessage(ctx.chat.id, loadMsg.message_id).catch(() => { });
        await ctx.reply(`❌ Rapor oluşturulurken hata: ${err.message}`);
    }
}

// ── /start ────────────────────────────────────────────────────────
bot.start(async (ctx) => {
    if (!isAuthorized(ctx)) {
        return ctx.reply('⛔ Bu bota erişim yetkiniz yok. Sistem yöneticinizle iletişime geçin.');
    }

    const name = ctx.from.first_name || 'Yönetici';
    await ctx.replyWithMarkdown(`👋 Hoş geldiniz, *${name}*!

📊 *Azure Coast Resort & SPA — Yönetici Rapor Botu*

Rapor almak için istediğiniz zaman aralığını yazın veya sesli mesaj gönderin:

*Örnekler:*
• _"Son 7 günün raporunu ver"_
• _"Bugünün raporunu istiyorum"_
• _"Şubat 1 ile 8 arası"_
• _"Bu haftanın raporu"_
• _"Ocak ayı performans raporu"_
• _"Dünün istatistiklerini göster"_

Zaman dilimlerinde gün, ay, yıl, saat ve saniye bazında detay alabilirsiniz! 🕐`);
});

// ── /yardim ───────────────────────────────────────────────────────
bot.command('yardim', async (ctx) => {
    if (!isAuthorized(ctx)) return;
    await ctx.replyWithMarkdown(`*📋 Kullanım Rehberi*

*Yazarak rapor:*
• Son 24 saat, son 7 gün, son 30 gün
• Belirli tarihler: "1 Şubat ile 28 Şubat arası"
• Dönemler: "Bu hafta", "Geçen ay", "Bu ay"
• Bugün, dün

*Sesli mesajla rapor:*
Mikrofona konuşun — otomatik metne dönüştürülür.

*Raporda görecekleriniz:*
📋 Genel özet (toplam, tamamlanan, eskalasyon)
🏢 Departman bazlı analiz
⏱ Ortalama yanıt ve çözüm süreleri
👷 En aktif personel
🚪 En fazla talep eden odalar
📈 SLA uyum oranı`);
});

// ── Metin Mesajları ───────────────────────────────────────────────
bot.on('text', async (ctx) => {
    if (!isAuthorized(ctx)) {
        return ctx.reply('⛔ Yetkisiz erişim.');
    }
    const text = ctx.message.text;
    console.log(`📨 [Rapor Bot] ${ctx.from.first_name}: ${text}`);
    await processReportRequest(ctx, text);
});

// ── Sesli Mesajlar ────────────────────────────────────────────────
bot.on('voice', async (ctx) => {
    if (!isAuthorized(ctx)) {
        return ctx.reply('⛔ Yetkisiz erişim.');
    }

    try {
        const loadMsg = await ctx.reply('🎤 Ses mesajı analiz ediliyor...');
        const fileId = ctx.message.voice.file_id;
        const file = await ctx.telegram.getFile(fileId);
        const fileUrl = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

        const response = await axios({ method: 'GET', url: fileUrl, responseType: 'stream' });

        const tempOgg = path.resolve(__dirname, `report_${fileId}.ogg`);
        const tempMp3 = path.resolve(__dirname, `report_${fileId}.mp3`);

        const writer = fs.createWriteStream(tempOgg);
        response.data.pipe(writer);
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        await convertOggToMp3(tempOgg, tempMp3);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempMp3),
            model: 'whisper-1'
        });

        const transcribedText = transcription.text;
        console.log(`🎤 [Rapor Bot] Çevrilen metin: ${transcribedText}`);

        await ctx.telegram.editMessageText(
            ctx.chat.id, loadMsg.message_id, undefined,
            `🎤 *Duyduğum:* "${transcribedText}"\n\n🔍 Rapor hazırlanıyor...`,
            { parse_mode: 'Markdown' }
        );

        if (fs.existsSync(tempOgg)) fs.unlinkSync(tempOgg);
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);

        await processReportRequest(ctx, transcribedText);

    } catch (err) {
        console.error('Sesli rapor hatası:', err);
        await ctx.reply('❌ Ses mesajı işlenirken hata oluştu. Lütfen yazılı olarak deneyin.');
    }
});

// ── Başlat ────────────────────────────────────────────────────────
bot.launch().then(() => {
    console.log('📊 Azure Coast Resort — Yönetici Rapor Botu başlatıldı!');
    console.log(`👥 Yetkili yöneticiler: ${AUTHORIZED_IDS.length > 0 ? AUTHORIZED_IDS.join(', ') : 'Herkese Açık (Geliştirme Modu)'}`);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
