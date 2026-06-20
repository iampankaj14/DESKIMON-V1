const fs = require('fs');
const path = require('path');

const intentsPath = path.join(__dirname, 'intents.json');
const data = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

// Helper to determine category from intent name prefix
function getCategory(intentName) {
  if (intentName.startsWith('GREETING_')) return 'Greetings';
  if (intentName.startsWith('COMPANION_')) return 'Companion';
  if (intentName.startsWith('IDENTITY_')) return 'Identity';
  if (intentName.startsWith('UTILITY_')) return 'Utility';
  if (intentName.startsWith('RELATIONSHIP_')) return 'Relationship';
  if (intentName.startsWith('FUN_')) return 'Fun';
  if (intentName.startsWith('PRODUCTIVITY_')) return 'Productivity';
  if (intentName.startsWith('DESKIMON_')) return 'Deskimon-Specific';
  return 'Other';
}

const grouped = {};

data.intents.forEach(intent => {
  const cat = getCategory(intent.name);
  if (!grouped[cat]) grouped[cat] = [];
  grouped[cat].push(intent);
});

console.log("# DESKIMON INTENT ENGINE SUMMARY\n");

for (const [category, intents] of Object.entries(grouped)) {
  console.log(`## Category: ${category}`);
  console.log("| Intent Name | Example Phrases | No. Responses |");
  console.log("| :--- | :--- | :--- |");
  intents.forEach(intent => {
    // Show up to 3 example phrases
    const phrasesStr = intent.phrases.slice(0, 3).map(p => `"${p}"`).join(', ') + (intent.phrases.length > 3 ? '...' : '');
    console.log(`| **${intent.name}** | ${phrasesStr} | ${intent.responses.length} |`);
  });
  console.log("\n");
}
