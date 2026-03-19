import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export async function GET(request: Request) {
    try {
        const supabase = getServiceSupabase();
        
        // Fetch all agencies safely
        const { data, error } = await supabase.from('agencies').select('*').order('created_at', { ascending: true });
        
        if (error) throw error;

        return NextResponse.json({ success: true, data: data || [] });
    } catch (error: any) {
        console.error("GET /api/agencies Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const body = await request.json();
        
        const { name, url, price_text, is_direct } = body;

        // Validasyon
        if (!name || !url) {
            return NextResponse.json({ success: false, error: 'Acenta adı ve linki zorunludur.' }, { status: 400 });
        }

        const { data, error } = await supabase.from('agencies').insert({
            name,
            url,
            price_text: price_text || 'Bilgi Yok',
            is_direct: !!is_direct
        }).select().single();

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("POST /api/agencies Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const supabase = getServiceSupabase();
        const url = new URL(request.url);
        const id = url.searchParams.get('id');

        if (!id) return NextResponse.json({ success: false, error: 'ID eksik' }, { status: 400 });

        const { error } = await supabase.from('agencies').delete().eq('id', id);
        
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("DELETE /api/agencies Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
