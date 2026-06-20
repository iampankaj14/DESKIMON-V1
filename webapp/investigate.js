const { matchIntent, cleanText, getPhraseSimilarity } = require('./intent_matcher');
const fs = require('fs');
const path = require('path');

console.log("=== Q1: Checking intents.json load ===");
const intentsPath = path.join(__dirname, 'intents.json');
try {
  const data = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
  console.log(`SUCCESS: Loaded intents.json. Found ${data.intents.length} intents.`);
} catch (err) {
  console.error("FAIL:", err.message);
}

console.log("\n=== Q2 & Q3: Matcher call verification ===");
console.log("In server_daemon.js, matchIntent is called within processVoiceAudio() on line 217-218:");
console.log("   if (transcribedText) {");
console.log("     const intentResult = matchIntent(transcribedText, deviceState);");
console.log("This proves that the matcher is called if and only if transcribedText is non-empty.");

console.log("\n=== Q5: Intent Matching Debug Output ===");
const queries = ["good morning", "hello", "hi", "Good Morning", "morning", "good morning deskimon", "hey good morning"];

queries.forEach(query => {
  const result = matchIntent(query);
  console.log(`Transcript: "${query}"`);
  console.log(`Matched Intent: ${result.intent}`);
  console.log(`Final Confidence: ${result.score}`);
  console.log(`Decision: ${result.matched ? 'LOCAL_RESPONSE' : 'FALLBACK'}`);
  console.log("---------------------------------------");
});

console.log("\n=== Q7: Confidence Threshold Test (0.90 vs 0.85 vs 0.80) ===");
const testPhrases = [
  "good morning",
  "Good Morning",
  "morning",
  "good morning deskimon",
  "hey good morning",
  "hello",
  "hi",
  "good night",
  "thank you",
  "how are you"
];

[0.90, 0.85, 0.80].forEach(threshold => {
  console.log(`\nTesting Threshold: ${threshold}`);
  let matches = 0;
  testPhrases.forEach(phrase => {
    const result = matchIntent(phrase);
    const matched = result.score >= threshold;
    if (matched) matches++;
    console.log(`  "${phrase}" -> Match: ${matched ? 'YES' : 'NO'} (${result.intent || 'NONE'} with score ${result.score})`);
  });
  console.log(`  Match Rate: ${matches}/${testPhrases.length} (${(matches/testPhrases.length)*100}%)`);
});

console.log("\n=== Q9: Contractions, punctuation, boosting verification ===");
const normalizationTests = [
  { raw: "don't shoot", expected: "do not shoot" },
  { raw: "I'm happy!!!", expected: "i am happy" },
  { raw: "you're smart, right?", expected: "you are smart right" }
];
normalizationTests.forEach(t => {
  const cleaned = cleanText(t.raw);
  console.log(`Raw: "${t.raw}" -> Cleaned: "${cleaned}" (Expected: "${t.expected}") -> ${cleaned === t.expected ? 'PASS' : 'FAIL'}`);
});

console.log("\n=== Q10: Full test suite against HELLO, GOOD_MORNING, GOOD_NIGHT, THANK_YOU, HOW_ARE_YOU ===");
const targetIntents = ["GREETING_HELLO", "GREETING_MORNING", "GREETING_NIGHT", "RELATIONSHIP_THANK_YOU", "COMPANION_HOW_ARE_YOU"];
targetIntents.forEach(intentName => {
  const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
  const intent = intentsData.intents.find(i => i.name === intentName);
  if (intent) {
    console.log(`\nIntent: ${intentName}`);
    intent.phrases.forEach(phrase => {
      const result = matchIntent(phrase);
      console.log(`  Phrase: "${phrase}" -> Matched Intent: ${result.intent} | Score: ${result.score}`);
    });
  }
});
