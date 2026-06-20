const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load env
const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim();
    }
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const sessionPath = path.join(__dirname, 'session.json');

async function run() {
  if (!fs.existsSync(sessionPath)) {
    console.error("session.json not found.");
    return;
  }
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  
  console.log("Setting session...");
  await supabase.auth.setSession({
    access_token: sessionData.access_token,
    refresh_token: sessionData.refresh_token
  });

  console.log("Attempting to create public bucket 'audio'...");
  const { data, error } = await supabase.storage.createBucket('audio', {
    public: true,
    allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3'],
    fileSizeLimit: 10485760 // 10MB
  });

  if (error) {
    console.error("Failed to create bucket:", error);
  } else {
    console.log("Bucket 'audio' created successfully or already exists:", data);
  }
}

run();
