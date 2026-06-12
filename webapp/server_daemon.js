const fs = require('fs');
const path = require('path');
const http = require('http');
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
const VOICE_API_PORT = parseInt(env.VOICE_API_PORT || process.env.VOICE_API_PORT || '3001', 10);

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
// CORE VOICE PROCESSING — Gemini + TTS (shared by both paths)
// ============================================================

/**
 * Process a voice audio buffer: send to Gemini, synthesize TTS, return MP3.
 * This is the core AI pipeline, independent of transport (HTTP or Supabase).
 *
 * @param {string} deviceId - Device UUID
 * @param {Buffer} audioBuffer - Raw WAV audio bytes
 * @returns {Promise<{mp3Buffer: Buffer, aiResponse: string}>}
 */
async function processVoiceAudio(deviceId, audioBuffer) {
  const startTime = Date.now();
  const session = conversations.getOrCreate(deviceId);
  const turnNumber = Math.floor(session.turns.length / 2) + 1;
  const isFollowUp = session.turns.length > 0;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`[Voice] ${isFollowUp ? 'FOLLOW-UP' : 'NEW CONVERSATION'} — Turn #${turnNumber} for device ${deviceId.substring(0, 8)}...`);
  console.log(`${'='.repeat(60)}`);

  // A. Build multi-turn Gemini request with conversation history
  const base64Audio = audioBuffer.toString('base64');
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

  // B. Call Gemini API
  const modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
  let aiResponse = null;
  let lastError = null;

  for (const model of modelsToTry) {
    try {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
      console.log(`[Voice] Calling Gemini API (${model})...`);
      const geminiStart = Date.now();
      const geminiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        throw new Error(`HTTP ${geminiRes.status}. Details: ${errText}`);
      }

      const resJson = await geminiRes.json();
      aiResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (aiResponse) {
        console.log(`[Voice] Gemini (${model}) response in ${Date.now() - geminiStart}ms: "${aiResponse}"`);
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

  // C. Synthesize Speech using Microsoft Edge TTS
  console.log("[Voice] Synthesizing response via Edge TTS...");
  const ttsStart = Date.now();

  const tts = new MsEdgeTTS();
  await tts.setMetadata("en-US-EmmaMultilingualNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  const { audioStream } = tts.toStream(aiResponse, { rate: "+40%" });

  // Collect stream into buffer (no temp file needed)
  const chunks = [];
  await new Promise((resolve, reject) => {
    audioStream.on('data', (chunk) => chunks.push(chunk));
    audioStream.on('end', resolve);
    audioStream.on('error', reject);
  });

  const mp3Buffer = Buffer.concat(chunks);
  const totalMs = Date.now() - startTime;
  console.log(`[Voice] TTS done in ${Date.now() - ttsStart}ms. MP3 size: ${mp3Buffer.length} bytes. Total processing: ${totalMs}ms`);

  return { mp3Buffer, aiResponse, isFollowUp, turnNumber, totalMs };
}

// ============================================================
// DIRECT HTTP VOICE API — ESP32 POSTs WAV, gets MP3 response
// Eliminates all Supabase storage round-trips (~4-9s savings)
// ============================================================

function startVoiceApiServer() {
  const server = http.createServer(async (req, res) => {
    // CORS headers for flexibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/api/voice') {
      const deviceId = req.headers['x-device-id'];
      if (!deviceId) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Missing X-Device-Id header');
        return;
      }

      console.log(`\n[HTTP API] Received direct voice request from device ${deviceId.substring(0, 8)}...`);
      const receiveStart = Date.now();

      // Collect the request body (WAV audio)
      const bodyChunks = [];
      req.on('data', (chunk) => bodyChunks.push(chunk));
      req.on('end', async () => {
        const audioBuffer = Buffer.concat(bodyChunks);
        console.log(`[HTTP API] Received ${audioBuffer.length} bytes in ${Date.now() - receiveStart}ms`);

        try {
          // Process audio: Gemini + TTS
          const result = await processVoiceAudio(deviceId, audioBuffer);

          // Return MP3 directly in response — no Supabase round-trip!
          res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': result.mp3Buffer.length,
            'X-AI-Response': Buffer.from(result.aiResponse).toString('base64'),
            'X-Processing-Ms': result.totalMs.toString()
          });
          res.end(result.mp3Buffer);

          console.log(`[HTTP API] Sent ${result.mp3Buffer.length} byte MP3 response. Total: ${result.totalMs}ms`);

          // Log interaction asynchronously (non-blocking)
          supabase
            .from('interactions')
            .insert({
              device_id: deviceId,
              interaction_type: 'voice',
              user_input: result.isFollowUp ? `[Follow-up #${result.turnNumber}]` : '[New conversation]',
              ai_response: result.aiResponse,
              emotion_triggered: 'happy',
              latency_ms: result.totalMs
            })
            .then(() => console.log(`[HTTP API] Interaction logged.`))
            .catch((err) => console.warn(`[HTTP API] Failed to log interaction:`, err.message));

        } catch (err) {
          console.error('[HTTP API] Error processing voice:', err.message);
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end(`Processing error: ${err.message}`);
        }
      });

      req.on('error', (err) => {
        console.error('[HTTP API] Request stream error:', err.message);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Request error');
      });

    } else if (req.method === 'GET' && req.url === '/health') {
      // Health check endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        activeConversations: conversations.activeCount,
        uptime: process.uptime()
      }));

    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    }
  });

  server.listen(VOICE_API_PORT, '0.0.0.0', () => {
    console.log(`\n[HTTP API] ⚡ Direct Voice API listening on port ${VOICE_API_PORT}`);
    console.log(`[HTTP API] ESP32 should POST WAV to http://<server-ip>:${VOICE_API_PORT}/api/voice`);
    console.log(`[HTTP API] Health check: http://localhost:${VOICE_API_PORT}/health\n`);
  });

  return server;
}

