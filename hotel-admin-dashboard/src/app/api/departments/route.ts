import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

export async function GET() {
    const client = getServiceSupabase();
    // Use select to fetch the hotel settings for 'departments'
    const { data, error } = await client
        .from('hotel_settings')
        .select('value')
        .eq('key', 'departments')
        .single();
    
    if (error) {
        if (error.code === 'PGRST116') {
            return NextResponse.json({ departments: null });
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ departments: data.value });
}

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const client = getServiceSupabase();
        
        const { error } = await client
            .from('hotel_settings')
            .upsert({
                key: 'departments',
                value: body.departments,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
