import { supabase } from '../lib/supabaseClient';
async function run() {
   const sr = await supabase.from('survey_responses').select('*').limit(1);
   console.log("survey_responses columns:", sr.data && sr.data[0] ? Object.keys(sr.data[0]) : "No data or Error");
   const edu = await supabase.from('education_information').select('*').limit(1);
   console.log("education_information columns:", edu.data && edu.data[0] ? Object.keys(edu.data[0]) : "No data or Error");
}
run();
