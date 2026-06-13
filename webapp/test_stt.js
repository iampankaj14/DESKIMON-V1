const fs = require('fs');
const path = require('path');
const GeminiSTTProvider = require('./providers/gemini_provider');
const GroqSTTProvider = require('./providers/groq_provider');

// 1. Load Environment Variables from .env.local
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

const sampleWavPath = path.join(__dirname, '../components/espressif__esp-sr/esp-tts/samples/S1_xiaole_speed0.wav');

if (!fs.existsSync(sampleWavPath)) {
  console.error(`Error: Sample WAV not found at: ${sampleWavPath}`);
  process.exit(1);
}

const audioBuffer = fs.readFileSync(sampleWavPath);
console.log(`Loaded sample WAV file: ${sampleWavPath} (${audioBuffer.length} bytes)\n`);

async function runTests() {
  console.log("=========================================");
  console.log("TESTING GEMINI STT PROVIDER...");
  console.log("=========================================");
  if (!GEMINI_API_KEY) {
    console.error("❌ Skipped: GEMINI_API_KEY is not defined in .env.local");
  } else {
    try {
      const geminiSTT = new GeminiSTTProvider(GEMINI_API_KEY);
      const start = Date.now();
      const text = await geminiSTT.transcribe(audioBuffer);
      console.log(`✅ Success in ${Date.now() - start}ms!`);
      console.log(`Transcript: "${text}"\n`);
    } catch (err) {
      console.error("❌ Failed:", err.message);
    }
  }

  console.log("=========================================");
  console.log("TESTING GROQ STT PROVIDER...");
  console.log("=========================================");
  if (!GROQ_API_KEY) {
    console.warn("⚠️ Skipped: GROQ_API_KEY is not defined in .env.local (Configure it to test Groq Whisper)");
  } else {
    try {
      const groqSTT = new GroqSTTProvider(GROQ_API_KEY);
      const start = Date.now();
      const text = await groqSTT.transcribe(audioBuffer);
      console.log(`✅ Success in ${Date.now() - start}ms!`);
      console.log(`Transcript: "${text}"\n`);
    } catch (err) {
      console.error("❌ Failed:", err.message);
    }
  }
}

runTests();
