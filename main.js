/**
 * main.js
 *
 * This is the entry point file showing how to integrate the API Key Rotation system
 * into your codebase.
 */

// Step 1: Import the key rotation pool files
const { discoverKeys } = require('./config/key_discovery');
const { PoolManager, callWithFailover } = require('./provider_pool/pool_manager');
const recoveryWorker = require('./provider_pool/recovery_worker');

// Step 2: Set up environment variables (For demo, we populate mock keys in process.env)
process.env.GEMINI_KEY_1 = "key_first_rate_limited";
process.env.GEMINI_KEY_2 = "key_second_invalid_auth";
process.env.GEMINI_KEY_3 = "key_third_successful";

// Step 3: Discover keys and initialize the pool manager
// This scans for GEMINI_KEY_1, GEMINI_KEY_2, etc. automatically
const geminiKeys = discoverKeys('GEMINI_KEY');
const geminiPool = new PoolManager('LLM_GEMINI', geminiKeys);

// Step 4: Register a health check function for self-healing
// This will periodically check keys on cooldown to see if they are usable again.
recoveryWorker.register(geminiPool, async (keyValue) => {
  console.log(`[Healthcheck] Verifying if key "${keyValue}" is working...`);
  // Simulated check logic:
  return keyValue !== "key_second_invalid_auth"; // key 2 is permanently dead, others can recover
});

// Start the background self-healing worker to run every 10 seconds (default is 30s)
recoveryWorker.start(10000);

// Step 5: Wrap your API calling logic inside callWithFailover
async function callGeminiAPI(prompt, apiKey) {
  // Simulate calling Gemini API
  console.log(`[API Request] Attempting call with key: "${apiKey}"...`);
  
  if (apiKey === "key_first_rate_limited") {
    // Simulated Rate Limit error
    throw new Error("HTTP 429: Too Many Requests / Rate Limit Exceeded");
  }
  
  if (apiKey === "key_second_invalid_auth") {
    // Simulated Authentication error
    throw new Error("HTTP 401: Unauthorized API Key");
  }
  
  if (apiKey === "key_third_successful") {
    // Success scenario
    return {
      text: `Mock response for prompt: "${prompt}"`
    };
  }
  
  throw new Error("HTTP 500: Server Error");
}

// Step 6: Define a wrapper function that uses key rotation
async function getGeminiResponse(prompt) {
  const result = await callWithFailover(geminiPool, async (apiKey) => {
    // Inside the wrapper, call the API using the current active key
    return await callGeminiAPI(prompt, apiKey);
  });
  
  if (result.ok) {
    console.log(`[Success] API Response:`, result.data.text);
    return result.data.text;
  } else {
    console.error(`[Error] All API keys in the pool failed!`);
    return "Canned Response: System is offline. Please try again later.";
  }
}

// Step 7: Run the logic
async function run() {
  console.log("\n--- Running prompt request #1 ---");
  await getGeminiResponse("Tell me a space joke.");

  console.log("\n--- Running prompt request #2 ---");
  await getGeminiResponse("Tell me another joke.");
  
  // Clean up background timer so the process can exit
  recoveryWorker.stop();
}

run().catch(console.error);
