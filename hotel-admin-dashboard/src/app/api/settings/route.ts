import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const supabase = getServiceSupabase();
        
        let { data, error } = await supabase.from('hotel_settings').select('*').limit(1).maybeSingle();

        if (error) {
            console.error("GET /api/settings Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data) {
            // Eğer hiç ayar yoksa varsayılanı dön
            return NextResponse.json({ success: true, data: { department_timeout_minutes: 15 } });
        }

        return NextResponse.json({ success: true, data: data });
    } catch (error: any) {
        console.error("GET /api/settings Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const body = await request.json();
        
        const { department_timeout_minutes } = body;

        if (!department_timeout_minutes || department_timeout_minutes < 1 || department_timeout_minutes > 30) {
            return NextResponse.json({ success: false, error: 'Süre 1 ile 30 dakika arasında olmalıdır.' }, { status: 400 });
        }

        // Önce kayıt var mı kontrol et
        const { data: existingData } = await supabase.from('hotel_settings').select('id').limit(1).maybeSingle();

        let data, error;

        if (existingData) {
            // Güncelle
            const result = await supabase.from('hotel_settings').update({
                department_timeout_minutes: parseInt(department_timeout_minutes, 10),
                updated_at: new Date().toISOString()
            }).eq('id', existingData.id).select().single();
            data = result.data;
            error = result.error;
        } else {
            // Yeni oluştur
            const result = await supabase.from('hotel_settings').insert({
                department_timeout_minutes: parseInt(department_timeout_minutes, 10)
            }).select().single();
            data = result.data;
            error = result.error;
        }

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("POST /api/settings Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
