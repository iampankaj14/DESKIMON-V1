const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';
const DEVICE_ID = 'a800f38b-2697-49dd-8331-a300c603deba';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("Subscribing anonymously...");

const channel = supabase
  .channel('test-channel-2')
  .on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'device_preferences',
      filter: `device_id=eq.${DEVICE_ID}`
    },
    (payload) => {
      console.log("🎉 SUCCESS! Received Realtime event anonymously:", payload);
      process.exit(0);
    }
  )
  .subscribe((status) => {
    console.log("Subscription status:", status);
    
    if (status === 'SUBSCRIBED') {
      console.log("Triggering update...");
      supabase
        .from('device_preferences')
        .update({ brightness: 49 }) // change from 50 to 49
        .eq('device_id', DEVICE_ID)
        .then(({ error }) => {
          if (error) {
            console.error("Error updating:", error);
          } else {
            console.log("Row updated. Waiting 5 seconds...");
            setTimeout(() => {
              console.log("❌ Failed to receive Realtime event anonymously!");
              process.exit(1);
            }, 5000);
          }
        });
    }
  });
