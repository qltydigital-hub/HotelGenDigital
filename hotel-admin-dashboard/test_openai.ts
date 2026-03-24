import 'dotenv/config';
import { analyzeGuestMessage } from './src/lib/openai-service';
(async () => {
  const r2 = await analyzeGuestMessage("409 Özgür ÖZEN", false, { roomNo: "Bilinmiyor" });
  console.log("R2 extracted:", r2.extracted_room_no, r2.extracted_guest_name);
})();
