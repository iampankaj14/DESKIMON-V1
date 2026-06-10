const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const deviceId = 'a800f38b-2697-49dd-8331-a300c603deba';

async function update() {
  console.log("Loading active session...");
  try {
    const session = require('./session.json');
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token
    });
    if (sessionError) {
      console.warn("Session set error:", sessionError.message);
    } else {
      console.log("Authenticated session loaded successfully.");
    }
  } catch (e) {
    console.warn("No session.json found or failed to load. Proceeding anonymously.");
  }

  console.log(`Updating preferences for device ${deviceId}...`);
  
  // Toggle colors
  const newColor = process.argv[2] || '#00FA9A';
  const newBrightness = process.argv[3] ? Number(process.argv[3]) : 90;
  
  const { data, error } = await supabase
    .from('device_preferences')
    .update({ 
      eye_color: newColor,
      brightness: newBrightness,
      updated_at: new Date().toISOString()
    })
    .eq('device_id', deviceId)
    .select();

  if (error) {
    console.error("Error updating preferences:", error);
  } else {
    console.log("Success! Updated preference row:", data);
  }
}

update();
