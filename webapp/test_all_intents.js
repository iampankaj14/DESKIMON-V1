const fs = require('fs');
const path = require('path');
const { matchIntent, formatResponse } = require('./intent_matcher');

// Check for --voice argument
const runVoice = process.argv.includes('--voice');

// Load intents
const intentsPath = path.join(__dirname, 'intents.json');
let intentsData = { intents: [] };
try {
  intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
} catch (err) {
  console.error("Failed to load intents.json:", err.message);
  process.exit(1);
}

// Ensure test_outputs directory exists if voice is enabled
const testOutputsDir = path.join(__dirname, 'test_outputs');
if (runVoice && !fs.existsSync(testOutputsDir)) {
  fs.mkdirSync(testOutputsDir);
}

// Mock device state for placeholders
const mockDeviceState = {
  battery: "3.95",
  wifiSsid: "Deskimon_WiFi",
  wifiRssi: "-50",
  volume: "85",
  bootCount: "42"
};

let totalIntents = intentsData.intents.length;
let totalTestPhrases = 0;
let passed = 0;
let failed = 0;
const failures = [];
const confidenceScores = [];

console.log("================================================================");
console.log("             DESKIMON AUTOMATED INTENT VALIDATOR                ");
console.log("================================================================\n");

// Iterate through every intent
for (const intent of intentsData.intents) {
  console.log(`================================================`);
  console.log(`INTENT: ${intent.name}`);
  console.log(`========================================\n`);

  for (const phrase of intent.phrases) {
    totalTestPhrases++;
    const result = matchIntent(phrase, mockDeviceState);
    const matchedCorrectly = result.matched && result.intent === intent.name;
    
    confidenceScores.push(result.score);

    console.log(`Input:\n"${phrase}"\n`);
    console.log(`Matched:\n${result.intent || 'NONE'}\n`);
    console.log(`Confidence:\n${result.score.toFixed(2)}\n`);
    console.log(`Selected Response:\n"${result.responseText || 'N/A'}"\n`);

    if (matchedCorrectly) {
      passed++;
      console.log(`Result:\nPASS\n`);
    } else {
      failed++;
      console.log(`Result:\nFAIL\n`);
      
      let reason = "";
      if (!result.matched) {
        reason = `Confidence score (${result.score}) was below the 0.90 threshold.`;
      } else if (result.intent !== intent.name) {
        reason = `Matched wrong intent (Expected: ${intent.name}, Got: ${result.intent})`;
      }
      
      console.log(`Intent Expected:\n${intent.name}\n`);
      console.log(`Intent Returned:\n${result.intent || 'NONE'}\n`);
      console.log(`Confidence:\n${result.score.toFixed(2)}\n`);
      console.log(`Reason:\n${reason}\n`);

      failures.push({
        phrase,
        expected: intent.name,
        returned: result.intent,
        score: result.score,
        reason
      });
    }
    console.log("---");
  }
}

// Calculate Stats
const successRate = totalTestPhrases > 0 ? (passed / totalTestPhrases) * 100 : 0;
const avgConfidence = confidenceScores.length > 0 ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length : 0;
const minConfidence = confidenceScores.length > 0 ? Math.min(...confidenceScores) : 0;

console.log("\n================================================================");
console.log("                        TEST SUMMARY                            ");
console.log("================================================================");
console.log(`Total Intents:     ${totalIntents}`);
console.log(`Total Test Phrases: ${totalTestPhrases}`);
console.log(`Passed:            ${passed}`);
console.log(`Failed:            ${failed}`);
console.log(`Success Rate:      ${successRate.toFixed(2)}%`);
console.log(`Avg Confidence:    ${avgConfidence.toFixed(4)}`);
console.log(`Min Confidence:    ${minConfidence.toFixed(4)}`);
console.log("================================================================\n");

