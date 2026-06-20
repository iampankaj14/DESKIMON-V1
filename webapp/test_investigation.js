const { matchIntent } = require('./intent_matcher');

const queries = [
  "Who are you?",
  "How are you?",
  "Thank you",
  "Good night",
  "What is the capital of Japan?"
];

console.log("=== RUNTIME INTENT ENGINE TRACE ===");
queries.forEach(q => {
  const result = matchIntent(q);
  console.log(`Query: "${q}"`);
  console.log(`  Matched: ${result.matched}`);
  console.log(`  Intent: ${result.intent}`);
  console.log(`  Confidence Score: ${result.score}`);
  console.log(`  Response Text: "${result.responseText}"`);
  console.log("------------------------------------------------");
});
