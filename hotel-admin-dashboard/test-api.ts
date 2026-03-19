import { analyzeGuestMessage } from './src/lib/openai-service';

async function run() {
    try {
        console.log("Testing with API Key:", process.env.OPENAI_API_KEY?.substring(0, 10) + "...");
        const res = await analyzeGuestMessage("Merhabalar pazar gününden 1");
        console.log("Success Result:", res);
    } catch (e) {
        console.error("Test Error:", e);
    }
}

run();
