const STTProvider = require('../stt_interface');

class GeminiSTTProvider extends STTProvider {
  /**
   * @param {string} apiKey - Gemini API Key
   */
  constructor(apiKey) {
    super();
    this.apiKey = apiKey;
  }

  async transcribe(audioBuffer) {
    if (!this.apiKey) {
      throw new Error("Gemini API Key is not configured.");
    }

    const base64Audio = audioBuffer.toString('base64');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${this.apiKey}`;
    
    const body = {
      systemInstruction: {
        parts: [{ text: "You are a precise speech-to-text transcriber. Transcribe the user's audio verbatim. Do not correct grammar, do not add punctuation, do not answer the question, do not write anything else. Just transcribe." }]
      },
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64Audio
            }
          },
          { text: "Transcribe this audio file." }
        ]
      }]
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini STT API returned HTTP ${response.status}: ${errText}`);
    }

    const json = await response.json();
    return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  }
}

module.exports = GeminiSTTProvider;
