const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const deviceId = 'a800f38b-2697-49dd-8331-a300c603deba';

async function test() {
  console.log("Creating a new user...");
  const email = 'test_owner_' + Math.random().toString(36).substring(7) + '@gmail.com';
  const password = 'Password123!';
  
  const { data: authData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return;
  }

  const userId = authData.user.id;
  console.log("User created! ID:", userId);

  console.log("Attempting to update owner_id on devices table anonymously...");
  const { data: updateData, error: updateError } = await supabase
    .from('devices')
    .update({ owner_id: userId })
    .eq('id', deviceId)
    .select();

  if (updateError) {
    console.error("Update error:", updateError);
  } else {
    console.log("Update result:", updateData);
  }
}

test();
