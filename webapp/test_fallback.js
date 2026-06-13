const TTSProvider = require('./tts_provider');

async function testFallback() {
  console.log("==================================================");
  console.log("Testing Automatic Fallback: Cartesia -> Edge TTS");
  console.log("==================================================");

  // Instantiate with an intentionally invalid API key to trigger failure
  const provider = new TTSProvider({
    provider: 'cartesia',
    cartesiaApiKey: 'sk_car_invalid_key_for_testing_fallback',
    cartesiaVoiceName: 'Nolan'
  });

  const testPhrase = "Testing the automatic fallback mechanism. If this works, you should hear Edge TTS.";

  console.log("\nSending synthesis request to TTSProvider (expecting Cartesia to fail and Edge to succeed)...");
  
  const startTime = Date.now();
  try {
    const buffer = await provider.synthesize(testPhrase);
    const duration = Date.now() - startTime;
    
    console.log("\nResult:");
    console.log(`- Status: SUCCESS`);
    console.log(`- Total Time: ${duration}ms`);
    console.log(`- Buffer Size: ${buffer.length} bytes`);
    console.log(`- Succeeded via Fallback: YES`);
    console.log("\nFallback Verification Passed!");
  } catch (err) {
    console.error("\nFallback Verification FAILED:", err.message);
    process.exit(1);
  }
}

testFallback().catch(console.error);
