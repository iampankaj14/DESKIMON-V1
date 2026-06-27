const TTSProvider = require('./tts_provider');
async function test() {
  const tts = new TTSProvider({ provider: 'elevenlabs' });
  try {
    const buf = await tts.synthesize("Hello from test");
    console.log("Success! Audio length:", buf.length);
  } catch (e) {
    console.error("FAILED:", e.message);
  }
}
test();
