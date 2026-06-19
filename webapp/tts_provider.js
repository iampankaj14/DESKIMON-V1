const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
const ElevenLabsProvider = require('./providers/elevenlabs_provider');

class TTSProvider {
  constructor(config = {}) {
    this.primaryProviderName = (config.provider || 'elevenlabs').toLowerCase();
    this.elevenLabsApiKey = config.elevenLabsApiKey;
    this.elevenLabsVoiceId = config.elevenLabsVoiceId;
    this.edgeVoiceName = config.edgeVoiceName || 'en-US-AvaNeural';

    // Initialize providers
    if (this.elevenLabsApiKey && this.elevenLabsVoiceId) {
      this.elevenLabsProvider = new ElevenLabsProvider(
        this.elevenLabsApiKey,
        this.elevenLabsVoiceId
      );
    } else {
      this.elevenLabsProvider = null;
    }

    this.edgeTTS = new MsEdgeTTS();
  }

  async warmup() {
    // No pre-warming needed for ElevenLabs (stateless REST API)
    console.log('[TTS] ElevenLabs provider ready. No warmup required.');
  }

  async synthesize(text) {
    const startTime = Date.now();

    // ── Primary: ElevenLabs ──────────────────────────────────────────────
    if (this.elevenLabsProvider) {
      try {
        const audioBuffer = await this.elevenLabsProvider.synthesize(text);
        const timeMs = Date.now() - startTime;
        this._log({
          provider: 'ElevenLabs',
          voiceId: this.elevenLabsVoiceId,
          timeMs,
          size: audioBuffer.length,
          success: true
        });
        return audioBuffer;
      } catch (error) {
        console.warn(`[TTS] ElevenLabs failed: ${error.message}. Falling back to Edge TTS.`);
      }
    } else {
      console.warn('[TTS] ElevenLabs not configured (missing API key or voice ID). Falling back to Edge TTS.');
    }

    // ── Fallback: Edge TTS (free, no key required) ───────────────────────
    try {
      const fallbackStart = Date.now();
      const audioBuffer = await this._synthesizeEdge(text);
      const timeMs = Date.now() - fallbackStart;
      this._log({
        provider: 'Edge TTS (Fallback)',
        voiceId: this.edgeVoiceName,
        timeMs,
        size: audioBuffer.length,
        success: true
      });
      return audioBuffer;
    } catch (edgeError) {
      const totalMs = Date.now() - startTime;
      this._log({
        provider: 'Edge TTS (Fallback)',
        voiceId: this.edgeVoiceName,
        timeMs: totalMs,
        size: 0,
        success: false,
        failureReason: edgeError.message
      });
      throw new Error(`TTS generation failed entirely: ${edgeError.message}`);
    }
  }

  async _synthesizeEdge(text) {
    await this.edgeTTS.setMetadata(this.edgeVoiceName, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    const { audioStream } = this.edgeTTS.toStream(text, { rate: '+0%' });

    const chunks = [];
    await new Promise((resolve, reject) => {
      audioStream.on('data', (chunk) => chunks.push(chunk));
      audioStream.on('end', resolve);
      audioStream.on('error', reject);
    });

    return Buffer.concat(chunks);
  }

  _log({ provider, voiceId, timeMs, size, success, failureReason = '' }) {
    console.log(`[TTS] Provider: ${provider} | Voice: ${voiceId} | Time: ${timeMs}ms | Size: ${size} bytes | Success: ${success}${failureReason ? ` | Reason: ${failureReason}` : ''}`);
  }
}

module.exports = TTSProvider;
