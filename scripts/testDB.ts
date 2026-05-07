import { supabase } from './lib/supabaseClient.ts';
async function test() {
   const { error: e1 } = await supabase.from('employment_history').select('*').limit(1);
   const { error: e2 } = await supabase.from('employment_information').select('*').limit(1);
   console.log("History error:", e1?.message);
   console.log("Information error:", e2?.message);
}
test();
