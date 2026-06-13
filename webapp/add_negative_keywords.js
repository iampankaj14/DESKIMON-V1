const fs = require('fs');
const path = require('path');

// Load intents_top100.json
const top100Path = path.join(__dirname, 'intents_top100.json');
let top100Data = JSON.parse(fs.readFileSync(top100Path, 'utf8'));

const negativeKeywordsMap = {
  'EMOTION_STRESSED': ['coffee', 'tea', 'weather', 'rain', 'snow', 'song', 'music', 'lofi', 'joke', 'sing'],
  'EMOTION_ANXIOUS': ['bug', 'code', 'compile', 'error', 'sprint', 'run', 'git', 'github', 'leak', 'debug', 'database', 'sql', 'nervous', 'scared', 'afraid', 'comparing', 'compare', 'others'],
  'EMOTION_NERVOUS': ['bug', 'code', 'compile', 'error', 'sprint', 'run', 'git', 'github', 'leak', 'debug', 'database', 'sql', 'anxious', 'panic', 'worry', 'worried'],
  'GROWTH_COMPARING_MYSELF': ['worry', 'worrying', 'anxious', 'nervous', 'panic', 'stress', 'stressed'],
  'EMOTION_FRUSTRATED': ['coffee', 'tea', 'weather', 'rain', 'snow', 'song', 'music', 'lofi', 'joke', 'sing'],
  'EMOTION_LONELY': ['bug', 'code', 'compile', 'error', 'sprint', 'run', 'git', 'github', 'leak', 'debug', 'database', 'sql'],
  'LIFE_PROCRASTINATING': ['coffee', 'tea', 'weather', 'rain', 'snow', 'song', 'music', 'lofi', 'joke', 'sing'],
  'PROJECT_GOT_STUCK': ['anxious', 'nervous', 'lonely', 'sad', 'happy', 'birthday', 'exam', 'finals', 'grade', 'study', 'bug', 'error', 'compiler', 'output', 'console', 'log', 'syntax'],
  'EMOTION_CODE_WONT_WORK': ['anxious', 'nervous', 'lonely', 'sad', 'happy', 'birthday', 'exam', 'finals', 'grade', 'study', 'project', 'concept', 'idea', 'feature'],
  'GREETING_MORNING': ['night', 'evening', 'afternoon', 'bye', 'goodbye', 'bed', 'sleep'],
  'GREETING_EVENING': ['morning', 'afternoon', 'hello', 'hi', 'wake'],
  'GREETING_NIGHT': ['morning', 'afternoon', 'evening', 'hello', 'hi', 'wake'],
  'LIFE_WEATHER_RAIN': ['hot', 'cold', 'snow', 'freeze', 'warm', 'summer', 'winter'],
  'LIFE_WEATHER_HOT': ['cold', 'snow', 'freeze', 'rain', 'winter', 'chilly'],
  'LIFE_WEATHER_COLD': ['hot', 'summer', 'warm', 'sun', 'sunny'],
  'STUDY_EXAM_TOMORROW': ['coffee', 'lofi', 'music', 'joke', 'sing', 'pizza', 'lunch'],
  'STUDY_FINALS_WEEK': ['coffee', 'lofi', 'music', 'joke', 'sing', 'pizza', 'lunch'],
  'COMPANION_HOW_ARE_YOU': ['time', 'date', 'battery', 'wifi', 'volume', 'roast', 'joke', 'sing', 'lofi', 'what'],
  'COMPANION_WHAT_DOING': ['time', 'date', 'battery', 'wifi', 'volume', 'roast', 'joke', 'sing', 'lofi', 'how'],
  'GROWTH_HABIT_BROKE_STREAK': ['havent', "haven't", 'not', 'never'],
  'ACHIEVEMENT_STREAK': ['broke', 'skipped', 'failed', 'zero', 'ruined'],
  'COMPANION_DO_YOU_LOVE_ME': ['even', 'eevn', 'evn', 'evne'],
  'STUDY_MOTIVATION_CRASH': ['doing', 'existence', 'living', 'life'],
  'EXIST_DOES_IT_MATTER': ['study', 'studying', 'school', 'exam', 'class', 'homework', 'course'],
  'COMPANION_YOUR_OPINION': ['humans', 'people', 'humanity', 'life', 'meaning', 'existence', 'universe'],
  'DESKIMON_HUMANS': ['life', 'meaning', 'existence', 'universe'],
  'DESKIMON_PHILOSOPHY': ['humans', 'people', 'humanity']
};

// Add negative_keywords to top100Data
top100Data.intents.forEach(intent => {
  intent.negative_keywords = negativeKeywordsMap[intent.intent_name] || [];
});

// Save updated intents_top100.json
fs.writeFileSync(top100Path, JSON.stringify(top100Data, null, 2));
console.log('Saved negative keywords to intents_top100.json');

// Save to root workspace intents_top100.json too
fs.writeFileSync(path.join(__dirname, '..', 'intents_top100.json'), JSON.stringify(top100Data, null, 2));

// Create V1-compatible webapp/intents.json (using Top 100 intents data!)
// Wait, we need it to have "name" instead of "intent_name" and "phrases" instead of "example_phrases"
const v1MappedIntents = top100Data.intents.map(intent => {
  return {
    name: intent.intent_name,
    keywords: intent.keywords,
    negative_keywords: intent.negative_keywords,
    phrases: intent.example_phrases,
    responses: intent.responses,
    personality: intent.category, // map category to personality or keep it
    category: intent.category
  };
});

fs.writeFileSync(path.join(__dirname, 'intents.json'), JSON.stringify({ intents: v1MappedIntents }, null, 2));
console.log('Saved mapped V1 intents to webapp/intents.json');
