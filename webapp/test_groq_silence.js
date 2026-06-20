const fs = require('fs');
const path = require('path');
const GroqSTTProvider = require('./providers/groq_provider');

// Load API key from .env.local
const envPath = path.join(__dirname, '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) {
      env[parts[0].trim()] = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
    }
  });
}

const GROQ_API_KEY = env.NEXT_PUBLIC_GROQ_API_KEY;
if (!GROQ_API_KEY) {
  console.error("Error: NEXT_PUBLIC_GROQ_API_KEY is not configured.");
  process.exit(1);
}

// Generate 2 seconds of silent 16kHz 16-bit Mono PCM audio
// 2 seconds * 16000 samples/sec * 2 bytes/sample = 64000 bytes
const sampleRate = 16000;
const numChannels = 1;
const bitsPerSample = 16;
const dataSize = 2 * sampleRate * numChannels * (bitsPerSample / 8);
const wavSize = 44 + dataSize;
const buffer = Buffer.alloc(wavSize);

// Write WAV header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(wavSize - 8, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1 size
buffer.writeUInt16LE(1, 20); // audio format (PCM)
buffer.writeUInt16LE(numChannels, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // byte rate
buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // block align
buffer.writeUInt16LE(bitsPerSample, 34);
buffer.write('data', 36);
buffer.writeUInt32LE(dataSize, 40);

// Leave data chunk as zeros (silence)

const groqSTT = new GroqSTTProvider(GROQ_API_KEY);

async function test() {
  console.log("Transcribing 2 seconds of silent WAV audio using Groq Whisper...");
  try {
    const transcript = await groqSTT.transcribe(buffer);
    console.log(`Transcript: "${transcript}"`);
  } catch (err) {
    console.error("Error transcribing silence:", err.message);
  }
}

test();
