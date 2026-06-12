const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

// 1. Load Environment Variables manually from .env.local
const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      let value = parts.slice(1).join('=').trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      env[key] = value;
    }
  });
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Error: Supabase configuration is missing from .env.local");
  process.exit(1);
}

// 2. Initialize Supabase Client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 3. Authenticate with saved session.json
const sessionPath = path.join(__dirname, 'session.json');

async function authenticate() {
  if (!fs.existsSync(sessionPath)) {
    console.error("Error: session.json not found. Run the webapp login page first to save credentials.");
    process.exit(1);
  }
  
  const sessionData = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
  console.log(`Authenticating as: ${sessionData.user?.email || 'Unknown User'}...`);
  
  const { data, error } = await supabase.auth.setSession({
    access_token: sessionData.access_token,
    refresh_token: sessionData.refresh_token
  });

  if (error) {
    console.error("Error setting session:", error.message);
    process.exit(1);
  }
  
  console.log("Authentication successful.");
  
  // Listen for token refreshes and save them back to session.json
  supabase.auth.onAuthStateChange((event, session) => {
    if (session && (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN')) {
      console.log(`Session refreshed at ${new Date().toLocaleTimeString()}. Saving session.json...`);
      fs.writeFileSync(sessionPath, JSON.stringify(session, null, 2));
    }
  });
}

// ============================================================
// CONVERSATION SESSION MANAGER
// Maintains multi-turn conversation context per device.
// Sessions auto-expire after 60 seconds of inactivity.
// ============================================================
class ConversationManager {
  constructor(ttlMs = 60000, maxTurns = 10) {
    this.sessions = new Map();  // deviceId → { turns: [], lastActive: Date.now() }
    this.ttlMs = ttlMs;
    this.maxTurns = maxTurns;   // Max turn pairs to keep (10 turns = 5 exchanges)

    // Periodic cleanup of expired sessions every 30 seconds
    this.cleanupInterval = setInterval(() => this.cleanup(), 30000);
  }

  /**
   * Get or create a conversation session for a device.
   * If the session has expired, a fresh one is created.
   */
  getOrCreate(deviceId) {
    let session = this.sessions.get(deviceId);
    if (!session || Date.now() - session.lastActive > this.ttlMs) {
      if (session) {
        console.log(`[ConvMgr] Session expired for device ${deviceId.substring(0, 8)}... Starting fresh.`);
      }
      session = { turns: [], lastActive: Date.now() };
      this.sessions.set(deviceId, session);
    }
    session.lastActive = Date.now();
    return session;
  }

  /**
   * Add a completed turn (user input + AI response) to the session.
   * Trims to maxTurns to prevent unbounded memory growth.
   */
  addTurn(deviceId, userInputDescription, aiResponse) {
    const session = this.getOrCreate(deviceId);
    session.turns.push({ role: 'user', text: userInputDescription });
    session.turns.push({ role: 'model', text: aiResponse });

    // Keep only the last N turns
    if (session.turns.length > this.maxTurns) {
      session.turns = session.turns.slice(-this.maxTurns);
    }
    console.log(`[ConvMgr] Device ${deviceId.substring(0, 8)}... now has ${session.turns.length} turns in context.`);
  }

  /**
   * Remove expired sessions from memory.
   */
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    for (const [id, session] of this.sessions) {
      if (now - session.lastActive > this.ttlMs) {
        this.sessions.delete(id);
        cleaned++;
      }
    }
    if (cleaned > 0) {
      console.log(`[ConvMgr] Cleaned up ${cleaned} expired session(s). Active: ${this.sessions.size}`);
    }
  }

  /**
   * Get the number of active sessions (for diagnostics).
   */
  get activeCount() {
    return this.sessions.size;
  }
}

// Create global conversation manager: 60-second TTL, keep last 10 turns (5 exchanges)
const conversations = new ConversationManager(60000, 10);

// ============================================================
// VOICE INPUT HANDLER — Multi-turn conversation support
// ============================================================

// Guard against duplicate processing of the same voice query
let lastProcessedUrl = null;

