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

const email = 'pankajiam14@gmail.com';
const password = process.argv[2];

if (!password) {
  console.error("Error: Please provide the password as an argument: node login.js <password>");
  process.exit(1);
}

async function run() {
  console.log(`Signing in as ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    console.error("Sign in failed:", error.message);
    process.exit(1);
  }

  console.log("Sign in successful! Writing session.json...");
  fs.writeFileSync(sessionPath, JSON.stringify(data.session, null, 2));
  console.log("session.json updated successfully.");
}

run();
