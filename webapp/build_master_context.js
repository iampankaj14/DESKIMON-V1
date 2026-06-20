const fs = require('fs');
const path = require('path');

// Paths
const intentsPath = path.join(__dirname, 'intents.json');
const docPath = path.join(__dirname, '../DESKIMON_MASTER_CONTEXT.md');

// Load intents
const intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));

// Categories Helper
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

// 1. Calculate Statistics
let totalIntents = intentsData.intents.length;
let totalTestPhrases = 0;
let totalResponses = 0;
const placeholdersSeen = new Set();
const placeholderMap = {
  '{TIME}': 0,
  '{DATE}': 0,
  '{BATTERY}': 0,
  '{VOLUME}': 0,
  '{WIFI_SSID}': 0,
  '{WIFI_RSSI}': 0,
  '{BOOT_COUNT}': 0
};

intentsData.intents.forEach(intent => {
  totalTestPhrases += intent.phrases.length;
  totalResponses += intent.responses.length;
  
  intent.responses.forEach(resp => {
    Object.keys(placeholderMap).forEach(placeholder => {
      if (resp.includes(placeholder)) {
        placeholderMap[placeholder]++;
        placeholdersSeen.add(placeholder);
      }
    });
  });
});

const avgResponses = totalIntents > 0 ? (totalResponses / totalIntents).toFixed(1) : 0;

// Build INTENT STATISTICS markdown
let statsMd = `## INTENT STATISTICS

| Metric | Value |
| :--- | :--- |
| **Total Intents** | ${totalIntents} |
| **Total Example Phrases** | ${totalTestPhrases} |
| **Total Responses** | ${totalResponses} |
| **Average Responses per Intent** | ${avgResponses} |

### Placeholder Usage Summary
`;

Object.entries(placeholderMap).forEach(([placeholder, count]) => {
  statsMd += `- **\`${placeholder}\`**: Used in ${count} responses.\n`;
});
statsMd += `\n---\n\n`;

// 2. Build FULL INTENT DATABASE markdown
let databaseMd = `## FULL INTENT DATABASE

This section contains the entire Deskimon V1 local intent database.

`;

intentsData.intents.forEach(intent => {
  const category = getCategory(intent.name);
  
  // Find placeholders used in this intent
  const usedPlaceholders = [];
  intent.responses.forEach(resp => {
    Object.keys(placeholderMap).forEach(placeholder => {
      if (resp.includes(placeholder) && !usedPlaceholders.includes(placeholder)) {
        usedPlaceholders.push(placeholder);
      }
    });
  });

  const keywordsStr = intent.keywords.map(k => `* ${k}`).join('\n');
  const phrasesStr = intent.phrases.map(p => `* ${p}`).join('\n');
  const responsesStr = intent.responses.map((r, i) => `${i + 1}. "${r}"`).join('\n');
  const placeholdersStr = usedPlaceholders.length > 0 ? usedPlaceholders.map(p => `\`${p}\``).join(', ') : 'None';
  
  let notes = "Standard local response match.";
  if (category === 'Greetings') notes = "Used for handling direct user greetings and farewells.";
  else if (category === 'Utility') notes = "Performs dynamic hardware telemetry checking and placeholder rendering.";
  else if (category === 'Productivity') notes = "Used for motivating, encouraging, or managing study timers.";

  databaseMd += `### ${intent.name}\n\n`;
  databaseMd += `**Category:** ${category}\n\n`;
  databaseMd += `**Personality Description:** ${intent.personality || 'Playful, warm desk-companion style.'}\n\n`;
  databaseMd += `**Confidence Threshold:** \`0.90\`\n\n`;
  databaseMd += `**Keywords:**\n${keywordsStr}\n\n`;
  databaseMd += `**Example Phrases:**\n${phrasesStr}\n\n`;
  databaseMd += `**Responses:**\n${responsesStr}\n\n`;
  databaseMd += `**Placeholders:** ${placeholdersStr}\n\n`;
  databaseMd += `**Notes:** ${notes}\n\n`;
  databaseMd += `---\n\n`;
});

// 3. Build RESPONSE DATABASE SUMMARY markdown
let summaryMd = `## RESPONSE DATABASE SUMMARY

Below is a complete collection of all 500 responses, grouped by category.

`;

const groupedResponses = {};
intentsData.intents.forEach(intent => {
  const cat = getCategory(intent.name);
  if (!groupedResponses[cat]) groupedResponses[cat] = [];
  groupedResponses[cat].push(intent);
});

for (const [category, intents] of Object.entries(groupedResponses)) {
  summaryMd += `### Category: ${category}\n\n`;
  intents.forEach(intent => {
    summaryMd += `#### Intent: ${intent.name}\n`;
    intent.responses.forEach((resp, idx) => {
      summaryMd += `- [Variation ${idx + 1}] "${resp}"\n`;
    });
    summaryMd += `\n`;
  });
  summaryMd += `---\n\n`;
}

// 4. Combine and Update DESKIMON_MASTER_CONTEXT.md
const originalDoc = fs.readFileSync(docPath, 'utf8');

// Find insertion point right before "## 7. Personality Definition"
const marker = '## 7. Personality Definition';
const parts = originalDoc.split(marker);

if (parts.length !== 2) {
  console.error("Error: Could not find insertion marker in master context file.");
  process.exit(1);
}

// Assemble the new file content
const finalDoc = parts[0] + 
                 statsMd + 
                 databaseMd + 
                 summaryMd + 
                 marker + 
                 parts[1];

fs.writeFileSync(docPath, finalDoc, 'utf8');
console.log(`Successfully updated DESKIMON_MASTER_CONTEXT.md. Length: ${finalDoc.length} characters.`);
