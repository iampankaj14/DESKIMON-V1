const STTProvider = require('../stt_interface');

class GroqSTTProvider extends STTProvider {
  /**
   * @param {string} apiKey - Groq API Key
   */
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer) {
    if (!this.apiKey) {
      throw new Error("Groq API Key is not configured.");
    }

    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: 'audio/wav' });
    formData.append('file', blob, 'audio.wav');
    formData.append('model', 'whisper-large-v3');
    formData.append('response_format', 'json');

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: formData
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Groq STT API returned HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json();
    return json.text ? json.text.trim() : "";
  }
}

module.exports = GroqSTTProvider;
