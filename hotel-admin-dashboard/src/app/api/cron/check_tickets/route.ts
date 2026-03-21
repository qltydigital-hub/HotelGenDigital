import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';
import { escalateToManagement } from '@/lib/telegram-service';

export async function GET(request: Request) {
    try {
        const supabase = getServiceSupabase();

        // Tüm PENDING durumundaki biletleri getir
        const { data: tickets, error } = await supabase
            .from('active_tickets')
            .select('*')
            .eq('status', 'PENDING');

        if (error) {
            console.error("Cron Error fetch PENDING tickets:", error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        if (!tickets || tickets.length === 0) {
            return NextResponse.json({ success: true, message: 'No pending tickets' });
        }

        const now = new Date();
        let escalatedCount = 0;

        for (const ticket of tickets) {
            const createdAt = new Date(ticket.created_at);
            const diffMinutes = Math.floor((now.getTime() - createdAt.getTime()) / 60000);

            // Ayarlanan timeout_minutes değerini geçtiyse
            const timeout = ticket.timeout_minutes || 15;

            if (diffMinutes >= timeout) {
                // 1) Eskalasyon mesajı at (yöneticiye / resepsiyona)
                const mockManagerChatId = process.env.TELEGRAM_MANAGER_BOT_TOKEN ? "YOUR_MANAGER_CHAT_ID_TBD" : null;
                
                if (mockManagerChatId) {
                    await escalateToManagement(mockManagerChatId, ticket.ticket_id, ticket.department);
                }

                // 2) Durumu ESCALATED olarak güncelle (Tekrar tekrar düşmesin)
                await supabase
                    .from('active_tickets')
                    .update({ status: 'ESCALATED', updated_at: now.toISOString() })
                    .eq('ticket_id', ticket.ticket_id);
                
                escalatedCount++;
            }
        }

        return NextResponse.json({ success: true, checked: tickets.length, escalated: escalatedCount });

    } catch (error) {
        console.error("Cron Job Ticket Check Error:", error);
        return NextResponse.json({ success: false, error: "System Error" }, { status: 500 });
    }
}
