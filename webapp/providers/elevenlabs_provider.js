/**
 * elevenlabs_provider.js
 *
 * ElevenLabs TTS adapter.
 * Interface: constructor(apiKey, voiceId) → async synthesize(text) → Buffer (MP3)
 *
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

class ElevenLabsProvider {
  /**
   * @param {string} apiKey  - ElevenLabs API key (xi-api-key header)
   * @param {string} voiceId - ElevenLabs voice ID
   */
  constructor(apiKey, voiceId) {
    if (!apiKey) throw new Error('[ElevenLabs] apiKey is required.');
    if (!voiceId) throw new Error('[ElevenLabs] voiceId is required.');
    this.apiKey = apiKey;
    this.voiceId = voiceId;
  }

  /**
   * Synthesize text to MP3 audio.
   * @param {string} text
   * @returns {Promise<Buffer>} MP3 audio buffer
   */
  async synthesize(text) {
    if (!text || text.trim().length === 0) {
      throw new Error('[ElevenLabs] Cannot synthesize empty text.');
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.apiKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg'
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`ElevenLabs API HTTP ${response.status}: ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);

    if (!buf || buf.length === 0) {
      throw new Error('[ElevenLabs] Received empty audio buffer.');
    }

    return buf;
  }
}

module.exports = ElevenLabsProvider;
