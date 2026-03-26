import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const department = searchParams.get('department') || 'Teknik Servis'; // Default to Teknik
        const date = searchParams.get('date');
        const startDateParam = searchParams.get('startDate');
        const endDateParam = searchParams.get('endDate');

        const supabase = getServiceSupabase();
        
        // Base query
        let query = supabase.from('active_tickets')
            .select('*')
            // Using flexible matching for Technical Service depending on how AI outputs it
            // AI could output 'Teknik Servis', 'T/S', 'Technical Service'
            .or('department.ilike.%teknik%,department.ilike.%technical%,department.eq.T/S')
            .order('created_at', { ascending: false });

        if (startDateParam && endDateParam) {
            const startDate = new Date(startDateParam);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(endDateParam);
            endDate.setHours(23, 59, 59, 999);
            
            query = query
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
        } else if (date) {
            // date matches YYYY-MM-DD
            const startDate = new Date(date);
            startDate.setHours(0, 0, 0, 0);
            
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            
            query = query
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString());
        }

        const { data: tickets, error } = await query;

        if (error) throw error;

        return NextResponse.json({ success: true, count: tickets?.length || 0, data: tickets });
    } catch (error: any) {
        console.error("Tickets Fetch Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
