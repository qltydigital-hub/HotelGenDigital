// src/app/api/messages/route.ts
// Artık Supabase'e yazıp okuyor (önceki in-memory store'un yerine)

import { NextResponse } from 'next/server';
import { saveMessageToSupabase, getMessagesForChat, getServiceSupabase } from '@/lib/supabase-client';

// GET: Belirli bir chatId'nin Supabase'deki mesajlarını çek
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
        return NextResponse.json({ error: 'chatId gerekli' }, { status: 400 });
    }

    try {
        const messages = await getMessagesForChat(chatId, 100);
        // Dashboard beklediği formata dönüştür
        const formatted = messages.map(m => ({
            role: m.role,
            text: m.text,
            platform: m.platform,
            timestamp: m.created_at || new Date().toISOString(),
        }));
        return NextResponse.json({ messages: formatted });
    } catch (err: any) {
        console.error('[/api/messages GET]', err);
        return NextResponse.json({ messages: [] });
    }
}

// POST: Yeni mesaj ekle (dashboard'dan yönetici yanıtı vs.)
export async function POST(req: Request) {
    try {
        const { chatId, role, text, platform } = await req.json();

        if (!chatId || !text || !role) {
            return NextResponse.json({ error: 'chatId, role ve text gerekli' }, { status: 400 });
        }

        const ok = await saveMessageToSupabase({
            chat_id: chatId,
            bot_name: 'dashboard',
            role: role as any,
            text,
            platform: platform || 'Dashboard',
        });

        return NextResponse.json({ success: ok });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// DELETE: Belirli bir chatId'nin mesajlarını sil
export async function DELETE(req: Request) {
    const { searchParams } = new URL(req.url);
    const chatId = searchParams.get('chatId');

    if (!chatId) {
        return NextResponse.json({ error: 'chatId gerekli' }, { status: 400 });
    }

    try {
        const client = getServiceSupabase();
        await client.from('telegram_messages').delete().eq('chat_id', chatId);
        return NextResponse.json({ success: true });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
