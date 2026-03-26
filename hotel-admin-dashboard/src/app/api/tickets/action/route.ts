import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase-client';
import { setManyChatCustomField, sendManyChatFlow } from '@/lib/manychat-client';
import { MANYCHAT_CONFIG } from '@/lib/manychat-config';

export async function POST(request: Request) {
    try {
        const payload = await request.json();
        const { ticketId, action, staffName } = payload; // action is 'NOW' or 'LATER'
        
        if (!ticketId || !action) {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
        }

        const supabase = getServiceSupabase();

        // 1. Fetch ticket
        const { data: ticket, error } = await supabase
            .from('active_tickets')
            .select('*')
            .eq('ticket_id', ticketId)
            .single();

        if (error || !ticket) {
            console.error("Ticket bulunamadı:", error);
            return NextResponse.json({ success: false, error: 'Ticket not found' }, { status: 404 });
        }

        if (ticket.status !== 'PENDING') {
            return NextResponse.json({ success: false, error: `Talep önceden cevaplandı: ${ticket.status}` }, { status: 400 });
        }

        // 2. Update status mapping to "COMPLETED" (as per requirements "sisteme talep karşılandı diye düşüyordu")
        // Alternatively we can use ACKNOWLEDGED and track it. We'll use ACKNOWLEDGED to be consistent with Telegram.
        await supabase.from('active_tickets').update({ 
            status: 'COMPLETED', // The prompt mentioned "talep karşılandı diye düşüyordu", so we'll use COMPLETED or ACKNOWLEDGED. Let's use 'COMPLETED' for dashboard. Actually, to keep telegram and dashboard in sync, let's use 'ACKNOWLEDGED'
            updated_at: new Date().toISOString() 
        }).eq('ticket_id', ticketId);

        // 3. Notify the guest via ManyChat
        const replyMsg = action === 'NOW' ? ticket.reply_immediate_lang : ticket.reply_later_lang;

        if (ticket.subscriber_id && ticket.subscriber_id !== "unknown") {
            await setManyChatCustomField(ticket.subscriber_id, MANYCHAT_CONFIG.fields.ai_cevap, replyMsg);
            await setManyChatCustomField(ticket.subscriber_id, MANYCHAT_CONFIG.fields.n8n_cevap, replyMsg);
            
            const flowId = ticket.channel === 'whatsapp' ? MANYCHAT_CONFIG.contentIds.whatsapp.normalCevap : MANYCHAT_CONFIG.contentIds.instagram.noLink;
            await sendManyChatFlow(ticket.subscriber_id, flowId);
        }

        return NextResponse.json({ 
            success: true, 
             message: 'İşlem Başarılı' 
        });

    } catch (error: any) {
        console.error("Ticket Action Error:", error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
