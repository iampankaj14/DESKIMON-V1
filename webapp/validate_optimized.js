const fs = require('fs');
const path = require('path');
const { matchIntent, cleanText } = require('./intent_matcher');

// Load intents
const intentsPath = path.join(__dirname, 'intents.json');
const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

// Helper to mutate phrases for fuzzy matching testing
function mutatePhrase(phrase, type) {
  const words = phrase.split(' ');
  if (type === 'spelling' && words.length > 0) {
    const targetWordIdx = words.findIndex(w => w.length >= 4);
    if (targetWordIdx !== -1) {
      const word = words[targetWordIdx];
      const chars = word.split('');
      const temp = chars[1];
      chars[1] = chars[2];
      chars[2] = temp;
      words[targetWordIdx] = chars.join('');
    } else {
      words[0] = words[0] + 's';
    }
    return words.join(' ');
  } else if (type === 'missing' && words.length >= 3) {
    words.splice(Math.floor(words.length / 2), 1);
    return words.join(' ');
  } else if (type === 'extra') {
    return "hey " + phrase + " please";
  } else if (type === 'reordered' && words.length >= 3) {
    const temp = words[0];
    words[0] = words[1];
    words[1] = temp;
    return words.join(' ');
  }
  return phrase;
}

let totalIntents = intentsData.intents.length;
let totalExamplePhrases = 0;
let totalResponses = 0;

let passedMatches = 0;
let failedMatches = 0;
const matchFailures = [];

const mockDeviceState = {
  battery: "3.95",
  wifiSsid: "Deskimon_WiFi",
  wifiRssi: "-50",
  volume: "85",
  bootCount: "42"
};

for (const intent of intentsData.intents) {
  totalExamplePhrases += intent.phrases.length;
  totalResponses += intent.responses.length;

  for (const phrase of intent.phrases) {
    // 1. Direct match
    const directResult = matchIntent(phrase, mockDeviceState);
    if (directResult.matched && directResult.intent === intent.name) {
      passedMatches++;
    } else {
      failedMatches++;
      matchFailures.push({
        phrase,
        expected: intent.name,
        got: directResult.intent,
        score: directResult.score,
        mutation: 'None'
      });
    }

    // 2. Mutated checks
    const mutations = ['spelling', 'missing', 'extra', 'reordered'];
    for (const mutType of mutations) {
      const mutated = mutatePhrase(phrase, mutType);
      if (mutated === phrase) continue;

      const mutResult = matchIntent(mutated, mockDeviceState);
      if (mutResult.intent !== intent.name) {
        if (mutResult.matched && mutResult.intent !== null) {
          failedMatches++;
          matchFailures.push({
            phrase: mutated,
            expected: intent.name,
            got: mutResult.intent,
            score: mutResult.score,
            mutation: mutType + ` (Original: "${phrase}")`
          });
        }
      }
    }
  }
}

const accuracy = (passedMatches / totalExamplePhrases) * 100;
const falsePositives = matchFailures.filter(f => f.got !== null && f.got !== f.expected).length;

console.log("==================================================");
console.log("POST-OPTIMIZATION REPORT SUMMARY");
console.log("==================================================");
console.log("Total Intents:         ", totalIntents);
console.log("Total Test Phrases:    ", totalExamplePhrases);
console.log("Passed Matches:        ", passedMatches);
console.log("Failed Matches:        ", failedMatches);
console.log("Direct Match Accuracy: ", accuracy.toFixed(2) + "%");
console.log("False Positives:       ", falsePositives);
console.log("==================================================");

fs.writeFileSync(path.join(__dirname, 'opt_validation_failures.json'), JSON.stringify(matchFailures, null, 2));
