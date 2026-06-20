const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

// Config
const serverScript = path.join(__dirname, 'server_daemon.js');
const deviceId = 'a800f38b-2697-49dd-8331-a300c603deba';
const tests = [
  { file: 'movie.mp3', label: 'Suggest me a movie' },
  { file: 'math.mp3', label: 'What is 17 multiplied by 23?' },
  { file: 'france.mp3', label: 'Who is the president of France?' },
  { file: 'joke.mp3', label: 'Tell me a joke' }
];

async function sendRequest(test) {
  const filePath = path.join(__dirname, test.file);
  const audioBuffer = fs.readFileSync(filePath);

  console.log(`\n[Test Runner] Sending audio file "${test.file}" for query: "${test.label}" (${audioBuffer.length} bytes)...`);

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 3001,
      path: '/api/voice',
      method: 'POST',
      headers: {
        'x-device-id': deviceId,
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.length
      }
    }, (res) => {
      let bodyChunks = [];
      res.on('data', (chunk) => bodyChunks.push(chunk));
      res.on('end', () => {
        const resBody = Buffer.concat(bodyChunks);
        const b64Response = res.headers['x-ai-response'];
        const textResponse = b64Response ? Buffer.from(b64Response, 'base64').toString('utf8') : '';
        const processingMs = res.headers['x-processing-ms'];
        
        console.log(`[Test Runner] Response received! Status: ${res.statusCode}`);
        console.log(`[Test Runner] X-AI-Response (decoded): "${textResponse}"`);
        console.log(`[Test Runner] X-Processing-Ms: ${processingMs}ms`);
        resolve({
          status: res.statusCode,
          text: textResponse,
          processingMs
        });
      });
    });

    req.on('error', (err) => {
      console.error(`[Test Runner] HTTP Request Error:`, err.message);
      reject(err);
    });

    req.write(audioBuffer);
    req.end();
  });
}

async function run() {
  console.log("[Test Runner] Starting server daemon...");
  const daemon = spawn('node', [serverScript], {
    cwd: __dirname,
    stdio: 'inherit' // Pipe server logs directly to our terminal so we see trace logs!
  });

  // Give the daemon 3 seconds to start up
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    for (const test of tests) {
      await sendRequest(test);
      // Wait 2 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (err) {
    console.error("[Test Runner] Error during test runner execution:", err.message);
  } finally {
    console.log("\n[Test Runner] Stopping server daemon...");
    daemon.kill();
    // Wait a bit to ensure it cleaned up
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log("[Test Runner] Finished.");
  }
}

run();
