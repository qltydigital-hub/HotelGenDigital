import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// We must import this AFTER dotenv.config
const { analyzeGuestMessage } = require('./src/lib/openai-service');

async function run() {
    console.log("==== TEST 1: Sadece Soru (Alerjen False) ====");
    console.log("Mesaj: Restoran akşam kaça kadar hizmet veriyor?");
    const res1 = await analyzeGuestMessage("Restoran akşam kaça kadar hizmet veriyor?", false, { roomNo: "105", guestName: "Ahmet" });
    console.log(JSON.stringify(res1, null, 2));

    console.log("\n==== TEST 2: Alerji Bildirimi (Alerjen True) ====");
    console.log("Mesaj: Merhaba, çocuğumun gluten alerjisi var, buna göre yemek hazırlayabilir misiniz?");
    const res2 = await analyzeGuestMessage("Merhaba, çocuğumun gluten alerjisi var, buna göre yemek hazırlayabilir misiniz?", false, { roomNo: "Bilinmiyor", guestName: "Bilinmiyor" });
    console.log(JSON.stringify(res2, null, 2));
}

run();
