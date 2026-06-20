const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const deviceId = 'a800f38b-2697-49dd-8331-a300c603deba';

async function run() {
  console.log("Attempting to select is_listening column...");
  const { data: selectData, error: selectError } = await supabase
    .from('devices')
    .select('id, is_listening')
    .eq('id', deviceId);

  if (selectError) {
    console.error("Select error:", selectError.message);
  } else {
    console.log("Select success! Data:", selectData);
  }

  console.log("Attempting to select audio_url column...");
  const { data: selectPrefsData, error: selectPrefsError } = await supabase
    .from('device_preferences')
    .select('device_id, audio_url')
    .eq('device_id', deviceId);

  if (selectPrefsError) {
    console.error("Select preferences error:", selectPrefsError.message);
  } else {
    console.log("Select preferences success! Data:", selectPrefsData);
  }
}

run();
