const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching latest interactions...");
  const { data: interactions, error } = await supabase
    .from('interactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error("Error fetching interactions:", error);
    return;
  }

  console.log("Latest 20 Interactions:");
  interactions.forEach((item, index) => {
    console.log(`[${index + 1}] ID: ${item.id} | Device: ${item.device_id.substring(0,8)}... | Type: ${item.interaction_type} | Time: ${item.created_at}`);
    console.log(`  User Input: "${item.user_input}"`);
    console.log(`  AI Response: "${item.ai_response}"`);
    console.log(`  Latency: ${item.latency_ms}ms`);
    console.log("----------------------------------------------------------------------");
  });
}

run();
