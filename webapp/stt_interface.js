/**
 * Base abstract class for Speech-To-Text (STT) Providers.
 */
class STTProvider {
  /**
   * Transcribe raw audio buffer (WAV format) into plain text.
   * @param {Buffer} audioBuffer - WAV audio bytes
   * @returns {Promise<string>} Plain text transcription
   */
  async transcribe(audioBuffer) {
    throw new Error("Method 'transcribe(audioBuffer)' must be implemented by subclasses.");
  }
}

module.exports = STTProvider;
