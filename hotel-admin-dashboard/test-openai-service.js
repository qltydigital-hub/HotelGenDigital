require('dotenv').config({ path: '.env.local' });
// Set TS_NODE_COMPILER_OPTIONS so we can require ts files that use ES imports natively if needed
require('ts-node').register({
  compilerOptions: {
    module: "CommonJS",
    target: "es2018",
    esModuleInterop: true
  }
});

const { analyzeGuestMessage } = require('./src/lib/openai-service');

async function run() {
    try {
        console.log("Analyzing message...");
        const result = await analyzeGuestMessage("Merhabalar, yarın için oda ayırmak istiyorum.");
        console.log("Result:", result);
    } catch (e) {
        console.error("Crash in script:", e);
    }
}
run();
