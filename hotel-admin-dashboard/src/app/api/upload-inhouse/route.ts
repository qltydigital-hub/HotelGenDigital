import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';
import * as xlsx from 'xlsx';

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ success: false, error: 'Dosya yüklenmedi.' });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Excel okunur
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // JSON formatına dönüştür (1. satır başlık)
        const jsonData = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        if (!jsonData || jsonData.length < 2) {
            return NextResponse.json({ success: false, error: 'Excel dosyası boş veya beklenen formatta değil.' });
        }

        const supabase = getServiceSupabase();

        // 1. Önce eski In-House listesini temizle
        const { error: deleteError } = await supabase
            .from('in_house_guests')
            .delete()
            .neq('room_number', '0'); // Her şeyi sil
            
        if (deleteError) {
            console.error("Eski in_house verisi silinemedi:", deleteError);
            return NextResponse.json({ success: false, error: 'Eski kayıtlar silinemedi.' });
        }

        const insertData = [];

        // Başlık satırı hariç dön
        for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (!row || row.length === 0) continue;
            
            const odaNo = row[0];
            const isimSoyisim = row[1];
            
            if (!odaNo || !isimSoyisim) continue;
            
            const first_name = isimSoyisim.toString().split(' ')[0] || '';
            const last_name = isimSoyisim.toString().split(' ').slice(1).join(' ') || '';
            
            // Excel tarihleri string formatında geldiğini varsayıyoruz (örn: 28.03.2026)
            let checkInDate = null;
            let checkOutDate = null;
            
            if (row[3]) {
                const parts = row[3].toString().split('.');
                if (parts.length === 3) checkInDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                else checkInDate = row[3];
            }
            if (row[4]) {
                const parts = row[4].toString().split('.');
                if (parts.length === 3) checkOutDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                else checkOutDate = row[4];
            }

            insertData.push({
                hotel_id: '11111111-1111-1111-1111-111111111111',
                room_number: odaNo.toString(),
                first_name: first_name,
                last_name: last_name,
                language: 'tr',
                check_in_date: checkInDate,
                check_out_date: checkOutDate
            });
        }

        if (insertData.length === 0) {
            return NextResponse.json({ success: false, error: 'Geçerli bir misafir satırı bulunamadı.' });
        }

        // Toplu Insert İşlemi
        const { error: insertError } = await supabase
            .from('in_house_guests')
            .insert(insertData);

        if (insertError) {
            console.error("Insert hatası:", insertError);
            return NextResponse.json({ success: false, error: insertError.message });
        }

        return NextResponse.json({ 
            success: true, 
            message: `${insertData.length} misafir başarıyla sisteme işlendi.`,
            data: insertData 
        });

    } catch (error: any) {
        console.error("Inhouse upload error:", error);
        return NextResponse.json({ success: false, error: error.message });
    }
}
