const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  const email = 'deskimon_' + Math.random().toString(36).substring(7) + '@gmail.com';
  const password = 'Password123!';
  const hardwareId = '1C:DB:D4:48:E5:F8';

  console.log(`Signing up user: ${email}...`);
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error('Sign up error:', signUpError);
    return;
  }

  const user = authData.user;
  if (!user) {
    console.error('User not returned after sign up.');
    return;
  }
  console.log('User signed up successfully. User ID:', user.id);

  console.log('Inserting device...');
  const { data: newDevice, error: deviceError } = await supabase
    .from('devices')
    .insert({
      owner_id: user.id,
      hardware_id: hardwareId,
      device_name: 'My Deskimon',
      firmware_version: '1.0.0',
      battery_level: 100,
      wifi_signal_strength: -50,
      is_online: true
    })
    .select()
    .single();

  if (deviceError) {
    console.error('Device insertion error:', deviceError);
    return;
  }
  console.log('Device inserted successfully. Device ID:', newDevice.id);

  console.log('Inserting device preferences...');
  const { error: prefsError } = await supabase
    .from('device_preferences')
    .insert({
      device_id: newDevice.id,
      personality_preset: 'playful',
      eye_color: '#00FFFF',
      brightness: 80,
      volume: 70,
      tts_voice: 'en-US-Neural2-D',
      conversation_timeout_ms: 15000,
      sleep_after_idle_ms: 30000,
      wake_word: 'Hey Deskimon'
    });

  if (prefsError) {
    console.error('Preferences insertion error:', prefsError);
    return;
  }
  console.log('Device preferences inserted successfully!');
  console.log('Device registration completed successfully.');
}

run();
