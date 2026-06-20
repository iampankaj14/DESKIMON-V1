/**
 * demo.js
 *
 * Simulates a multi-key API service (e.g., Gemini LLM call)
 * using the key discovery, error classifier, pool manager, and recovery worker modules.
 */

const { discoverKeys } = require('./config/key_discovery');
const { PoolManager, callWithFailover, KEY_STATE } = require('./provider_pool/pool_manager');
const recoveryWorker = require('./provider_pool/recovery_worker');

// 1. Setup mock environment keys to simulate dynamic discovery
const mockEnv = {
  GEMINI_KEY_1: "key_first_rate_limited",
  GEMINI_KEY_2: "key_second_invalid_auth",
  GEMINI_KEY_3: "key_third_successful",
};

console.log("=== STEP 1: Key Discovery ===");
const discoveredKeys = discoverKeys("GEMINI_KEY", mockEnv);
console.log("Discovered Gemini Keys:", discoveredKeys);
console.log("");

// 2. Initialize the Pool Manager
console.log("=== STEP 2: Pool Manager Initialization ===");
const geminiPool = new PoolManager("LLM_GEMINI", discoveredKeys);
console.log("Initial Pool Status:", JSON.stringify(geminiPool.getStatus(), null, 2));
console.log("");

// 3. Register with Recovery Worker (using a mock healthcheck)
console.log("=== STEP 3: Registering with Recovery Worker ===");
recoveryWorker.register(geminiPool, async (keyValue) => {
  console.log(`[HealthCheck] Pinging health check for key: ${keyValue}...`);
  // Mock check: let's say the rate-limited key becomes healthy again, but the auth key remains dead.
  if (keyValue === "key_first_rate_limited") {
    return true; // Healthy
  }
  return false; // Unhealthy
});
console.log("");

// 4. Define a simulated API call function
// This function throws standard HTTP status code errors depending on which key is passed
async function mockGeminiApiCall(prompt, apiKey) {
  console.log(`[API Call] Trying to call Gemini API with key: "${apiKey}"...`);
  
  if (apiKey === "key_first_rate_limited") {
    throw new Error("HTTP 429: Rate limit exceeded. Please retry later.");
  }
  
  if (apiKey === "key_second_invalid_auth") {
    throw new Error("HTTP 401: Unauthorized API key.");
  }
  
  if (apiKey === "key_third_successful") {
    return {
      status: 200,
      data: `Successfully generated response for "${prompt}" using key_third_successful.`
    };
  }
  
  throw new Error("HTTP 500: Unknown server error.");
}

// 5. Execute failover call
console.log("=== STEP 4: First Attempt - Expecting Failover ===");
async function runDemo() {
  const prompt = "What is the speed of gravity?";
  
  console.log("Sending API request...");
  const result1 = await callWithFailover(geminiPool, async (key) => {
    return await mockGeminiApiCall(prompt, key);
  });
  
  console.log("\nCall Result 1:", result1);
  console.log("\nPool Status after Call 1:", JSON.stringify(geminiPool.getStatus(), null, 2));
  console.log("");

  // 6. Execute second call
  console.log("=== STEP 5: Second Attempt - Expecting Immediate Success with Key #3 ===");
  console.log("Sending second API request...");
  const result2 = await callWithFailover(geminiPool, async (key) => {
    return await mockGeminiApiCall(prompt, key);
  });
  
  console.log("\nCall Result 2:", result2);
  console.log("\nPool Status after Call 2:", JSON.stringify(geminiPool.getStatus(), null, 2));
  console.log("");

  // 7. Simulating time passing/recovery loop trigger
  console.log("=== STEP 6: Simulating Recovery Check ===");
  console.log("Manually shortening Key #1 cooldown to trigger immediate recovery testing...");
  const key1 = geminiPool._keys.find(k => k.value === "key_first_rate_limited");
  if (key1) {
    key1.coolingUntil = Date.now() - 1000; // back to the past so cooldown is expired
  }

  console.log("Running recovery cycle...");
  await recoveryWorker._runCycle();

  console.log("\nPool Status after Recovery cycle:", JSON.stringify(geminiPool.getStatus(), null, 2));
  console.log("");

  // 8. Execute third call (Key #1 should be available again and round-robin chosen)
  console.log("=== STEP 7: Third Attempt - Expecting Key #1 to retry (mock healthy) ===");
  // Let's modify the API behavior for Key #1 so it now succeeds
  const mockGeminiApiCallUpdated = async (prompt, apiKey) => {
    if (apiKey === "key_first_rate_limited") {
      return {
        status: 200,
        data: `Successfully generated response using RECOVERED key_first_rate_limited.`
      };
    }
    return await mockGeminiApiCall(prompt, apiKey);
  };

  console.log("Sending third API request...");
  const result3 = await callWithFailover(geminiPool, async (key) => {
    return await mockGeminiApiCallUpdated(prompt, key);
  });

  console.log("\nCall Result 3:", result3);
  console.log("\nFinal Pool Status:", JSON.stringify(geminiPool.getStatus(), null, 2));
}

runDemo().catch(console.error);
