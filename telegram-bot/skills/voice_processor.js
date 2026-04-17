/**
 * SKILL 4: Voice Processor — Sesli Mesaj İşleme Motoru
 * ─────────────────────────────────────────────────────────
 * Telegram'dan gelen OGG sesli mesajları MP3 formatına
 * dönüştürür. OpenAI Whisper ile metin çevrimini destekler.
 *
 * Kullanım:
 *   const { convertOggToMp3 } = require('./skills/voice_processor');
 *   await convertOggToMp3('/tmp/input.ogg', '/tmp/output.mp3');
 */

const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');

// ffmpeg binary yolunu ayarla
ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * OGG ses dosyasını MP3 formatına dönüştürür.
 * Promise tabanlı, hata yönetimli wrapper.
 * 
 * @param {string} inputPath - Kaynak OGG dosyası yolu
 * @param {string} outputPath - Hedef MP3 dosyası yolu
 * @returns {Promise<void>} Dönüşüm tamamlandığında resolve olur
 */
function convertOggToMp3(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .toFormat('mp3')
            .audioBitrate('128k')
            .audioChannels(1)       // Mono — konuşma tanıma için yeterli
            .audioFrequency(16000)  // 16kHz — Whisper için optimal
            .on('start', (cmd) => {
                console.log(`🎵 [VOICE] ffmpeg başlatıldı: ${cmd.substring(0, 120)}...`);
            })
            .on('error', (err) => {
                console.error(`❌ [VOICE] ffmpeg dönüşüm hatası:`, err.message);
                reject(err);
            })
            .on('end', () => {
                console.log(`✅ [VOICE] Dönüşüm tamamlandı: ${outputPath}`);
                resolve();
            })
            .save(outputPath);
    });
}

module.exports = { convertOggToMp3 };