async function handleVoiceInput(deviceId, voiceQueryUrl) {
  // Deduplicate: skip if we just processed this exact URL
  if (voiceQueryUrl === lastProcessedUrl) {
    console.log(`[Voice] Skipping duplicate voice query URL for device ${deviceId.substring(0, 8)}...`);
    return;
  }
  lastProcessedUrl = voiceQueryUrl;

  const session = conversations.getOrCreate(deviceId);
  const turnNumber = Math.floor(session.turns.length / 2) + 1;
  const isFollowUp = session.turns.length > 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Voice] ${isFollowUp ? 'FOLLOW-UP' : 'NEW CONVERSATION'} — Turn #${turnNumber} for device ${deviceId.substring(0, 8)}...`);
  console.log(`[Voice] Processing: ${voiceQueryUrl}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    // A. Download WAV file from Supabase Storage
    const downloadRes = await fetch(voiceQueryUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download audio file: HTTP ${downloadRes.status}`);
    }
    const audioBuffer = Buffer.from(await downloadRes.arrayBuffer());
    const base64Audio = audioBuffer.toString('base64');
    console.log(`[Voice] Downloaded WAV file (${audioBuffer.length} bytes). Calling Gemini...`);

    // B. Build multi-turn Gemini request with conversation history
    // Build the contents array with conversation history
    const contents = [];

    // Add previous turns as text context
    for (const turn of session.turns) {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.text }]
      });
    }

    // Add current audio query as the latest user turn
    const currentUserParts = [
      {
        inlineData: {
          mimeType: "audio/wav",
          data: base64Audio
        }
      }
    ];

    // Add contextual instruction based on whether this is a follow-up
    if (isFollowUp) {
      currentUserParts.push({
        text: "Continue our conversation naturally. Answer the user's spoken follow-up question. Keep it brief."
      });
    } else {
      currentUserParts.push({
        text: "Answer the user's spoken question."
      });
    }

    contents.push({
      role: 'user',
      parts: currentUserParts
    });

    const requestBody = {
      systemInstruction: {
        parts: [{
          text: "You are DESKIMON, a smart, funny, and expressive desk companion. " +
                "You are having a real-time voice conversation. " +
                "Keep every response extremely brief — maximum 120 characters, 1-2 short sentences. " +
                "Be engaging, witty, and remember context from earlier in the conversation. " +
                "Never mention that you're an AI or that you received audio data."
        }]
      },
      contents
    };

    const modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    let aiResponse = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        console.log(`[Voice] Calling Gemini API (${model})...`);
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });

        if (!geminiRes.ok) {
          const errText = await geminiRes.text();
          throw new Error(`HTTP ${geminiRes.status}. Details: ${errText}`);
        }

        const resJson = await geminiRes.json();
        aiResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (aiResponse) {
          console.log(`[Voice] Gemini (${model}) response: "${aiResponse}"`);
          break;
        }
      } catch (err) {
        console.warn(`[Voice] Warning: Model ${model} failed:`, err.message);
        lastError = err;
      }
    }

    if (!aiResponse) {
      throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
    }

    // Save turn to conversation history
    conversations.addTurn(deviceId, '[Audio query]', aiResponse);

    // C. Synthesize Speech using Microsoft Edge TTS with fast speed rate (+40%)
    console.log("[Voice] Synthesizing response via Edge TTS (voice: en-US-EmmaMultilingualNeural, rate: +40%)...");
    
    const tts = new MsEdgeTTS();
    await tts.setMetadata("en-US-EmmaMultilingualNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    
    const { audioStream } = tts.toStream(aiResponse, { rate: "+40%" });
    
    // Write stream to local temporary MP3 file
    const tempFile = path.join(__dirname, 'temp_response.mp3');
    const writeStream = fs.createWriteStream(tempFile);
    
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
      audioStream.on('error', reject);
      audioStream.pipe(writeStream);
    });

    const mp3Buffer = fs.readFileSync(tempFile);
    console.log(`[Voice] Speech synthesized. Size: ${mp3Buffer.length} bytes. Uploading response...`);

    // D. Upload MP3 to Supabase Storage
    const storagePath = `responses/${deviceId}_response.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(storagePath, mp3Buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Clean up local temp file
    fs.unlinkSync(tempFile);

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(storagePath);

    console.log(`[Voice] Uploaded response MP3: ${publicUrl}`);

    // E. Update device_preferences audio_url to trigger ESP32 playback
    console.log(`[Voice] Writing audio_url to device preferences...`);
    const { error: prefError } = await supabase
      .from('device_preferences')
      .update({ audio_url: publicUrl })
      .eq('device_id', deviceId);

    if (prefError) {
      throw prefError;
    }

    // F. Log interaction in db
    await supabase
      .from('interactions')
      .insert({
        device_id: deviceId,
        interaction_type: 'voice',
        user_input: isFollowUp ? `[Follow-up #${turnNumber}]` : '[New conversation]',
        ai_response: aiResponse,
        emotion_triggered: 'happy',
        latency_ms: 500
      });

    // G. Clear audio_url after a delay so ESP32 can consume it first.
    // In continuous conversation mode, the ESP32 state machine handles the
    // next listen cycle automatically. We still clear audio_url to reset
    // the trigger for the next query.
    setTimeout(async () => {
      await supabase
        .from('device_preferences')
        .update({ audio_url: null })
        .eq('device_id', deviceId);
      console.log(`[Voice] Cleared preferences audio_url.`);
    }, 4000);

  } catch (err) {
    console.error("[Voice] Error processing voice interaction:", err);
  } finally {
    // H. Reset devices.voice_query_url so it can be re-triggered.
    // NOTE: We do NOT reset is_listening here — the ESP32 state machine
    // manages listening state based on follow-up timer / conversation flow.
    console.log(`[Voice] Resetting voice_query_url for next trigger...`);
    lastProcessedUrl = null;
    await supabase
      .from('devices')
      .update({ voice_query_url: null })
      .eq('id', deviceId);
  }
}

