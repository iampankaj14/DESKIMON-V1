const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');
const { matchIntent } = require('./intent_matcher');
const memorySystem = require('./memory_system');

const logPath = '/Users/pankaj/.gemini/antigravity-ide/brain/9c9118d6-587a-4a6e-80e1-aebc29f5591c/.system_generated/tasks/task-2007.log';
const sampleWavPath = path.join(__dirname, '../components/espressif__esp-sr/esp-tts/samples/S1_xiaole_speed0.wav');
const deviceId = 'a800f38b-test-latency';

if (!fs.existsSync(sampleWavPath)) {
  console.error(`Error: Sample WAV not found at ${sampleWavPath}`);
  process.exit(1);
}

const audioBuffer = fs.readFileSync(sampleWavPath);

function getLogOffset() {
  if (!fs.existsSync(logPath)) return 0;
  return fs.statSync(logPath).size;
}

function readNewLogLines(startOffset) {
  if (!fs.existsSync(logPath)) return '';
  const fd = fs.openSync(logPath, 'r');
  const size = fs.statSync(logPath).size;
  if (size <= startOffset) {
    fs.closeSync(fd);
    return '';
  }
  const buffer = Buffer.alloc(size - startOffset);
  fs.readSync(fd, buffer, 0, size - startOffset, startOffset);
  fs.closeSync(fd);
  return buffer.toString('utf8');
}

async function sendVoiceRequest() {
  const startOffset = getLogOffset();
  const startTime = Date.now();

  const response = await fetch('https://duplicate-variance-nitrogen-prix.trycloudflare.com/api/voice', {
    method: 'POST',
    headers: {
      'x-device-id': deviceId,
      'x-device-battery': '4.15',
      'x-device-wifi-ssid': 'test-wifi',
      'x-device-wifi-rssi': '-50',
      'x-device-volume': '100',
      'x-device-boot-count': '10'
    },
    body: audioBuffer
  });

  if (!response.ok) {
    throw new Error(`Server returned HTTP ${response.status}: ${await response.text()}`);
  }

  const mp3Buffer = await response.arrayBuffer();
  const endTime = Date.now();
  const clientLatency = endTime - startTime;

  // Wait for server logs to sync/write
  await new Promise(resolve => setTimeout(resolve, 500));
  const newLogs = readNewLogLines(startOffset);

  return { clientLatency, mp3Size: mp3Buffer.byteLength, newLogs };
}

function parseMetrics(clientLatency, mp3Size, logs) {
  // Parse metrics from logs using regex
  // 1. Upload
  const uploadMatch = logs.match(/Received \d+ bytes in (\d+)ms/);
  const upload = uploadMatch ? parseInt(uploadMatch[1], 10) : 0;

  // 2. STT
  const sttMatch = logs.match(/Groq transcription succeeded in (\d+)ms/);
  const stt = sttMatch ? parseInt(sttMatch[1], 10) : 0;

  // 3. Intent & Memory (measured locally in script since they are extremely fast)
  const intentStart = performance.now();
  const textMatch = "欢迎使用乐新与合成为"; // transcription text of the sample WAV
  const intentRes = matchIntent(textMatch, { battery: '4.15', wifiSsid: 'test-wifi', wifiRssi: '-50', volume: '100', bootCount: '10' });
  const intentTime = performance.now() - intentStart;

  const memStart = performance.now();
  memorySystem.retrieveRelevantMemories(deviceId, textMatch, 2);
  const memTime = performance.now() - memStart;

  // 4. Gemini
  const geminiMatch = logs.match(/Gemini \([^)]+\) response in (\d+)ms/);
  const gemini = geminiMatch ? parseInt(geminiMatch[1], 10) : 0;

  // 5. TTS
  const ttsMatch = logs.match(/Generation Time: (\d+) ms/) || logs.match(/TTS process completed in (\d+)ms/);
  const tts = ttsMatch ? parseInt(ttsMatch[1], 10) : 0;

  // 6. Return Time
  // Total client latency minus: Upload time + Server Processing Time
  const serverProcessingMatch = logs.match(/Total processing: (\d+)ms/) || logs.match(/totalMs: (\d+)/);
  const serverProcessing = serverProcessingMatch ? parseInt(serverProcessingMatch[1] || serverProcessingMatch[2], 10) : clientLatency - upload;
  const returnTime = Math.max(0, clientLatency - upload - serverProcessing);

  return {
    upload,
    stt,
    intent: parseFloat(intentTime.toFixed(3)),
    memory: parseFloat(memTime.toFixed(3)),
    gemini,
    tts,
    returnTime,
    total: clientLatency
  };
}

async function runAudit() {
  console.log("==================================================");
  console.log("STARTING LATENCY AUDIT (20 RUNS)...");
  console.log("==================================================");

  const runs = [];
  for (let i = 0; i < 20; i++) {
    process.stdout.write(`Run ${i + 1}/20... `);
    try {
      const { clientLatency, mp3Size, newLogs } = await sendVoiceRequest();
      const metrics = parseMetrics(clientLatency, mp3Size, newLogs);
      runs.push(metrics);
      console.log(`Success (Total Client Latency: ${clientLatency}ms)`);
      
      // Print this specific run's report
      console.log("----------------------------------");
      console.log(`Upload: ${metrics.upload} ms`);
      console.log(`STT: ${metrics.stt} ms`);
      console.log(`Intent: ${metrics.intent} ms`);
      console.log(`Memory: ${metrics.memory} ms`);
      console.log(`Gemini: ${metrics.gemini} ms`);
      console.log(`TTS: ${metrics.tts} ms`);
      console.log(`Return: ${metrics.returnTime} ms`);
      console.log(`Total: ${metrics.total} ms`);
      console.log("----------------------------------");
      
      // Delay to avoid Gemini API Rate Limits (5 seconds)
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

  // Calculate averages
  const avg = (key) => runs.reduce((acc, r) => acc + r[key], 0) / runs.length;

  const avgUpload = avg('upload');
  const avgSTT = avg('stt');
  const avgIntent = avg('intent');
  const avgMemory = avg('memory');
  const avgGemini = avg('gemini');
  const avgTTS = avg('tts');
  const avgReturn = avg('returnTime');
  const avgTotal = avg('total');

  console.log("\n==================================================");
  console.log("LATENCY REPORT (AVERAGE OVER 20 RUNS)");
  console.log("==================================================");
  console.log(`Upload: ${avgUpload.toFixed(1)} ms`);
  console.log(`STT: ${avgSTT.toFixed(1)} ms`);
  console.log(`Intent: ${avgIntent.toFixed(3)} ms`);
  console.log(`Memory: ${avgMemory.toFixed(3)} ms`);
  console.log(`Gemini: ${avgGemini.toFixed(1)} ms`);
  console.log(`TTS: ${avgTTS.toFixed(1)} ms`);
  console.log(`Return: ${avgReturn.toFixed(1)} ms`);
  console.log(`Total: ${avgTotal.toFixed(1)} ms`);
  console.log("==================================================");
  
  // Save results to file for artifact generation
  const results = {
    avgUpload,
    avgSTT,
    avgIntent,
    avgMemory,
    avgGemini,
    avgTTS,
    avgReturn,
    avgTotal,
    runs
  };
  fs.writeFileSync(path.join(__dirname, 'latency_results.json'), JSON.stringify(results, null, 2));
}

runAudit().catch(err => {
  console.error("Latency audit execution error:", err);
});
