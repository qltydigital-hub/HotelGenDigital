import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { analyzeGuestMessage } from './src/lib/openai-service';

async function run() {
    try {
        console.log("Analyzing message...");
        const result = await analyzeGuestMessage("Çarşamba gününden merhabalar");
        console.log("Result:", result);
    } catch (e) {
        console.error("Crash in script:", e);
    }
}
run();