// ============================================================
// SUPABASE VOICE HANDLER — Legacy/fallback path
// Kept for backward compatibility and web dashboard triggers
// ============================================================

let lastProcessedUrl = null;

async function handleVoiceInput(deviceId, voiceQueryUrl) {
  // Deduplicate: skip if we just processed this exact URL
  if (voiceQueryUrl === lastProcessedUrl) {
    console.log(`[Voice] Skipping duplicate voice query URL for device ${deviceId.substring(0, 8)}...`);
    return;
  }
  lastProcessedUrl = voiceQueryUrl;

  console.log(`[Voice/Supabase] Processing via legacy Supabase path: ${voiceQueryUrl}`);

  try {
    // A. Download WAV file from Supabase Storage
    const downloadRes = await fetch(voiceQueryUrl);
    if (!downloadRes.ok) {
      throw new Error(`Failed to download audio file: HTTP ${downloadRes.status}`);
    }
    const audioBuffer = Buffer.from(await downloadRes.arrayBuffer());
    console.log(`[Voice/Supabase] Downloaded WAV file (${audioBuffer.length} bytes).`);

    // B. Process audio using shared pipeline
    const result = await processVoiceAudio(deviceId, audioBuffer);

    // C. Upload MP3 to Supabase Storage (legacy path still needs this)
    const storagePath = `responses/${deviceId}_response.mp3`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(storagePath, result.mp3Buffer, {
        contentType: 'audio/mpeg',
        upsert: true
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(storagePath);

    console.log(`[Voice/Supabase] Uploaded response MP3: ${publicUrl}`);

    // D. Update device_preferences audio_url to trigger ESP32 playback
    const { error: prefError } = await supabase
      .from('device_preferences')
      .update({ audio_url: publicUrl })
      .eq('device_id', deviceId);

    if (prefError) {
      throw prefError;
    }

    // E. Log interaction in db
    await supabase
      .from('interactions')
      .insert({
        device_id: deviceId,
        interaction_type: 'voice',
        user_input: result.isFollowUp ? `[Follow-up #${result.turnNumber}]` : '[New conversation]',
        ai_response: result.aiResponse,
        emotion_triggered: 'happy',
        latency_ms: result.totalMs
      });

    // F. Clear audio_url after delay
    setTimeout(async () => {
      await supabase
        .from('device_preferences')
        .update({ audio_url: null })
        .eq('device_id', deviceId);
      console.log(`[Voice/Supabase] Cleared preferences audio_url.`);
    }, 4000);

  } catch (err) {
    console.error("[Voice/Supabase] Error processing voice interaction:", err);
  } finally {
    // Reset voice_query_url
    console.log(`[Voice/Supabase] Resetting voice_query_url for next trigger...`);
    lastProcessedUrl = null;
    await supabase
      .from('devices')
      .update({ voice_query_url: null })
      .eq('id', deviceId);
  }
}

// 5. Main Loop — HTTP API + Polling + Realtime
async function run() {
  await authenticate();

  // Start the direct HTTP Voice API server
  startVoiceApiServer();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║   DESKIMON AI Daemon v3.0 — Direct API + Fallback     ║");
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
