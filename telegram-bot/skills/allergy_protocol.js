/**
 * SKILL 3: Alerji Güvenlik Protokolü (Genişletilmiş)
 * ─────────────────────────────────────────────────────────
 * Misafirin beyan ettiği alerji bilgisini:
 *   1. Guest Relations departmanına
 *   2. F&B departmanına
 *   3. Resepsiyona (bilgi kopyası)
 *   4. Mutfak personeline (kitchen_staff tablosundan)
 * ACİL bildirim olarak iletir.
 * 
 * Genişletilmiş guest_allergy_records tablosuna kayıt oluşturur.
 * Check-in/check-out tarihlerini in_house_guests ile cross-reference yapar.
 *
 * Kullanım:
 *   const { createAllergyProtocol } = require('./skills/allergy_protocol');
 *   const alertGuestRelationsAboutAllergy = createAllergyProtocol(bot, supabase, config);
 *   await alertGuestRelationsAboutAllergy('Ali Yılmaz', '305', 'Fıstık alerjisi', chatId);
 */

const fs = require('fs');
const path = require('path');

/**
 * Alerji protokolü factory — bot, supabase ve config inject ederek
 * bağımsız bir bildirim fonksiyonu üretir.
 * 
 * @param {object} bot - Telegraf bot instance
 * @param {object|null} supabase - Supabase client instance
 * @param {object} config - telegram_config.json içeriği
 * @returns {Function} alertGuestRelationsAboutAllergy fonksiyonu
 */
