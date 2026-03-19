// src/lib/manychat-client.ts
import { MANYCHAT_CONFIG } from './manychat-config';

const BASE_URL = 'https://api.manychat.com/fb';

export async function setManyChatCustomField(subscriberId: string | number, fieldId: number, fieldValue: string | number | boolean) {
    if (!MANYCHAT_CONFIG.apiKey) {
        console.warn("ManyChat API Key eksik, field ayarlanamıyor.");
        return null;
    }
    const response = await fetch(`${BASE_URL}/subscriber/setCustomField`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            subscriber_id: subscriberId,
            field_id: fieldId,
            field_value: fieldValue,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`ManyChat setCustomField Hata (${fieldId}):`, errText);
        // Hata fırlatmıyoruz, akış bölünmesin
        return null; 
    }

    return await response.json();
}

export async function sendManyChatFlow(subscriberId: string | number, flowNs: string) {
    if (!MANYCHAT_CONFIG.apiKey) {
        console.warn("ManyChat API Key eksik, flow gönderilemiyor.");
        return null;
    }
    const response = await fetch(`${BASE_URL}/sending/sendFlow`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            subscriber_id: subscriberId,
            flow_ns: flowNs,
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`ManyChat sendFlow Hata (${flowNs}):`, errText);
        return null;
    }

    return await response.json();
}
