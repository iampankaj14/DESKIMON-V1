const { matchIntent } = require('./intent_matcher');

// Mock device state
const mockDeviceState = {
  battery: "3.88",
  wifiSsid: "mukesh-2.4G",
  wifiRssi: "-45",
  volume: "90",
  bootCount: "783"
};

// Test queries and expected outcomes
const testCases = [
  // Greetings
  { query: "hello there", expectedIntent: "GREETING_HELLO" },
  { query: "hey deskimon", expectedIntent: "GREETING_HEY" },
  { query: "hi", expectedIntent: "GREETING_HI" },
  { query: "good morning buddy", expectedIntent: "GREETING_MORNING" },
  { query: "good afternoon", expectedIntent: "GREETING_AFTERNOON" },
  { query: "good night", expectedIntent: "GREETING_NIGHT" },
  { query: "goodbye for now", expectedIntent: "GREETING_BYE" },

  // Companion
  { query: "how are you doing today?", expectedIntent: "COMPANION_HOW_ARE_YOU" },
  { query: "what you doing?", expectedIntent: "COMPANION_WHAT_DOING" },
  { query: "are you awake?", expectedIntent: "COMPANION_ARE_YOU_AWAKE" },
  { query: "do you miss me?", expectedIntent: "COMPANION_DO_YOU_MISS_ME" },
  { query: "tell me a cool fact", expectedIntent: "COMPANION_TELL_INTERESTING" },
  { query: "tell me a bad joke", expectedIntent: "COMPANION_TELL_JOKE" },
  { query: "make me laugh", expectedIntent: "COMPANION_TELL_JOKE" },
  { query: "i need some motivation", expectedIntent: "COMPANION_MOTIVATE_ME" },
  { query: "i am bored out of my mind", expectedIntent: "COMPANION_BORED" },
  { query: "so tired", expectedIntent: "COMPANION_TIRED" },
  { query: "i'm happy", expectedIntent: "COMPANION_HAPPY" },
  { query: "i'm feeling blue today", expectedIntent: "COMPANION_SAD" },

  // Identity
  { query: "who are you?", expectedIntent: "IDENTITY_WHO_ARE_YOU" },
  { query: "what can you do?", expectedIntent: "IDENTITY_WHAT_CAN_DO" },
  { query: "how old are you?", expectedIntent: "IDENTITY_AGE" },
  { query: "are you a robot?", expectedIntent: "IDENTITY_ARE_YOU_AI" },
  { query: "where is your home?", expectedIntent: "IDENTITY_WHERE_LIVE" },

  // Utility (with dynamic formatting)
  { query: "what time is it?", expectedIntent: "UTILITY_TIME" },
  { query: "what is today's date?", expectedIntent: "UTILITY_DATE" },
  { query: "check the battery voltage", expectedIntent: "UTILITY_BATTERY" },
  { query: "how is the wifi signal strength?", expectedIntent: "UTILITY_WIFI" },
  { query: "what is the speaker volume level?", expectedIntent: "UTILITY_VOLUME" },

  // Relationship
  { query: "thank you deskimon", expectedIntent: "RELATIONSHIP_THANK_YOU" },
  { query: "sorry about that", expectedIntent: "RELATIONSHIP_SORRY" },
  { query: "i think you are awesome", expectedIntent: "RELATIONSHIP_I_LIKE_YOU" },
  { query: "you're funny", expectedIntent: "RELATIONSHIP_YOU_ARE_FUNNY" },
  { query: "you are smart", expectedIntent: "RELATIONSHIP_YOU_ARE_SMART" },
  { query: "shut up you are annoying", expectedIntent: "RELATIONSHIP_YOU_ARE_ANNOYING" },

  // Fun
  { query: "sing me a song", expectedIntent: "FUN_SING" },
  { query: "tell me trivia", expectedIntent: "FUN_FACT" },
  { query: "let's play rock paper scissors", expectedIntent: "FUN_ROCK_PAPER_SCISSORS" },
  { query: "surprise me!", expectedIntent: "FUN_SURPRISE" },
  { query: "guess what", expectedIntent: "FUN_GUESS_WHAT" },

  // Productivity
  { query: "set a study reminder", expectedIntent: "PRODUCTIVITY_REMIND_STUDY" },
  { query: "give me encouragement", expectedIntent: "PRODUCTIVITY_ENCOURAGE" },
  { query: "turn on focus mode", expectedIntent: "PRODUCTIVITY_FOCUS_MODE" },
  { query: "give me study motivation", expectedIntent: "PRODUCTIVITY_STUDY_MOTIVATION" },

  // Deskimon-specific
  { query: "what is deskimon?", expectedIntent: "DESKIMON_WHAT_IS" },
  { query: "what's your dream?", expectedIntent: "DESKIMON_DREAM" },
  { query: "what do you think about humans?", expectedIntent: "DESKIMON_HUMANS" },
  { query: "what are you thinking about?", expectedIntent: "DESKIMON_THINKING" },
  { query: "are we friends?", expectedIntent: "DESKIMON_FRIENDS" },
  { query: "do you love me?", expectedIntent: "COMPANION_DO_YOU_LOVE_ME" },

  // Fallback (should not match, confidence <= 90%)
  { query: "how does the nuclear fusion reactor work?", expectedIntent: null },
  { query: "what is the capital of switzerland?", expectedIntent: null },
  { query: "calculate twenty three times forty two", expectedIntent: null }
];

console.log("=================================================================================");
console.log("                  DESKIMON INTENT ENGINE TEST RUNNER                             ");
console.log("=================================================================================\n");

let passed = 0;
let failed = 0;

for (const tc of testCases) {
  const result = matchIntent(tc.query, mockDeviceState);
  const matchedIntent = result.matched ? result.intent : null;
  const isCorrect = matchedIntent === tc.expectedIntent;

  if (isCorrect) {
    passed++;
    console.log(`✅ [PASS] "${tc.query}"`);
    console.log(`   └─ Match: ${result.intent || 'NONE (Fallback to Gemini)'} | Score: ${result.score}`);
    if (result.matched) {
      console.log(`   └─ Response: "${result.responseText}"`);
    }
  } else {
    failed++;
    console.log(`❌ [FAIL] "${tc.query}"`);
    console.log(`   └─ Expected: ${tc.expectedIntent || 'NONE'} | Got: ${matchedIntent || 'NONE'} | Score: ${result.score}`);
    if (result.matched) {
      console.log(`   └─ Response: "${result.responseText}"`);
    }
  }
  console.log("");
}

console.log("=================================================================================");
console.log(`TEST RESULTS: Passed: ${passed} | Failed: ${failed}`);
console.log("=================================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
