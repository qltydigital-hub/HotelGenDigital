import { analyzeGuestMessage } from './src/lib/openai-service';
async function test() {
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    const inputs = ["selam", "bir talepte bulunmadım", "cuma gününden", "Merhabalar cuma gününden"];
    for (const input of inputs) {
        console.log(`Testing: ${input}`);
        const result = await analyzeGuestMessage(input, false, { roomNo: "Bilinmiyor", guestName: "Misafir" });
        console.log(result.intent, result.ai_safe_reply);
    }
}
test().catch(console.error);
