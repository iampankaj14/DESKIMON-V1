const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const GroqSTTProvider = require('./providers/groq_provider');
const TTSProvider = require('./tts_provider');
const { matchIntent } = require('./intent_matcher');
const memorySystem = require('./memory_system');

// Load env
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

const GEMINI_API_KEY = env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GROQ_API_KEY = env.NEXT_PUBLIC_GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY || env.GROQ_API_KEY || process.env.GROQ_API_KEY;
const CARTESIA_API_KEY = env.CARTESIA_API_KEY || process.env.CARTESIA_API_KEY;
const CARTESIA_VOICE_NAME = env.CARTESIA_VOICE_NAME || process.env.CARTESIA_VOICE_NAME || 'Nolan';

const sampleWavPath = path.join(__dirname, '../components/espressif__esp-sr/esp-tts/samples/S1_xiaole_speed0.wav');
const audioBuffer = fs.readFileSync(sampleWavPath);
const deviceId = 'a800f38b-audit-api';

const groqSTT = new GroqSTTProvider(GROQ_API_KEY);
const ttsProvider = new TTSProvider({
  provider: 'cartesia',
  cartesiaApiKey: CARTESIA_API_KEY,
  cartesiaVoiceName: CARTESIA_VOICE_NAME
});

async function measureUploadTime() {
  const start = performance.now();
  // Simulate uploading 69KB to server health endpoint
  const res = await fetch('https://duplicate-variance-nitrogen-prix.trycloudflare.com/health', {
    method: 'POST',
    body: audioBuffer
  });
  await res.text();
  return performance.now() - start;
}

async function measureReturnTime(mp3Buffer) {
  const start = performance.now();
  // Simulate returning the MP3 buffer to client by posting it to local health endpoint
  const res = await fetch('https://duplicate-variance-nitrogen-prix.trycloudflare.com/health', {
    method: 'POST',
    body: mp3Buffer
  });
  await res.text();
  return performance.now() - start;
}

async function runSingleTest(phrase) {
  // 1. Audio Upload
  const uploadTime = await measureUploadTime();

  // 2. Groq STT
  const sttStart = performance.now();
  const transcribedText = await groqSTT.transcribe(audioBuffer);
  const sttTime = performance.now() - sttStart;

  // 3. Intent Matching
  const intentStart = performance.now();
  const intentResult = matchIntent(phrase, {});
  const intentTime = performance.now() - intentStart;

  // 4. Memory Retrieval
  const memStart = performance.now();
  const memoryContext = memorySystem.getMemoryContextPrompt(deviceId);
  const relevantMems = memorySystem.retrieveRelevantMemories(deviceId, phrase, 2);
  const memTime = performance.now() - memStart;

  // Prepare Gemini Request
  const requestBody = {
    systemInstruction: {
      parts: [{
        text: "You are DESKIMON, a smart, funny, and expressive desk companion. Real-time chat. Extremely brief."
      }]
    },
    contents: [{ role: 'user', parts: [{ text: phrase }] }]
  };

  // 5. Gemini Request Start
  const geminiStart = performance.now();

  // Call Gemini Stream (to get First Token Time)
  const streamUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:streamGenerateContent?key=${GEMINI_API_KEY}`;
  const streamRes = await fetch(streamUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  let firstTokenTime = 0;
  let streamCompleteTime = 0;

  if (streamRes.ok) {
    for await (const chunk of streamRes.body) {
      if (!firstTokenTime) {
        firstTokenTime = performance.now() - geminiStart;
      }
    }
    streamCompleteTime = performance.now() - geminiStart;
  }

  // Call Gemini Unary (to get Unary Completion Time)
  const unaryUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`;
  const unaryStart = performance.now();
  const unaryRes = await fetch(unaryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  let aiResponse = "Hello!";
  if (unaryRes.ok) {
    const resJson = await unaryRes.json();
    aiResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || aiResponse;
  }
  const unaryCompleteTime = performance.now() - unaryStart;

  // 6. Cartesia TTS
  const ttsStart = performance.now();
  const mp3Buffer = await ttsProvider.synthesize(aiResponse);
  const ttsTime = performance.now() - ttsStart;

  // 7. Audio Return
  const returnTime = await measureReturnTime(mp3Buffer);

  const total = uploadTime + sttTime + intentTime + memTime + unaryCompleteTime + ttsTime + returnTime;

  return {
    upload: uploadTime,
    stt: sttTime,
    intent: intentTime,
    memory: memTime,
    geminiStart: 0, // Request starts immediately
    geminiFirstToken: firstTokenTime,
    geminiCompletion: unaryCompleteTime,
    tts: ttsTime,
    returnTime: returnTime,
    total: total
  };
}

async function main() {
  console.log("==================================================");
  console.log("STARTING API-BASED LATENCY AUDIT (20 RUNS)...");
  console.log("==================================================");

  const phrases = [
    "What is the meaning of quantum computing?",
    "Tell me an interesting space fact.",
    "Do you think robots will take over the world?",
    "What is your favorite book?",
    "Why do stars twinkle in the night sky?",
    "How does a nuclear reactor work?",
    "Explain photosynthesis to a five-year-old.",
    "What is the distance between Earth and Mars?",
    "Tell me a story about a dragon and a wizard.",
    "What is the capital of France?",
    "How do computers store data?",
    "What is the speed of light in a vacuum?",
    "Who painted the Mona Lisa?",
    "What is the history of the internet?",
    "Can you give me a recipe for chocolate cake?",
    "How do birds migrate across oceans?",
    "What causes earthquakes in the Earth's crust?",
    "Explain the concept of blockchain.",
    "Tell me a riddle that is hard to solve.",
    "What is the chemical formula for water?"
  ];

  const runs = [];

  for (let i = 0; i < 20; i++) {
    const phrase = phrases[i];
    process.stdout.write(`Run ${i + 1}/20: "${phrase.substring(0, 30)}..." `);
    try {
      const metrics = await runSingleTest(phrase);
      runs.push(metrics);
      console.log(`Success (Total: ${metrics.total.toFixed(0)}ms)`);
      
      // Delay to respect rate limits (5 seconds)
      if (i < 19) {
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    } catch (err) {
      console.log(`FAILED: ${err.message}`);
    }
  }

  if (runs.length === 0) {
    console.error("All runs failed.");
    process.exit(1);
  }

  const avg = (key) => runs.reduce((acc, r) => acc + r[key], 0) / runs.length;

  console.log("\n==================================================");
  console.log("LATENCY REPORT (AVERAGE OVER 20 RUNS)");
  console.log("==================================================");
  console.log(`Upload: ${avg('upload').toFixed(1)} ms`);
  console.log(`STT: ${avg('stt').toFixed(1)} ms`);
  console.log(`Intent: ${avg('intent').toFixed(3)} ms`);
  console.log(`Memory: ${avg('memory').toFixed(3)} ms`);
  console.log(`Gemini Request Start: 0.0 ms`);
  console.log(`Gemini First Token: ${avg('geminiFirstToken').toFixed(1)} ms`);
  console.log(`Gemini Completion: ${avg('geminiCompletion').toFixed(1)} ms`);
  console.log(`TTS: ${avg('tts').toFixed(1)} ms`);
  console.log(`Return: ${avg('returnTime').toFixed(1)} ms`);
  console.log(`Total: ${avg('total').toFixed(1)} ms`);
  console.log("==================================================");

  // Save detailed results to JSON
  fs.writeFileSync(path.join(__dirname, 'latency_results_api.json'), JSON.stringify(runs, null, 2));
}

main().catch(err => {
  console.error("Latency audit execution error:", err);
});
