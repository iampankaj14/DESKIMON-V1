const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuYnd0dGpvamxyY29ubWFyZ3poIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1NTkxMTEsImV4cCI6MjA5NjEzNTExMX0.lnv5XcSBzLvbvVf-rLdq-ioOXUsKCBuoISrrwNKnw5w';
const DEVICE_ID = '51c45765-db74-4a38-b2a4-1b765a97cf44';

const wsUri = `wss://cnbwttjojlrconmargzh.supabase.co/realtime/v1/websocket?apikey=${SUPABASE_KEY}&vsn=1.0.0`;

console.log("Connecting to WebSocket:", wsUri.substring(0, 70) + "...");
const ws = new WebSocket(wsUri);

ws.onopen = () => {
  console.log("\n✅ WebSocket connected!");
  console.log("Subscribing to device preferences...");
  
  const joinMsg = {
    topic: `realtime:device_prefs_${DEVICE_ID}`,
    event: "phx_join",
    payload: {
      config: {
        postgres_changes: [
          {
            event: "UPDATE",
            schema: "public",
            table: "device_preferences",
            filter: `device_id=eq.${DEVICE_ID}`
          }
        ]
      }
    },
    ref: "1"
  };

  ws.send(JSON.stringify(joinMsg));
  console.log("Subscription request sent. Waiting for updates...\n");
  console.log("👉 Change the eye color in the website or Supabase dashboard now!");
};

ws.onmessage = (event) => {
  try {
    const data = JSON.parse(event.data);
    
    // Heartbeat replies
    if (data.event === "phx_reply" && data.topic === "phoenix") {
      return;
    }

    console.log("\n📥 [WebSocket Inbound Event]:");
    console.log(JSON.stringify(data, null, 2));

    if (data.event === "postgres_changes" && data.payload && data.payload.data) {
      const record = data.payload.data.record;
      if (record) {
        console.log(`\n🎉 REAL-TIME UPDATE RECEIVED!`);
        console.log(`👁️  New Eye Color: ${record.eye_color}`);
        console.log(`💡 Brightness: ${record.brightness}%`);
        console.log(`🔊 Volume: ${record.volume}%`);
      }
    }
  } catch (err) {
    console.error("Error parsing message:", err.message);
  }
};

ws.onerror = (err) => {
  console.error("WebSocket error:", err);
};

ws.onclose = () => {
  console.log("WebSocket connection closed.");
};

// Send Phoenix heartbeat every 25 seconds (matches C driver)
let heartbeatRef = 1;
setInterval(() => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      topic: "phoenix",
      event: "heartbeat",
      payload: {},
      ref: String(heartbeatRef++)
    }));
  }
}, 25000);
