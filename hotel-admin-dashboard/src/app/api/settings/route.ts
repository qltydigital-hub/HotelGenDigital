import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const supabase = getServiceSupabase();
        
        let { data, error } = await supabase.from('hotel_settings').select('value').eq('key', 'general_settings').limit(1).maybeSingle();

        if (error) {
            console.error("GET /api/settings Error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!data || !data.value) {
            // Eğer hiç ayar yoksa varsayılanı dön
            return NextResponse.json({ success: true, data: { 
                department_timeout_minutes: 15, 
                escalation_email: '', 
                escalation_telegram_id: '', 
                minibar_note: '',
                offerMap: true, remind247: true, offerInfo: true, konseptTipi: "Oda Kahvaltı (BB)",
                ibanText: "", isIbanTextActive: true, isIbanImageActive: true, isIbanExcelActive: true
            } });
        }

        return NextResponse.json({ success: true, data: data.value });
    } catch (error: any) {
        console.error("GET /api/settings Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const body = await request.json();
        
        // Önce mevcut değeri al (varsa)
        const { data: existingData } = await supabase.from('hotel_settings').select('value').eq('key', 'general_settings').limit(1).maybeSingle();
        const prevValue = existingData?.value || {};
        
        const newValue = { ...prevValue, ...body };

        const { data, error } = await supabase.from('hotel_settings').upsert({
            key: 'general_settings',
            value: newValue,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).select('value').single();

        if (error) throw error;

        return NextResponse.json({ success: true, data: data.value });
    } catch (error: any) {
        console.error("POST /api/settings Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
