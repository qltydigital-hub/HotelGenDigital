// src/lib/manychat-client.ts
import { MANYCHAT_CONFIG } from './manychat-config';

const getBaseUrl = (channel?: string) => {
    switch(channel?.toLowerCase()) {
        case 'instagram': return 'https://api.manychat.com/ig';
        case 'whatsapp': return 'https://api.manychat.com/wa';
        default: return 'https://api.manychat.com/fb';
    }
};

export async function setManyChatCustomField(subscriberId: string | number, fieldId: number, fieldValue: string | number | boolean) {
    if (!MANYCHAT_CONFIG.apiKey) {
        console.warn("ManyChat API Key eksik, field ayarlanamıyor.");
        return null;
    }
    // setCustomField works universally from /fb/ endpoint
    const response = await fetch(`https://api.manychat.com/fb/subscriber/setCustomField`, {
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
        return null; 
    }

    return await response.json();
}

export async function sendManyChatFlow(subscriberId: string | number, flowNs: string, channel?: string) {
    if (!MANYCHAT_CONFIG.apiKey) {
        console.warn("ManyChat API Key eksik, flow gönderilemiyor.");
        return null;
    }
    const response = await fetch(`${getBaseUrl(channel)}/sending/sendFlow`, {
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

/**
 * Dinamik "Quick Reply" butonları ile ManyChat'e doğrudan mesaj gönderir.
 * Facebook / Instagram için mesajın altına buton çıkartmak için kullanılır.
 */
export async function sendManyChatInteractiveMessage(subscriberId: string | number, text: string, options: string[], channel?: string) {
    if (!MANYCHAT_CONFIG.apiKey) {
        console.warn("ManyChat API Key eksik, interactive message gönderilemiyor.");
        return null;
    }
    
    const response = await fetch(`${getBaseUrl(channel)}/sending/sendContent`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            subscriber_id: subscriberId,
            data: {
                version: "v2",
                content: {
                    messages: [
                        {
                            type: "text",
                            text: text,
                            quick_replies: options.map(opt => ({
                                type: "node", 
                                caption: opt
                            }))
                        }
                    ]
                }
            }
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`ManyChat sendInteractiveMessage Hata:`, errText);
        // Hata durumunda null dön veya hata mesajını yakala
        return null;
    }

    return await response.json();
}

/**
 * Gönderilen mesajın anında iletilmesi için (Custom Field asenkron sorunlarını önlemek maksadıyla) direkt metin mesajı gönderir.
 */
export async function sendManyChatTextMessage(subscriberId: string | number, text: string, channel?: string) {
    if (!MANYCHAT_CONFIG.apiKey) {
        return null;
    }
    
    const response = await fetch(`${getBaseUrl(channel)}/sending/sendContent`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${MANYCHAT_CONFIG.apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body: JSON.stringify({
            subscriber_id: subscriberId,
            data: {
                version: "v2",
                content: {
                    messages: [
                        {
                            type: "text",
                            text: text
                        }
                    ]
                }
            }
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error(`ManyChat sendTextMessage Hata:`, errText);
        return null;
    }

    return await response.json();
}