function createAllergyProtocol(bot, supabase, config) {

    /**
     * Alerji bildirimini ilgili departmanlara ve mutfak personeline iletir.
     * 
     * @param {string} guestName - Misafir adı soyadı
     * @param {string} roomNo - Oda numarası
     * @param {string} allergyInfo - Alerji detayı
     * @param {string|null} guestChatId - Misafirin Telegram chat ID'si (opsiyonel)
     */
    return async function alertGuestRelationsAboutAllergy(guestName, roomNo, allergyInfo, guestChatId = null) {
        const timestamp = new Date().toLocaleString('tr-TR', {
            timeZone: 'Europe/Istanbul',
            dateStyle: 'short',
            timeStyle: 'short'
        });

        const notifiedDepartments = [];

        // ACİL alerji bildirim mesajı
        const alertMsg = `🚨 *ACİL — ALERJİ BİLDİRİMİ*

👤 *Misafir:* ${guestName}
🚪 *Oda:* ${roomNo}
⚠️ *Alerji:* ${allergyInfo}

📅 *Bildirim Zamanı:* ${timestamp}

_Bu bilgi misafirin kendi beyanıdır._
_Tüm yiyecek-içecek hazırlıklarında bu alerji dikkate alınmalıdır._
_Detay için misafirle iletişime geçiniz._`;

        // 1. Guest Relations grubuna gönder
        const grDept = config.departments?.GUEST_RELATIONS;
        if (grDept && grDept.active && grDept.chatIds?.length > 0) {
            for (const chatId of grDept.chatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, alertMsg, { parse_mode: 'Markdown' });
                    console.log(`🚨 [ALERJİ] Guest Relations'a bildirim gönderildi → ${chatId}`);
                    notifiedDepartments.push('GUEST_RELATIONS');
                } catch (e) {
                    console.error(`[ALERJİ] GR mesaj hatası (${chatId}):`, e.message);
                }
            }
        }

        // 2. F&B grubuna da gönder (yemek hazırlığı için kritik)
        const fbDept = config.departments?.['F&B'];
        if (fbDept && fbDept.active && fbDept.chatIds?.length > 0) {
            for (const chatId of fbDept.chatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, alertMsg, { parse_mode: 'Markdown' });
                    console.log(`🚨 [ALERJİ] F&B'ye bildirim gönderildi → ${chatId}`);
                    notifiedDepartments.push('F&B');
                } catch (e) {
                    console.error(`[ALERJİ] F&B mesaj hatası (${chatId}):`, e.message);
                }
            }
        }

        // 3. Resepsiyona bilgi kopyası
        const rsDept = config.departments?.RESEPSIYON;
        if (rsDept && rsDept.active && rsDept.chatIds?.length > 0) {
            const infoMsg = `📋 *BİLGİ — Alerji Kaydı*\n👤 ${guestName} | 🚪 Oda ${roomNo}\n⚠️ ${allergyInfo}\n_GR, F&B ve Mutfak departmanları bilgilendirildi._`;
            for (const chatId of rsDept.chatIds) {
                try {
                    await bot.telegram.sendMessage(chatId, infoMsg, { parse_mode: 'Markdown' });
                    notifiedDepartments.push('RESEPSIYON');
                } catch (e) {
                    // Resepsiyon kopyası kritik değil, sessizce devam
                }
            }
        }

        // 4. MUTFAK PERSONELİNE BİLDİRİM (kitchen_staff tablosundan)
        if (supabase) {
            try {
                const { data: kitchenStaff, error: ksError } = await supabase
                    .from('kitchen_staff')
                    .select('*')
                    .eq('is_active', true)
                    .order('notification_priority', { ascending: false });

                if (!ksError && kitchenStaff && kitchenStaff.length > 0) {
                    const kitchenMsg = `🍳 *MUTFAK — ALERJİ UYARISI*

👤 *Misafir:* ${guestName}
🚪 *Oda:* ${roomNo}
⚠️ *Alerji:* ${allergyInfo}
📅 *Tarih:* ${timestamp}

❗ *Bu misafirin tüm yemek siparişlerinde bu alerjen maddelere dikkat ediniz.*
_Beyan kaynağı: Misafir (Telegram üzerinden)_`;

                    for (const staff of kitchenStaff) {
                        if (staff.telegram_chat_id) {
                            try {
                                await bot.telegram.sendMessage(staff.telegram_chat_id, kitchenMsg, { parse_mode: 'Markdown' });
                                console.log(`🍳 [ALERJİ] Mutfak personeline bildirim → ${staff.full_name} (${staff.role})`);
                                notifiedDepartments.push(`MUTFAK_${staff.role.toUpperCase()}`);
                            } catch (e) {
                                console.error(`[ALERJİ] Mutfak bildirim hatası (${staff.full_name}):`, e.message);
                            }
                        }
                    }
                } else {
                    console.warn('⚠️ [ALERJİ] kitchen_staff tablosunda aktif personel bulunamadı veya tablo mevcut değil.');
                }
            } catch (e) {
                console.warn('⚠️ [ALERJİ] Mutfak personeli sorgusu başarısız:', e.message);
            }
        }

        // 5. GENİŞLETİLMİŞ SUPABASE KAYDI (guest_allergy_records)
        if (supabase) {
            // In-house bilgilerini cross-reference et
            let checkinDate = null;
            let checkoutDate = null;
            try {
                const { data: guestData } = await supabase
                    .from('in_house_guests')
                    .select('checkin_date, checkout_date')
                    .eq('room_number', String(roomNo))
                    .ilike('first_name', `%${guestName.split(' ')[0]}%`)
                    .limit(1)
                    .single();
                if (guestData) {
                    checkinDate = guestData.checkin_date;
                    checkoutDate = guestData.checkout_date;
                }
            } catch (e) {
                // Cross-reference başarısız, kritik değil
            }

            // Genişletilmiş tabloya kaydet
            try {
                await supabase.from('guest_allergy_records').upsert({
                    guest_name: guestName,
                    room_number: String(roomNo),
                    allergy_info: allergyInfo,
                    checkin_date: checkinDate,
                    checkout_date: checkoutDate,
                    telegram_chat_id: guestChatId ? String(guestChatId) : null,
                    notified_departments: [...new Set(notifiedDepartments)],
                    status: 'ACTIVE',
                    reported_at: new Date().toISOString()
                }, { onConflict: 'guest_name,room_number,allergy_info' });
                console.log(`✅ [ALERJİ] guest_allergy_records'a kaydedildi: ${guestName} / Oda ${roomNo}`);
            } catch (e) {
                // Yeni tablo yoksa eski tabloya yaz (fallback)
                try {
                    await supabase.from('guest_allergies').upsert({
                        guest_name: guestName,
                        room_no: String(roomNo),
                        allergy_details: allergyInfo,
                        reported_at: new Date().toISOString(),
                        status: 'ACTIVE'
                    }, { onConflict: 'guest_name,room_no' });
                    console.log(`✅ [ALERJİ] Fallback: guest_allergies'e kaydedildi.`);
                } catch (fallbackErr) {
                    console.warn(`⚠️ [ALERJİ] Tüm DB kayıtları başarısız:`, fallbackErr.message);
                }
            }

            // Bildirim loglarını kaydet
            try {
                const logEntries = notifiedDepartments.map(dept => ({
                    notified_to: dept,
                    notification_type: 'TELEGRAM',
                    status: 'SENT',
                    sent_at: new Date().toISOString()
                }));
                if (logEntries.length > 0) {
                    // allergy_record_id ile ilişkilendirmek için önce kaydı bul
                    const { data: recordData } = await supabase
                        .from('guest_allergy_records')
                        .select('id')
                        .eq('guest_name', guestName)
                        .eq('room_number', String(roomNo))
                        .limit(1)
                        .single();
                    if (recordData) {
                        const logsWithId = logEntries.map(l => ({ ...l, allergy_record_id: recordData.id }));
                        await supabase.from('allergy_notification_logs').insert(logsWithId);
                    }
                }
            } catch (e) {
                // Log kaydı kritik değil
            }
        }

        console.log(`🚨 [ALERJİ PROTOKOLÜ TAMAMLANDI] ${guestName} (Oda ${roomNo}): ${allergyInfo}`);
        console.log(`   ↳ Bildirilen departmanlar: ${[...new Set(notifiedDepartments)].join(', ') || 'Hiçbiri'}`);
    };
}

module.exports = { createAllergyProtocol };
