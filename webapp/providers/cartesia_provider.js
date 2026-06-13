const fs = require('fs');

class CartesiaProvider {
  constructor(apiKey, voiceName = 'Nolan') {
    this.apiKey = apiKey;
    this.voiceName = voiceName;
    this.resolvedVoiceId = null;
  }

  async _resolveVoiceId() {
    if (this.resolvedVoiceId) {
      return this.resolvedVoiceId;
    }

    if (!this.apiKey) {
      throw new Error("Cartesia API Key is missing.");
    }

    try {
      console.log(`[Cartesia] Resolving voice ID for name: "${this.voiceName}"...`);
      const response = await fetch('https://api.cartesia.ai/voices', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Cartesia-Version': '2024-06-10'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to list voices: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      // Handle either array or pagination format
      const voices = Array.isArray(result) ? result : (result.data || []);
      
      let match = voices.find(v => v.name && v.name.toLowerCase() === this.voiceName.toLowerCase());
      if (!match) {
        // Fallback to substring matching (e.g. "Nolan" matches "Nolan - Expressive Agent")
        match = voices.find(v => v.name && v.name.toLowerCase().includes(this.voiceName.toLowerCase()));
      }
      
      if (match) {
        this.resolvedVoiceId = match.id;
        console.log(`[Cartesia] Resolved voice "${this.voiceName}" to ID: ${this.resolvedVoiceId} ("${match.name}")`);
        return this.resolvedVoiceId;
      }

      console.warn(`[Cartesia] Voice name "${this.voiceName}" not found in Cartesia. Falling back to featured voice (Carson).`);
      // Fallback: Carson Curious Conversationalist
      this.resolvedVoiceId = 'ee8b13e7-98af-4b15-89d1-8d402be10c94';
      return this.resolvedVoiceId;
    } catch (error) {
      console.error(`[Cartesia] Error resolving voice ID: ${error.message}`);
      throw error;
    }
  }

  async synthesize(text) {
    const voiceId = await this._resolveVoiceId();
    
    console.log(`[Cartesia] Requesting speech for: "${text.substring(0, 60)}..."`);
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Cartesia-Version': '2024-06-10',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: 'sonic-3.5',
        transcript: text,
        voice: {
          mode: 'id',
          id: voiceId
        },
        output_format: {
          container: 'mp3',
          sample_rate: 24000,
          bit_rate: 96000
        }
      })
    });


    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cartesia API error: ${response.status} ${response.statusText} - ${errText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
}

module.exports = CartesiaProvider;
