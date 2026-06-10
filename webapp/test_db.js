const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching devices...");
  const { data: devices, error: devError } = await supabase.from('devices').select('*');
  if (devError) {
    console.error("Devices error:", devError);
  } else {
    console.log("Devices count:", devices?.length);
    console.log("Devices list:", devices);
  }

  console.log("\nFetching device preferences...");
  const { data: prefs, error: prefsError } = await supabase.from('device_preferences').select('*');
  if (prefsError) {
    console.error("Preferences error:", prefsError);
  } else {
    console.log("Preferences count:", prefs?.length);
    console.log("Preferences list:", prefs);
  }

  console.log("\nFetching profiles...");
  const { data: profiles, error: profError } = await supabase.from('profiles').select('*');
  if (profError) {
    console.error("Profiles error:", profError);
  } else {
    console.log("Profiles count:", profiles?.length);
    console.log("Profiles list:", profiles);
  }
}

run();
