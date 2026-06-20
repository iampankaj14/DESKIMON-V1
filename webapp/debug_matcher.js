const { matchIntent, getIntentScores } = require('./intent_matcher');

const queries = [
  "Suggest me a movie",
  "What is 17 multiplied by 23?",
  "Who is the president of France?",
  "Tell me a joke"
];

const mockDeviceState = {
  battery: "3.95",
  wifiSsid: "Deskimon_WiFi",
  wifiRssi: "-50",
  volume: "85",
  bootCount: "42"
};

console.log("===============================================================================");
const resultSummary = [];

for (const query of queries) {
  console.log(`\nQUERY: "${query}"`);
  const result = matchIntent(query, mockDeviceState);
  console.log(`Matched: ${result.matched}`);
  console.log(`Intent: ${result.intent}`);
  console.log(`Score: ${result.score}`);
  console.log(`Response Text: "${result.responseText}"`);

  console.log("\nTOP 5 CANDIDATE INTENTS:");
  const scores = getIntentScores(query);
  scores.slice(0, 5).forEach((item, idx) => {
    console.log(`  ${idx + 1}. Intent: ${item.intent} | Score: ${item.score} | Disqualified: ${item.disqualified}`);
  });
  console.log("-------------------------------------------------------------------------------");
}
