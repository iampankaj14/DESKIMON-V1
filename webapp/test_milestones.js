const fs = require('fs');
const path = require('path');
const memorySystem = require('./memory_system');
const milestoneSystem = require('./milestone_system');

const testDeviceId = 'test_device_milestones';

// Clear previous test data for this device if it exists
if (memorySystem.db.devices[testDeviceId]) {
  delete memorySystem.db.devices[testDeviceId];
  memorySystem.saveMemories();
}

console.log("==========================================");
console.log("STARTING DESKIMON MILESTONE SYSTEM V1 TESTS");
console.log("==========================================\n");

// 1. Run detection for all 4 categories
console.log("--- 1. Testing Milestone Detection across 4 Categories ---");

const testCases = [
  // Study Milestones
  {
    text: "i finally finished my compiler exam!",
    expectedType: "STUDY_FINISHED_EXAM",
    expectedCategory: "study"
  },
  {
    text: "omg i aced my math test today",
    expectedType: "STUDY_ACED_TEST",
    expectedCategory: "study"
  },
  // Project Milestones
  {
    text: "i am done building my new portfolio site",
    expectedType: "PROJECT_FINISHED",
    expectedCategory: "project"
  },
  {
    text: "finally fixed the memory leak bug",
    expectedType: "PROJECT_FIXED_BUG",
    expectedCategory: "project"
  },
  // Achievement Milestones
  {
    text: "i secured an internship at google",
    expectedType: "ACHIEVEMENT_GOT_JOB",
    expectedCategory: "achievement"
  },
  {
    text: "my team won the hackathon!",
    expectedType: "ACHIEVEMENT_WON_COMPETITION",
    expectedCategory: "achievement"
  },
  // Life Milestones
  {
    text: "today is my birthday!",
    expectedType: "LIFE_BIRTHDAY",
    expectedCategory: "life"
  },
  {
    text: "i am moving to new york next month",
    expectedType: "LIFE_MOVING",
    expectedCategory: "life"
  }
];

testCases.forEach((tc, idx) => {
  console.log(`Test #${idx + 1}: "${tc.text}"`);
  const result = milestoneSystem.detectAndCelebrateMilestone(testDeviceId, tc.text);
  if (result) {
    console.log(`  -> Triggered: ${result.type} (Expected: ${tc.expectedType})`);
    console.log(`  -> Response chosen: "${result.response}"`);
    console.log(`  -> Category counter: ${JSON.stringify(result.milestoneCounters)}`);
  } else {
    console.log("  -> ERROR: Failed to detect milestone!");
  }
  console.log("");
});

// 2. Test duplicate prevention
console.log("--- 2. Testing Duplication Guard (One-time celebration) ---");
console.log("Triggering the exact same milestone again: \"today is my birthday!\"");
const repeatResult = milestoneSystem.detectAndCelebrateMilestone(testDeviceId, "today is my birthday!");
if (repeatResult === null) {
  console.log("  -> Success: Duplication guard correctly blocked repeat celebration (returned null).");
} else {
  console.log("  -> ERROR: Allowed duplicate celebration!");
}
console.log("");

// 3. Verify Memory Storage
console.log("--- 3. Verifying Memory Entry Flagging ---");
const deviceData = memorySystem.getDeviceData(testDeviceId);
const milestoneMemories = deviceData.memories.filter(m => m.isMilestone);
console.log(`Total Milestone Memories stored: ${milestoneMemories.length}`);
console.log(`XP Earned: ${deviceData.relationship.xp} (Expected: 8 * 30 + 1 * 5 = 245 XP?)`);
// Each milestone yields 30 XP (8 milestones = 240 XP). Plus 5 XP for regular memory? No, only milestone was stored.
// Wait, during detection, it saves memory which triggers +15 XP (since importance >= 8), AND addXP(30) is called in milestoneSystem.
// So each milestone yields 15 + 30 = 45 XP! 8 milestones = 360 XP.
console.log(`Verification of relationship level: Level ${deviceData.relationship.level} (${memorySystem.getRelationshipName(deviceData.relationship.level)})`);
if (milestoneMemories.length === 8 && deviceData.relationship.level >= 3) {
  console.log("  -> Verification: PASS");
} else {
  console.log("  -> Verification: FAIL");
}
console.log("");

console.log("==========================================");
console.log("DESKIMON MILESTONE SYSTEM V1 TESTS COMPLETED");
console.log("==========================================");

// Cleanup test data
delete memorySystem.db.devices[testDeviceId];
memorySystem.saveMemories();