// Run Voice Validation or Generate Report
if (runVoice) {
  const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');
  console.log("================================================================");
  console.log("             RUNNING VOICE VALIDATION (TTS GENERATION)           ");
  console.log("================================================================\n");

  const tts = new MsEdgeTTS();
  
  async function generateVoiceFiles() {
    await tts.setMetadata("en-US-AvaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
    
    for (const intent of intentsData.intents) {
      // Pick a random response
      const randomIndex = Math.floor(Math.random() * intent.responses.length);
      const rawResponse = intent.responses[randomIndex];
      const formatted = formatResponse(rawResponse, mockDeviceState);
      
      console.log(`Generating TTS for ${intent.name}...`);
      console.log(`  Text: "${formatted}"`);
      
      try {
        const { audioStream } = tts.toStream(formatted, { rate: "+10%" });
        const filePath = path.join(testOutputsDir, `${intent.name}.mp3`);
        const fileStream = fs.createWriteStream(filePath);
        
        await new Promise((resolve, reject) => {
          audioStream.pipe(fileStream);
          audioStream.on('end', resolve);
          audioStream.on('error', reject);
        });
        
        console.log(`  Saved: ${intent.name}.mp3\n`);
      } catch (err) {
        console.error(`  ❌ Failed to generate TTS for ${intent.name}: ${err.message}\n`);
      }
    }
    console.log("Voice validation files generated successfully in 'test_outputs/' directory.\n");
  }

  generateVoiceFiles().then(() => generateReport());
} else {
  generateReport();
}

function generateReport() {
  const artifactReportPath = "/Users/pankaj/.gemini/antigravity-ide/brain/9c9118d6-587a-4a6e-80e1-aebc29f5591c/intent_validation_report.md";
  
  // Format categories
  const categoryGroupMap = {};
  intentsData.intents.forEach(intent => {
    let cat = 'Other';
    if (intent.name.startsWith('GREETING_')) cat = 'Greetings';
    else if (intent.name.startsWith('COMPANION_')) cat = 'Companion';
    else if (intent.name.startsWith('IDENTITY_')) cat = 'Identity';
    else if (intent.name.startsWith('UTILITY_')) cat = 'Utility';
    else if (intent.name.startsWith('RELATIONSHIP_')) cat = 'Relationship';
    else if (intent.name.startsWith('FUN_')) cat = 'Fun';
    else if (intent.name.startsWith('PRODUCTIVITY_')) cat = 'Productivity';
    else if (intent.name.startsWith('DESKIMON_')) cat = 'Deskimon-Specific';
    
    if (!categoryGroupMap[cat]) categoryGroupMap[cat] = [];
    
    // Get a sample response
    const sampleResponse = intent.responses[0];
    
    categoryGroupMap[cat].push({
      name: intent.name,
      phrasesCount: intent.phrases.length,
      sampleResponse
    });
  });

  let reportContent = `# Deskimon Intent Engine Validation Report

This report provides the automated test results and validation statistics for the Deskimon Intent Matcher.

---

## 📊 Summary Statistics

| Metric | Value |
| :--- | :--- |
| **Total Intents Tested** | ${totalIntents} |
| **Total Phrases Validated** | ${totalTestPhrases} |
| **Passed Phrases** | ${passed} |
| **Failed Phrases** | ${failed} |
| **Success Rate** | **${successRate.toFixed(2)}%** |
| **Average Matching Confidence** | **${avgConfidence.toFixed(4)}** |
| **Minimum Matching Confidence** | **${minConfidence.toFixed(4)}** |

---

## ❌ Test Failures

`;

  if (failures.length === 0) {
    reportContent += `> [!NOTE]\n> **Zero Failures:** Every intent and example phrase successfully matched its expected target with confidence above the 0.90 threshold.\n\n`;
  } else {
    reportContent += `| Expected Intent | Input Phrase | Matched Intent | Score | Reason for Failure |\n`;
    reportContent += `| :--- | :--- | :--- | :--- | :--- |\n`;
    failures.forEach(f => {
      reportContent += `| \`${f.expected}\` | "${f.phrase}" | \`${f.returned || 'NONE'}\` | ${f.score.toFixed(2)} | ${f.reason} |\n`;
    });
    reportContent += `\n`;
  }

  reportContent += `---

## 📂 Categories & Matched Intents

`;

  for (const [cat, intents] of Object.entries(categoryGroupMap)) {
    reportContent += `### ${cat}\n\n`;
    reportContent += `| Intent Name | Example Phrases Count | Sample Response |\n`;
    reportContent += `| :--- | :--- | :--- |\n`;
    intents.forEach(intent => {
      reportContent += `| **${intent.name}** | ${intent.phrasesCount} | "${intent.sampleResponse}" |\n`;
    });
    reportContent += `\n`;
  }

  try {
    fs.writeFileSync(artifactReportPath, reportContent, 'utf8');
    console.log(`Created validation report at: ${artifactReportPath}`);
  } catch (err) {
    console.error(`Failed to write artifact report: ${err.message}`);
  }
}
