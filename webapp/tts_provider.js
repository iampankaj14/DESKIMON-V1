const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const CartesiaProvider = require('./providers/cartesia_provider');

class TTSProvider {
  constructor(config = {}) {
    this.primaryProviderName = (config.provider || 'cartesia').toLowerCase();
    this.cartesiaApiKey = config.cartesiaApiKey;
    this.cartesiaVoiceName = config.cartesiaVoiceName || 'Nolan';
    this.edgeVoiceName = config.edgeVoiceName || 'en-US-AvaNeural';

    // Initialize individual providers
    this.cartesiaProvider = new CartesiaProvider(this.cartesiaApiKey, this.cartesiaVoiceName);
    this.edgeTTS = new MsEdgeTTS();
  }

  async synthesize(text) {
    let chosenProvider = this.primaryProviderName;
    let chosenVoice = chosenProvider === 'cartesia' ? this.cartesiaVoiceName : this.edgeVoiceName;
    let success = false;
    let audioBuffer = null;
    let failureReason = '';
    const startTime = Date.now();

    // Try primary provider
    try {
      if (chosenProvider === 'cartesia') {
        if (!this.cartesiaApiKey) {
          throw new Error("Cartesia API Key is missing in configuration.");
        }
        audioBuffer = await this.cartesiaProvider.synthesize(text);
        success = true;
      } else {
        audioBuffer = await this._synthesizeEdge(text);
        success = true;
      }
    } catch (error) {
      console.warn(`[TTS] Primary provider (${chosenProvider}) failed: ${error.message}`);
      
      // Fallback to Edge TTS if Cartesia was primary and failed
      if (chosenProvider === 'cartesia') {
        console.log(`[TTS] Attempting fallback to Edge TTS...`);
        const fallbackStartTime = Date.now();
        try {
          audioBuffer = await this._synthesizeEdge(text);
          success = true;
          // Log instrument detail for the fallback case
          const fallbackTime = Date.now() - fallbackStartTime;
          this._logInstrumentation({
            provider: 'Edge TTS (Fallback)',
            voice: this.edgeVoiceName,
            timeMs: fallbackTime,
            size: audioBuffer ? audioBuffer.length : 0,
            success: true,
            failureReason: ''
          });
        } catch (edgeError) {
          failureReason = `Primary failed: ${error.message}. Fallback failed: ${edgeError.message}`;
          console.error(`[TTS] Fallback to Edge TTS also failed: ${edgeError.message}`);
        }
      } else {
        failureReason = error.message;
      }
    }

    const totalTime = Date.now() - startTime;

    if (!success) {
      // If we failed entirely, log total failure
      this._logInstrumentation({
        provider: chosenProvider,
        voice: chosenVoice,
        timeMs: totalTime,
        size: 0,
        success: false,
        failureReason: failureReason
      });
      throw new Error(`TTS generation failed: ${failureReason}`);
    }

    // Log instrument detail for primary (or whatever succeeded)
    if (success && !failureReason) { // Succeeded on primary
      this._logInstrumentation({
        provider: chosenProvider === 'cartesia' ? 'Cartesia TTS' : 'Edge TTS',
        voice: chosenVoice,
        timeMs: totalTime,
        size: audioBuffer ? audioBuffer.length : 0,
        success: true,
        failureReason: ''
      });
    }

    return audioBuffer;
  }

  async _synthesizeEdge(text) {
    await this.edgeTTS.setMetadata(this.edgeVoiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = this.edgeTTS.toStream(text, { rate: "+0%" });

    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    return Buffer.concat(chunks);
  }

  _logInstrumentation({ provider, voice, timeMs, size, success, failureReason }) {
    console.log(`[TTS]`);
    console.log(`Provider: ${provider}`);
    console.log(`Voice: ${voice}`);
    console.log(`Generation Time: ${timeMs} ms`);
    console.log(`Audio Size: ${size} bytes`);
    console.log(`Success: ${success}`);
    if (failureReason) {
      console.log(`Failure Reason: ${failureReason}`);
    }
  }
}

module.exports = TTSProvider;
