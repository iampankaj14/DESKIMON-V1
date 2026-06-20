const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cnbwttjojlrconmargzh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAndCreateBucket() {
  console.log("Listing buckets...");
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) {
    console.error("Error listing buckets:", listError);
    return;
  }
  console.log("Buckets found:", buckets);

  const audioBucket = buckets.find(b => b.name === 'audio');
  if (audioBucket) {
    console.log("Audio bucket already exists!");
  } else {
    console.log("Attempting to create 'audio' bucket...");
    const { data: createData, error: createError } = await supabase.storage.createBucket('audio', {
      public: true,
      allowedMimeTypes: ['audio/wav', 'audio/mpeg', 'audio/mp3'],
      fileSizeLimit: 10485760 // 10MB
    });
    if (createError) {
      console.error("Error creating bucket:", createError);
    } else {
      console.log("Bucket created successfully:", createData);
    }
  }
}

checkAndCreateBucket();
