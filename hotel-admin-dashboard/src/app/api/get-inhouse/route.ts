import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

// Prevent Next.js from aggressively caching this route
export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const supabase = getServiceSupabase();
        
        const { data, error } = await supabase
            .from('in_house_guests')
            .select('*')
            .order('room_number', { ascending: true });
            
        if (error) {
            console.error("GET In-house error:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        
        return NextResponse.json({ success: true, data });
    } catch (error: any) {
        console.error("GET In-house exception:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
