import { supabase } from './lib/supabaseClient';
async function test() {
  const { data, error } = await supabase.from('students').select('*, survey_responses(submitted_at)').order('submitted_at', { referencedTable: 'survey_responses', ascending: false }).limit(1, { referencedTable: 'survey_responses' }).limit(1);
  console.log('Result:', JSON.stringify(data, null, 2), error);
}
test();
