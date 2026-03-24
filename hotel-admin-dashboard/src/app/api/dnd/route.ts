import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const supabase = getServiceSupabase();
        let { data, error } = await supabase.from('hotel_settings').select('value').eq('key', 'DND_LIST').maybeSingle();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, dnd_list: data?.value || '' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const body = await request.json();
        const { dnd_list } = body;

        // Önce kayıt var mı kontrol et
        const { data: existingData } = await supabase.from('hotel_settings').select('id').eq('key', 'DND_LIST').maybeSingle();

        let error;
        if (existingData) {
            const result = await supabase.from('hotel_settings').update({ value: dnd_list, updated_at: new Date().toISOString() }).eq('id', existingData.id);
            error = result.error;
        } else {
            const result = await supabase.from('hotel_settings').insert({
                key: 'DND_LIST',
                value: dnd_list
            });
            error = result.error;
        }

        if (error) throw error;

        return NextResponse.json({ success: true, dnd_list });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
