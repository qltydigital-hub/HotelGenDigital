require('dotenv').config({ path: '.env.local' });
const { OpenAI } = require('openai');

async function test() {
    console.log("Key:", process.env.OPENAI_API_KEY ? "EXISTS" : "MISSING");
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: "Test message" }]
        });
        console.log("SUCCESS:", response.choices[0].message.content);
    } catch (e) {
        console.error("ERROR:");
        console.error(e.message);
    }
}
test();