// 5. Main Loop — Polling + Realtime (belt-and-suspenders)
async function run() {
  await authenticate();
  
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   DESKIMON AI Daemon v2.1 — Polling + Realtime        ║");
  console.log("║   Watching for voice queries on 'devices' table...    ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  
  // --- REALTIME (bonus, may not work depending on Supabase config) ---
  const channel = supabase
    .channel('voice-assistant-daemon')
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'devices'
      },
      (payload) => {
        const { id: deviceId, voice_query_url } = payload.new;
        if (voice_query_url && voice_query_url !== payload.old?.voice_query_url) {
          console.log('[Realtime] Event received! Triggering voice handler...');
          handleVoiceInput(deviceId, voice_query_url);
        }
      }
    )
    .subscribe((status) => {
      console.log(`[Realtime] Channel status: ${status}`);
    });

  // --- POLLING (primary, reliable) ---
  // Poll every 2 seconds for any device with a non-null voice_query_url
  let pollingActive = false;
  
  async function pollForVoiceQueries() {
    if (pollingActive) return; // Prevent overlapping polls
    pollingActive = true;
    
    try {
      const { data: devices, error } = await supabase
        .from('devices')
        .select('id, voice_query_url')
        .not('voice_query_url', 'is', null);
      
      if (error) {
        // Silently skip on transient errors
        return;
      }
      
      for (const device of (devices || [])) {
        if (device.voice_query_url) {
          console.log(`[Poll] Found pending voice query for device ${device.id.substring(0, 8)}...`);
          handleVoiceInput(device.id, device.voice_query_url);
        }
      }
    } catch (err) {
      console.error('[Poll] Error:', err.message);
    } finally {
      pollingActive = false;
    }
  }
  
  // Start polling every 500ms for ultra-low latency response
  setInterval(pollForVoiceQueries, 500);
  console.log("[Poll] Polling every 500ms for voice queries.");
  console.log("DESKIMON AI Daemon is running. Press Ctrl+C to stop.\n");
  
  // Periodic status report
  setInterval(() => {
    console.log(`[Status] Active conversations: ${conversations.activeCount}`);
  }, 60000);
}

run();
