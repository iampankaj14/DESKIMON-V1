const fs = require('fs');
const path = require('path');
const { matchIntent, getIntentScores } = require('./intent_matcher');

const intentsPath = path.join(__dirname, 'intents.json');
const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

// Helper arrays for generation
const slangPrefixes = ["bro", "yo", "dude", "bruh", "literally", "so like", "honestly", "hey deskimon", "please", "alright"];
const noiseWords = ["um", "uh", "like", "you know"];
const phoneticReplacements = {
  "good": "gud",
  "morning": "mornin",
  "hello": "helo",
  "hi": "hii",
  "anxious": "anxous",
  "code": "cod",
  "work": "wrk",
  "doing": "doin",
  "deskimon": "deskman",
  "buddy": "budy",
  "love": "luv",
  "streak": "strak",
  "broke": "brok",
  "failed": "faild",
  "care": "car",
  "missed": "mist",
  "worrying": "worying",
  "anxiety": "anxity",
  "programming": "programin",
  "developer": "devloper"
};

function generateQuery(phrase) {
  const mutationType = Math.floor(Math.random() * 8);
  let words = phrase.toLowerCase().split(' ').filter(w => w.length > 0);
  
  if (words.length === 0) return phrase;

  switch (mutationType) {
    case 0: // Spelling mistake (phonetic replacement + random swap)
      words = words.map(w => phoneticReplacements[w] || w);
      if (words.length > 0) {
        const idx = Math.floor(Math.random() * words.length);
        if (words[idx].length >= 4) {
          const chars = words[idx].split('');
          const charIdx = 1 + Math.floor(Math.random() * (chars.length - 2));
          const temp = chars[charIdx];
          chars[charIdx] = chars[charIdx + 1];
          chars[charIdx + 1] = temp;
          words[idx] = chars.join('');
        }
      }
      break;

    case 1: // Transcription error (homophones / Whisper errors)
      words = words.map(w => {
        if (w === "deskimon") return Math.random() > 0.5 ? "desk mon" : "destiny mon";
        if (w === "code") return "coat";
        if (w === "there") return "their";
        if (w === "to") return "too";
        if (w === "you") return "u";
        if (w === "are") return "r";
        return w;
      });
      break;

    case 2: // Mixed intents (append snippet)
      if (Math.random() > 0.5) {
        return phrase + " " + (Math.random() > 0.5 ? "please" : "thanks");
      } else {
        return (Math.random() > 0.5 ? "hey " : "yo ") + phrase;
      }

    case 3: // Slang addition
      const prefix = slangPrefixes[Math.floor(Math.random() * slangPrefixes.length)];
      return prefix + " " + phrase;

    case 4: // Incomplete sentence (drop words)
      if (words.length > 3) {
        words.splice(0, Math.random() > 0.5 ? 2 : 1);
      }
      break;

    case 5: // Noisy speech (inject fillers)
      const noise = noiseWords[Math.floor(Math.random() * noiseWords.length)];
      const insertIdx = Math.floor(Math.random() * (words.length + 1));
      words.splice(insertIdx, 0, noise);
      break;

    case 6: // Whisper repetition / stutter
      if (words.length > 2) {
        const repeatIdx = Math.floor(Math.random() * words.length);
        words.splice(repeatIdx, 0, words[repeatIdx]);
      }
      break;

    case 7: // Combined errors
      const prefix2 = slangPrefixes[Math.floor(Math.random() * slangPrefixes.length)];
      words = words.map(w => phoneticReplacements[w] || w);
      return prefix2 + " " + words.join(' ');
  }

  return words.join(' ');
}

// Generate the 10,000 queries (100 per intent)
const totalQueriesRequested = 10000;
const queriesPerIntent = 100;
const dataset = [];

for (const intent of intentsData.intents) {
  const expected = intent.name;
  const phrases = intent.phrases;
  if (!phrases || phrases.length === 0) continue;

  for (let i = 0; i < queriesPerIntent; i++) {
    const basePhrase = phrases[Math.floor(Math.random() * phrases.length)];
    const query = generateQuery(basePhrase);
    dataset.push({
      expected,
      query
    });
  }
}

// Ensure exactly 10,000 queries
while (dataset.length < totalQueriesRequested) {
  const randomIntent = intentsData.intents[Math.floor(Math.random() * intentsData.intents.length)];
  const basePhrase = randomIntent.phrases[Math.floor(Math.random() * randomIntent.phrases.length)];
  dataset.push({
    expected: randomIntent.name,
    query: generateQuery(basePhrase)
  });
}
if (dataset.length > totalQueriesRequested) {
  dataset.splice(totalQueriesRequested);
}

console.log(`Starting Stress Test over ${dataset.length} queries...`);

let correctMatches = 0;
let incorrectMatches = 0;
let fallbacks = 0;

const logEntries = [];
const startTime = Date.now();

dataset.forEach((item, index) => {
  if (index > 0 && index % 1000 === 0) {
    console.log(`Processed ${index} / ${dataset.length} queries...`);
  }

  const { expected, query } = item;
  const matchResult = matchIntent(query);
  const scores = getIntentScores(query);

  const matchedIntent = matchResult.matched ? matchResult.intent : null;
  const confidence = matchResult.score;

  // Track metrics
  if (matchedIntent === expected) {
    correctMatches++;
  } else if (matchedIntent !== null) {
    incorrectMatches++;
  } else {
    fallbacks++;
  }

  // Record top 5 competing intents (excluding the winner or including all)
  const top5 = scores.slice(0, 5).map(s => ({
    intent: s.intent,
    score: s.score,
    disqualified: s.disqualified
  }));

  logEntries.push({
    query,
    expected,
    chosen: matchedIntent,
    confidence,
    top5Competing: top5
  });
});

const durationMs = Date.now() - startTime;
console.log(`Finished Stress Test in ${(durationMs / 1000).toFixed(2)}s.`);

const report = `==================================================
STRESS TEST REPORT
==================
Total Queries:      ${dataset.length}
Correct Matches:    ${correctMatches} (Matching expected intent)
Incorrect Matches:  ${incorrectMatches} (Matching different intent - False Positives)
False Positives:    ${incorrectMatches}
Fallbacks/Rejects:  ${fallbacks} (No match/Gemini fallback)
Accuracy (Strict):  ${((correctMatches / dataset.length) * 100).toFixed(2)}%
False Positive Rate: ${((incorrectMatches / dataset.length) * 100).toFixed(2)}%
Duration:           ${(durationMs / 1000).toFixed(2)} seconds
==================================================
`;

console.log(report);

// Save results
const outputDir = path.join(__dirname, 'test_outputs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}
fs.writeFileSync(path.join(outputDir, 'stress_test_log.json'), JSON.stringify(logEntries, null, 2));
fs.writeFileSync(path.join(outputDir, 'stress_test_report.txt'), report);

console.log("Detailed logs saved to webapp/test_outputs/stress_test_log.json");
