const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { matchIntent } = require('./intent_matcher');
const TTSProvider = require('./tts_provider');
const memorySystem = require('./memory_system');
const milestoneSystem = require('./milestone_system');

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

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const GEMINI_API_KEY = env.NEXT_PUBLIC_GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Error: Supabase configuration is missing from .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Conversation manager mock
const conversations = {
  sessions: new Map(),
  getOrCreate(deviceId) {
    let session = this.sessions.get(deviceId);
    if (!session) {
      session = { turns: [], lastActive: Date.now() };
      this.sessions.set(deviceId, session);
    }
    return session;
  },
  addTurn(deviceId, user, model) {
    const session = this.getOrCreate(deviceId);
    session.turns.push({ role: 'user', text: user });
    session.turns.push({ role: 'model', text: model });
  }
};

const ttsProvider = new TTSProvider({
  provider: env.TTS_PROVIDER || 'cartesia',
  cartesiaApiKey: env.CARTESIA_API_KEY,
  cartesiaVoiceName: env.CARTESIA_VOICE_NAME || 'Nolan'
});

// Ported processVoiceAudio code from server_daemon.js
async function traceVoiceAudio(deviceId, transcribedText, deviceState = {}) {
  const startTime = Date.now();
  const session = conversations.getOrCreate(deviceId);
  const turnNumber = Math.floor(session.turns.length / 2) + 1;
  const isFollowUp = session.turns.length > 0;

  console.log(`\n==================== [TRACE ROUTING START: "${transcribedText}"] ====================`);
  console.log(`[Voice] ${isFollowUp ? 'FOLLOW-UP' : 'NEW CONVERSATION'} — Turn #${turnNumber}`);

  let aiResponse = null;
  let isLocalMatch = false;
  let bestIntent = "NONE";
  let bestScore = 0.0;

  // Auto-detect milestone / store memory + add XP for interaction
  let milestoneResult = null;
  if (transcribedText) {
    try {
      milestoneResult = milestoneSystem.detectAndCelebrateMilestone(deviceId, transcribedText);
      if (!milestoneResult) {
        memorySystem.detectAndStoreMemory(deviceId, transcribedText);
      }
      memorySystem.addXP(deviceId, 1); // 1 XP per query
    } catch (err) {
      console.error("[MemorySystem/MilestoneSystem] Error:", err.message);
    }
  }

  // 2. Intent Matching / Milestone Celebration
  if (milestoneResult) {
    console.log(`[Milestone Celebration] Type: ${milestoneResult.type}`);
    aiResponse = milestoneResult.response;
    isLocalMatch = true;
    bestIntent = milestoneResult.type;
    bestScore = 1.0;
  } else if (transcribedText) {
    const intentResult = matchIntent(transcribedText, deviceState);
    bestIntent = intentResult.intent || "NONE";
    bestScore = intentResult.score || 0.0;
    if (intentResult.matched) {
      console.log(`[Intent Match] Intent: ${intentResult.intent} | Score: ${intentResult.score}`);
      aiResponse = intentResult.responseText;
      isLocalMatch = true;
    } else {
      console.log(`[Intent Miss] Best Candidate: ${intentResult.intent} | Score: ${intentResult.score}`);
    }
  }

  console.log(`[Routing Decision] STT transcript: "${transcribedText}"`);
  console.log(`[Routing Decision] Matched intent: "${bestIntent}"`);
  console.log(`[Routing Decision] Confidence score: ${bestScore}`);
  console.log(`[Routing Decision] Selected response path: ${isLocalMatch ? 'LOCAL_INTENT' : 'GEMINI_FALLBACK'}`);

  // 3. Fallback to Gemini if no local match
  if (!isLocalMatch) {
    const contents = [];
    for (const turn of session.turns) {
      contents.push({
        role: turn.role,
        parts: [{ text: turn.text }]
      });
    }

    const currentUserParts = [{ text: transcribedText }];
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

    const memoryContext = memorySystem.getMemoryContextPrompt(deviceId);
    const relevantMems = memorySystem.retrieveRelevantMemories(deviceId, transcribedText, 2);
    let memorySnippet = "";
    if (relevantMems.length > 0) {
      memorySnippet = "\n[Highly Relevant User Memories to reference if appropriate]:\n" + 
        relevantMems.map(m => `- [${m.category}] ${m.content}`).join("\n");
    }

    const requestBody = {
      systemInstruction: {
        parts: [{
          text: "You are DESKIMON, a smart, funny, and expressive desk companion. " +
                "You are having a real-time voice conversation. " +
                "Keep every response extremely brief — maximum 120 characters, 1-2 short sentences. " +
                "Be engaging, witty.\n" +
                "Never mention that you're an AI or that you received audio data.\n\n" +
                `Current Relationship Context:\n${memoryContext}\n` +
                memorySnippet + "\n\nUse this context to naturally personalize your response if relevant, but do not force it."
        }]
      },
      contents
    };

    const modelsToTry = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        console.log(`[Gemini API] Invoking ${model}...`);
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
          console.log(`[Gemini API] SUCCESS from ${model}: "${aiResponse}"`);
          break;
        }
      } catch (err) {
        console.log(`[Gemini API] ERROR for ${model}: ${err.message}`);
        lastError = err;
      }
    }

    if (!aiResponse) {
      aiResponse = "Hello there! The Gemini API is currently rate limited, but my voice system is working. How does my speech sound now?";
    }
  }

  conversations.addTurn(deviceId, transcribedText, aiResponse);
  console.log(`[Final Response] "${aiResponse}"`);
  console.log("==================== [TRACE ROUTING END] ====================\n");
}

async function runTraces() {
  const deviceId = "test_device_12345";
  const queries = [
    "Suggest me a movie",
    "What is 17 multiplied by 23?",
    "Who is the president of France?",
    "Tell me a joke"
  ];

  for (const query of queries) {
    await traceVoiceAudio(deviceId, query);
  }
}

runTraces();
