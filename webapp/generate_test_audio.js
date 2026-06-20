const fs = require('fs');
const path = require('path');
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const queries = {
  "movie": "Suggest me a movie",
  "math": "What is 17 multiplied by 23?",
  "france": "Who is the president of France?",
  "joke": "Tell me a joke"
};

async function generate() {
  const tts = new MsEdgeTTS();
  await tts.setMetadata("en-US-AvaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

  for (const [name, text] of Object.entries(queries)) {
    const filename = `${name}.mp3`;
    const filepath = path.join(__dirname, filename);
    console.log(`Generating TTS audio for "${text}" -> ${filename}`);
    
    try {
      const { audioStream } = tts.toStream(text, { rate: "+0%" });
      const fileStream = fs.createWriteStream(filepath);
      
      await new Promise((resolve, reject) => {
        audioStream.pipe(fileStream);
        audioStream.on('end', resolve);
        audioStream.on('error', reject);
      });
      
      console.log(`Saved: ${filepath}`);
    } catch (err) {
      console.error(`Failed to generate ${filename}:`, err.message);
    }
  }
  console.log("Audio generation complete!");
}

generate();
