import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const body = await request.json();
        
        // Önce mevcut değeri al (varsa)
        const { data: existingData } = await supabase.from('hotel_settings').select('value').eq('key', 'general_settings').limit(1).maybeSingle();
        const prevValue = existingData?.value || {};
        
        // Sadece kemal_presentation_mode alanını güncelle
        const newValue = { ...prevValue, kemal_presentation_mode: Boolean(body.active) };

        const { data, error } = await supabase.from('hotel_settings').upsert({
            key: 'general_settings',
            value: newValue,
            updated_at: new Date().toISOString()
        }, { onConflict: 'key' }).select('value').single();

        if (error) throw error;

        return NextResponse.json({ success: true, mode: body.active });
    } catch (error: any) {
        console.error("POST /api/settings/kemal-mode Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
