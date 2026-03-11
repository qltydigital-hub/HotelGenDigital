import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';
import * as xlsx from 'xlsx';

// Excel dosyası column eşleştirme tipleri
interface ExcelRow {
    [key: string]: any;
}

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'Lütfen bir Excel dosyası seçin.' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Excel dosyasını oku
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // JSON formatına çevir
        const rawData = xlsx.utils.sheet_to_json<ExcelRow>(sheet, { defval: '' });

        if (rawData.length === 0) {
            return NextResponse.json({ error: 'Excel dosyası boş.' }, { status: 400 });
        }

        const client = getServiceSupabase();

        // 1. Önce eski kayıtları temizleyelim (tüm konaklayanları sıfırlayıp yenilerini ekliyoruz)
        // Eğer ileride birden fazla otel (multi-tenant) olursa, buraya .eq('hotel_id', currentHotelId) eklenecek.
        const { error: deleteError } = await client
            .from('in_house_guests')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all rows

        if (deleteError) {
            console.error('[API] Eski misafir listesi silinirken hata:', deleteError);
            return NextResponse.json({ error: 'Veritabanı temizleme hatası: ' + deleteError.message }, { status: 500 });
        }

        // 2. Verileri formatlayıp Supabase'e uygun hale getirelim
        const guestsToInsert = rawData.map(row => {
            // Sütun isimleri otelden otele veya sistemden sisteme değişebilir. 
            // Burada olası varyasyonları yakalamaya çalışıyoruz.
            const roomNo = row['Oda No'] || row['Room'] || row['Room Number'] || row['Oda'] || Object.values(row)[0];
            const firstName = row['Ad'] || row['First Name'] || row['Name'] || row['Misafir Adı'] || Object.values(row)[1] || 'Bilinmiyor';
            const lastName = row['Soyad'] || row['Last Name'] || row['Surname'] || row['Misafir Soyadı'] || Object.values(row)[2] || '';
            const checkout = row['Çıkış'] || row['Departure'] || row['Checkout'] || row['C/Out'] || row['Çıkış Tarihi'] || Object.values(row)[3];

            // Excel'deki tarih genelde string gelir veya sayı olabilir (Excel date format)
            // Biz basitçe string olarak alıp Date objesine çevirmeye çalışıyoruz.
            let parsedCheckout = new Date();
            if (typeof checkout === 'number') {
                // Excel tarihi numarası
                parsedCheckout = new Date(Math.round((checkout - 25569) * 86400 * 1000));
            } else if (checkout) {
                // String tarihi ("15.03.2024" gibi formatları düzeltebiliriz)
                const parts = String(checkout).split(/[./-]/);
                if (parts.length === 3) {
                    // dd.mm.yyyy varsayımı
                    if (parts[0].length === 2 && parts[2].length === 4) {
                        parsedCheckout = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                    } else {
                        parsedCheckout = new Date(checkout);
                    }
                } else {
                    parsedCheckout = new Date(checkout);
                }
            } else {
                // Eğer excelde çıkış tarihi yoksa, varsayılan olarak bugüne veya yarına atayabiliriz. (riskli)
                parsedCheckout.setDate(parsedCheckout.getDate() + 1);
            }

            // Eğer geçerli bir tarih değilse bugünü ver.
            if (isNaN(parsedCheckout.getTime())) {
                parsedCheckout = new Date();
                parsedCheckout.setDate(parsedCheckout.getDate() + 1);
            }

            let lang = 'tr';
            const excelLangCode = (row['Dil'] || row['Language'] || row['Nation'] || row['Uyruk'] || '').toString().toLowerCase();
            if (excelLangCode.includes('en') || excelLangCode.includes('uk') || excelLangCode.includes('us')) lang = 'en';
            if (excelLangCode.includes('ru')) lang = 'ru';
            if (excelLangCode.includes('de')) lang = 'de';
            if (excelLangCode.includes('ar')) lang = 'ar';

            return {
                room_number: String(roomNo).trim(),
                first_name: String(firstName).trim(),
                last_name: String(lastName).trim(),
                language: lang,
                checkout_date: parsedCheckout.toISOString().split('T')[0], // yyyy-mm-dd
            };
        }).filter(g => g.room_number && g.room_number !== 'undefined' && g.room_number !== '');

        if (guestsToInsert.length === 0) {
            return NextResponse.json({ error: 'Excel dosyasında geçerli bir veri bulunamadı.' }, { status: 400 });
        }

        // 3. Yeni listeyi Supabase'e bulk insert yapalım
        const { error: insertError } = await client
            .from('in_house_guests')
            .insert(guestsToInsert);

        if (insertError) {
            console.error('[API] Misafir listesi yüklenirken hata:', insertError);
            return NextResponse.json({ error: 'Sisteme kaydetme hatası: ' + insertError.message }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: `${guestsToInsert.length} adet misafir başarıyla sisteme yüklendi ve eski liste temizlendi.`
        });

    } catch (error: any) {
        console.error('[API] In-House Yükleme Hatası:', error);
        return NextResponse.json({ error: 'Beklenmeyen bir hata oluştu: ' + error.message }, { status: 500 });
    }
}
