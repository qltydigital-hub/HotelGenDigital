import 'dotenv/config';
import { getServiceSupabase } from './src/lib/supabase-client';
(async () => {
    const s = getServiceSupabase();
    const { data } = await s.from('hotel_settings').select('*');
    console.log("Hotel settings:", data);
})();
