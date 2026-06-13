const fs = require('fs');
const path = require('path');
const memorySystem = require('./memory_system');

const testDeviceId = 'test_device_12345';

// Clear previous test data for this device if it exists
if (memorySystem.db.devices[testDeviceId]) {
  delete memorySystem.db.devices[testDeviceId];
  memorySystem.saveMemories();
}

console.log("==========================================");
console.log("STARTING DESKIMON MEMORY SYSTEM V1 TESTS");
console.log("==========================================\n");

// 1. Test Relationship Level & XP Progression
console.log("--- 1. Testing Relationship Level Progression ---");
const initialData = memorySystem.getDeviceData(testDeviceId);
console.log(`Initial Level: ${initialData.relationship.level} (${memorySystem.getRelationshipName(initialData.relationship.level)}), XP: ${initialData.relationship.xp}`);

memorySystem.addXP(testDeviceId, 45); // Should stay level 1
console.log(`Added 45 XP -> Level: ${initialData.relationship.level} (${memorySystem.getRelationshipName(initialData.relationship.level)}), XP: ${initialData.relationship.xp}`);

memorySystem.addXP(testDeviceId, 20); // Total 65 XP -> Level 2
console.log(`Added 20 XP -> Level: ${initialData.relationship.level} (${memorySystem.getRelationshipName(initialData.relationship.level)}), XP: ${initialData.relationship.xp}`);

memorySystem.addXP(testDeviceId, 150); // Total 215 XP -> Level 3
console.log(`Added 150 XP -> Level: ${initialData.relationship.level} (${memorySystem.getRelationshipName(initialData.relationship.level)}), XP: ${initialData.relationship.xp}`);

memorySystem.addXP(testDeviceId, 500); // Total 715 XP -> Level 5
console.log(`Added 500 XP -> Level: ${initialData.relationship.level} (${memorySystem.getRelationshipName(initialData.relationship.level)}), XP: ${initialData.relationship.xp}`);

console.log("XP Level tests passed.\n");

// Reset XP for subsequent tests
initialData.relationship.xp = 0;
initialData.relationship.level = 1;
memorySystem.saveMemories();

// 2. Test Heuristic Detection & Importance Scoring
console.log("--- 2. Testing Heuristic Auto-Detection & Importance Scoring ---");

const testCases = [
  {
    text: "i am working on my speech-to-text compiler",
    expectedCategory: "PROJECT",
    expectedImportance: 7
  },
  {
    text: "dude i have a chemistry exam tomorrow morning",
    expectedCategory: "EXAM",
    expectedImportance: 8
  },
  {
    text: "my goal is to study rust coding",
    expectedCategory: "GOAL",
    expectedImportance: 6
  },
  {
    text: "omg i finally got the job as a senior engineer",
    expectedCategory: "ACHIEVEMENT",
    expectedImportance: 9
  },
  {
    text: "literally going on vacation next week",
    expectedCategory: "GENERAL_EVENT",
    expectedImportance: 5
  }
];

testCases.forEach((tc, idx) => {
  console.log(`Input #${idx + 1}: "${tc.text}"`);
  const mem = memorySystem.detectAndStoreMemory(testDeviceId, tc.text);
  if (mem) {
    console.log(`  -> Detected Category: ${mem.category} (Expected: ${tc.expectedCategory})`);
    console.log(`  -> Importance: ${mem.importance} (Expected: ${tc.expectedImportance})`);
    console.log(`  -> Signature Moment: ${mem.isSignatureMoment}`);
    console.log(`  -> Keywords Extracted: [${mem.keywords.join(', ')}]`);
  } else {
    console.log("  -> ERROR: Failed to detect memory!");
  }
  console.log("");
});

// 3. Test Retrieval Logic (Semantic Overlap + Importance weight)
console.log("--- 3. Testing Semantic Memory Retrieval ---");

const searchQueries = [
  {
    query: "how is the speech-to-text compiler going?",
    expectKeyword: "compiler"
  },
  {
    query: "what is the date of my chemistry exam?",
    expectKeyword: "chemistry"
  },
  {
    query: "are we still aiming for the rust coding goal?",
    expectKeyword: "rust"
  }
];

searchQueries.forEach((sq, idx) => {
  console.log(`Query #${idx + 1}: "${sq.query}"`);
  const results = memorySystem.retrieveRelevantMemories(testDeviceId, sq.query, 1);
  if (results.length > 0) {
    console.log(`  -> Retrieved: [${results[0].category}] "${results[0].content}"`);
    const containsKeyword = results[0].keywords.includes(sq.expectKeyword) || results[0].content.toLowerCase().includes(sq.expectKeyword);
    console.log(`  -> Verification: ${containsKeyword ? "PASS" : "FAIL"}`);
  } else {
    console.log("  -> ERROR: No relevant memories retrieved!");
  }
  console.log("");
});

// 4. Test Memory Expiration Rules
console.log("--- 4. Testing Memory Expiration ---");
const data = memorySystem.getDeviceData(testDeviceId);

// Manually insert an expired memory
const expiredMemory = {
  id: "mem_expired_test",
  category: "GENERAL_EVENT",
  content: "Old event that happened a while ago",
  keywords: ["old", "event"],
  importance: 4,
  createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  expiresAt: new Date(Date.now() - 1000).toISOString(), // Expired 1 second ago
  isSignatureMoment: false
};
data.memories.push(expiredMemory);
console.log(`Manually added expired memory: "${expiredMemory.content}" (Expires at: ${expiredMemory.expiresAt})`);
console.log(`Before cleanup: ${data.memories.length} memories`);

// Running retrieval triggers cleanup
memorySystem.cleanExpiredMemories(testDeviceId);
console.log(`After cleanup: ${data.memories.length} memories`);

const stillHasExpired = data.memories.some(m => m.id === "mem_expired_test");
console.log(`Verification: ${!stillHasExpired ? "PASS" : "FAIL (Expired memory is still present!)"}`);
console.log("");

// 5. Test Memory System Prompt Generation
console.log("--- 5. Testing Prompt Context Generation ---");
const promptContext = memorySystem.getMemoryContextPrompt(testDeviceId);
console.log(promptContext);

console.log("==========================================");
console.log("DESKIMON MEMORY SYSTEM V1 TESTS COMPLETED");
console.log("==========================================");

// Cleanup test data to prevent cluttering memories.json
delete memorySystem.db.devices[testDeviceId];
memorySystem.saveMemories();
