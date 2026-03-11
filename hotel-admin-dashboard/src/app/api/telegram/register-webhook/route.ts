// src/app/api/telegram/register-webhook/route.ts
// Tüm Telegram botlarını lokal veya canlı URL'ye yönlendirir.
// POST /api/telegram/register-webhook  body: { webhookUrl: "https://..." }

import { NextResponse } from 'next/server';

const BOTS = [
    { token: process.env.TELEGRAM_GUEST_BOT_TOKEN, name: 'hotelmisafiri_bot' },
    { token: process.env.TELEGRAM_MANAGER_BOT_TOKEN, name: 'hotel_yonetici_bot' },
    { token: process.env.TELEGRAM_GA_HOTEL_BOT_TOKEN, name: 'ga_hotel_bot' },
];

export async function POST(req: Request) {
    try {
        const { webhookUrl } = await req.json();

        if (!webhookUrl) {
            return NextResponse.json({ error: 'webhookUrl zorunlu' }, { status: 400 });
        }

        const targetUrl = `${webhookUrl.replace(/\/$/, '')}/api/webhook/telegram`;
        const results: Record<string, any> = {};

        for (const bot of BOTS) {
            if (!bot.token) {
                results[bot.name] = { success: false, error: 'Token eksik' };
                continue;
            }

            try {
                const res = await fetch(
                    `https://api.telegram.org/bot${bot.token}/setWebhook`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: targetUrl,
                            secret_token: 'GUESTFLOW2026',
                            allowed_updates: ['message', 'edited_message', 'callback_query'],
                            drop_pending_updates: true,
                        }),
                    }
                );
                const data = await res.json();
                results[bot.name] = {
                    success: data.ok,
                    description: data.description,
                    url: targetUrl,
                };
            } catch (e: any) {
                results[bot.name] = { success: false, error: e.message };
            }
        }

        return NextResponse.json({ results, webhook_url: targetUrl });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// GET: Mevcut webhook durumunu kontrol et
export async function GET() {
    const status: Record<string, any> = {};

    for (const bot of BOTS) {
        if (!bot.token) { status[bot.name] = { error: 'Token eksik' }; continue; }
        try {
            const res = await fetch(`https://api.telegram.org/bot${bot.token}/getWebhookInfo`);
            const data = await res.json();
            status[bot.name] = {
                url: data.result?.url || '(kayıtlı webhook yok)',
                pending_update_count: data.result?.pending_update_count,
                last_error_message: data.result?.last_error_message || null,
                has_custom_certificate: data.result?.has_custom_certificate,
            };
        } catch (e: any) {
            status[bot.name] = { error: e.message };
        }
    }

    return NextResponse.json({ bots: status });
}
