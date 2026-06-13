const fs = require('fs');
const path = require('path');

// Load intents
const intentsPath = path.join(__dirname, 'intents.json');
let intentsData = { intents: [] };
try {
  intentsData = JSON.parse(fs.readFileSync(intentsPath, 'utf8'));
} catch (err) {
  console.error("Failed to load intents.json:", err.message);
}

// Caches for production performance optimization (latency reduction)
const levCache = new Map();
const cleanTextCache = new Map();
const strSimCache = new Map();

/**
 * Standard Levenshtein Distance implementation with Map caching
 */
function getLevenshteinDistance(s1, s2) {
  const key = s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  if (levCache.has(key)) return levCache.get(key);

  const m = s1.length;
  const n = s2.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }
  const result = dp[m][n];
  levCache.set(key, result);
  return result;
}

/**
 * Clean text: lowercase, strip punctuation, strip extra whitespace, normalize contractions.
 * Strips common greeting prefixes and polite suffixes for sentences with > 2 words to eliminate false matches.
 */
function cleanText(text) {
  if (!text) return '';
  if (cleanTextCache.has(text)) return cleanTextCache.get(text);

  let cleaned = text.toLowerCase();
  
  // Normalize contractions before removing apostrophes
  cleaned = cleaned
    .replace(/\bwhat's\b/g, "what is")
    .replace(/\bwho's\b/g, "who is")
    .replace(/\bhow's\b/g, "how is")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\byou're\b/g, "you are")
    .replace(/\bdon't\b/g, "do not")
    .replace(/\bcan't\b/g, "can not")
    .replace(/\bwon't\b/g, "will not");

  // Remove punctuation
  cleaned = cleaned
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"’?]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // Normalize spelling without apostrophes just in case they were stripped
  cleaned = cleaned
    .replace(/\bwhats\b/g, "what is")
    .replace(/\bwhos\b/g, "who is")
    .replace(/\bhows\b/g, "how is")
    .replace(/\bits\b/g, "it is")
    .replace(/\bim\b/g, "i am")
    .replace(/\byoure\b/g, "you are")
    .replace(/\bdont\b/g, "do not")
    .replace(/\bcant\b/g, "can not")
    .replace(/\bwont\b/g, "will not");

  // Filler words extraction (only for longer phrases of > 2 words to preserve direct short greetings)
  const words = cleaned.split(' ').filter(w => w.length > 0);
  if (words.length > 2) {
    // Strip leading greetings
    if (['hey', 'hi', 'hello', 'please'].includes(words[0])) {
      words.shift();
    }
    // Strip trailing polite/filler terms
    if (words.length > 2 && ['please', 'thanks', 'thankyou', 'buddy', 'deskimon'].includes(words[words.length - 1])) {
      words.pop();
    }
    cleaned = words.join(' ');
  }

  cleanTextCache.set(text, cleaned);
  return cleaned;
}

/**
 * Get string similarity score between 0.0 and 1.0 based on Levenshtein and Map caching
 */
function getStringSimilarity(s1, s2) {
  const key = s1 < s2 ? `${s1}|${s2}` : `${s2}|${s1}`;
  if (strSimCache.has(key)) return strSimCache.get(key);

  const clean1 = cleanText(s1);
  const clean2 = cleanText(s2);
  if (clean1 === clean2) {
    strSimCache.set(key, 1.0);
    return 1.0;
  }
  if (clean1.length === 0 || clean2.length === 0) {
    strSimCache.set(key, 0.0);
    return 0.0;
  }

  const distance = getLevenshteinDistance(clean1, clean2);
  const maxLength = Math.max(clean1.length, clean2.length);
  const result = 1.0 - distance / maxLength;
  strSimCache.set(key, result);
  return result;
}

/**
 * Token-based Jaccard-like fuzzy word alignment similarity
 */
function getTokenSimilarity(s1, s2) {
  const words1 = cleanText(s1).split(' ').filter(w => w.length > 0);
  const words2 = cleanText(s2).split(' ').filter(w => w.length > 0);

  if (words1.length === 0 || words2.length === 0) return 0.0;

  let scoreSum = 0;
  for (const w2 of words2) {
    let bestWordScore = 0;
    for (const w1 of words1) {
      const sim = getStringSimilarity(w1, w2);
      if (sim > bestWordScore) {
        bestWordScore = sim;
      }
    }
    scoreSum += bestWordScore;
  }

  const alignmentScore = scoreSum / words2.length;
  return alignmentScore;
}

/**
 * Combined phrase similarity score
 */
function getPhraseSimilarity(userInput, targetPhrase) {
  const cleanInput = cleanText(userInput);
  const cleanTarget = cleanText(targetPhrase);
  if (cleanInput === cleanTarget) return 1.0;

  const directSim = getStringSimilarity(userInput, targetPhrase);
  const tokenSim = getTokenSimilarity(userInput, targetPhrase);

  let substringBoost = 0.0;
  if (cleanTarget.length > 3 && (cleanInput.includes(cleanTarget) || cleanTarget.includes(cleanInput))) {
    // Proportional boost based on length ratio (max 0.15 boost)
    const ratio = Math.min(cleanTarget.length, cleanInput.length) / Math.max(cleanTarget.length, cleanInput.length);
    substringBoost = ratio * 0.15;
  }

  // Cap non-exact matches at 0.98 to preserve exact match priority
  return Math.min(0.98, (0.4 * directSim + 0.6 * tokenSim) + substringBoost);
}

/**
 * Format response template by replacing placeholders with device/system state
 */
function formatResponse(template, deviceState = {}) {
  let response = template;

  // 1. Time placeholder
  if (response.includes('{TIME}')) {
    const timeStr = new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    response = response.replace(/{TIME}/g, timeStr);
  }

  // 2. Date placeholder
  if (response.includes('{DATE}')) {
    const dateStr = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    response = response.replace(/{DATE}/g, dateStr);
  }

  // 3. Battery placeholder
  if (response.includes('{BATTERY}')) {
    const batteryVolts = deviceState.battery || "3.70";
    response = response.replace(/{BATTERY}/g, batteryVolts);
  }

  // 4. WiFi SSID placeholder
  if (response.includes('{WIFI_SSID}')) {
    const ssid = deviceState.wifiSsid || "DeskimonNet";
    response = response.replace(/{WIFI_SSID}/g, ssid);
  }

  // 5. WiFi RSSI placeholder
  if (response.includes('{WIFI_RSSI}')) {
    const rssi = deviceState.wifiRssi || "-60";
    response = response.replace(/{WIFI_RSSI}/g, rssi);
  }

  // 6. Volume placeholder
  if (response.includes('{VOLUME}')) {
    const vol = deviceState.volume || "100";
    response = response.replace(/{VOLUME}/g, vol);
  }

  // 7. Boot count placeholder
  if (response.includes('{BOOT_COUNT}')) {
    const boots = deviceState.bootCount || "12";
    response = response.replace(/{BOOT_COUNT}/g, boots);
  }

  return response;
}

/**
 * Matches an input text query against the intent database
 * 
 * @param {string} rawInput - The raw transcription string
 * @param {object} deviceState - Device telemetry (battery, wifiSsid, wifiRssi, volume)
 * @returns {object} Match result: { matched: boolean, intent: string, score: number, responseText: string }
 */
function matchIntent(rawInput, deviceState = {}) {
  const cleanInput = cleanText(rawInput);
  if (!cleanInput) {
    return { matched: false, intent: null, score: 0.0, responseText: "" };
  }

  let bestMatch = {
    intent: null,
    score: 0.0,
    template: ""
  };

  const inputWords = cleanInput.split(' ').filter(w => w.length > 0);

  for (const intent of intentsData.intents) {
    const name = intent.intent_name || intent.name;
    const phrases = intent.example_phrases || intent.phrases || [];
    const keywords = intent.keywords || [];
    const negKeywords = intent.negative_keywords || [];

    // A. Negative Keyword Check
    let hasNegKeyword = false;
    for (const negKw of negKeywords) {
      if (inputWords.includes(cleanText(negKw))) {
        hasNegKeyword = true;
        break;
      }
      // Fuzzy negative keyword check
      for (const word of inputWords) {
        if (getStringSimilarity(word, negKw) > 0.85) {
          hasNegKeyword = true;
          break;
        }
      }
      if (hasNegKeyword) break;
    }

    // If negative keyword is detected, completely disqualify this intent
    if (hasNegKeyword) {
      continue;
    }

    // B. Fuzzy phrase match
    let maxPhraseScore = 0.0;
    for (const phrase of phrases) {
      const score = getPhraseSimilarity(cleanInput, phrase);
      if (score > maxPhraseScore) {
        maxPhraseScore = score;
      }
    }

    // C. Keyword presence check & boost
    let keywordMatches = 0;
    for (const keyword of keywords) {
      // Direct exact match
      if (inputWords.includes(cleanText(keyword))) {
        keywordMatches++;
      } else {
        // Fuzzy keyword match
        for (const word of inputWords) {
          if (getStringSimilarity(word, keyword) > 0.85) {
            keywordMatches += 0.8;
            break;
          }
        }
      }
    }

    const keywordRatio = keywords.length > 0 ? (keywordMatches / keywords.length) : 0.0;
    
    // Calculate final combined score for this intent
    let finalScore = maxPhraseScore;

    // Keywords should only boost the score, never drag it down
    if (keywordRatio > 0) {
      const boosted = (maxPhraseScore * 0.7) + (keywordRatio * 0.3);
      finalScore = Math.max(maxPhraseScore, boosted);
    }

    // Lock exact phrase matches to 1.0
    if (maxPhraseScore === 1.0) {
      finalScore = 1.0;
    } else if (keywordRatio === 1.0 && finalScore < 0.9 && keywords.length >= 3) {
      // Only trigger keyword ratio boost if the intent has a robust set of keywords
      finalScore = 0.95;
    }

    // Capture the best matching intent
    if (finalScore > bestMatch.score) {
      const randomIndex = Math.floor(Math.random() * intent.responses.length);
      bestMatch = {
        intent: name,
        score: finalScore,
        template: intent.responses[randomIndex],
        personality: intent.personality || intent.category
      };
    }
  }

  const confidenceThreshold = 0.90;
  const isMatched = bestMatch.score >= confidenceThreshold;

  return {
    matched: isMatched,
    intent: bestMatch.intent,
    score: parseFloat(bestMatch.score.toFixed(3)),
    responseText: isMatched ? formatResponse(bestMatch.template, deviceState) : "",
    personality: bestMatch.personality || null
  };
}

/**
 * Computes scores for all intents against the rawInput, returning them sorted descending.
 */
function getIntentScores(rawInput) {
  const cleanInput = cleanText(rawInput);
  if (!cleanInput) return [];

  const inputWords = cleanInput.split(' ').filter(w => w.length > 0);
  const scores = [];

  for (const intent of intentsData.intents) {
    const name = intent.intent_name || intent.name;
    const phrases = intent.example_phrases || intent.phrases || [];
    const keywords = intent.keywords || [];
    const negKeywords = intent.negative_keywords || [];

    // A. Negative Keyword Check
    let hasNegKeyword = false;
    for (const negKw of negKeywords) {
      if (inputWords.includes(cleanText(negKw))) {
        hasNegKeyword = true;
        break;
      }
      for (const word of inputWords) {
        if (getStringSimilarity(word, negKw) > 0.85) {
          hasNegKeyword = true;
          break;
        }
      }
      if (hasNegKeyword) break;
    }

    if (hasNegKeyword) {
      scores.push({ intent: name, score: 0.0, disqualified: true });
      continue;
    }

    // B. Fuzzy phrase match
    let maxPhraseScore = 0.0;
    for (const phrase of phrases) {
      const score = getPhraseSimilarity(cleanInput, phrase);
      if (score > maxPhraseScore) {
        maxPhraseScore = score;
      }
    }

    // C. Keyword presence check & boost
    let keywordMatches = 0;
    for (const keyword of keywords) {
      if (inputWords.includes(cleanText(keyword))) {
        keywordMatches++;
      } else {
        for (const word of inputWords) {
          if (getStringSimilarity(word, keyword) > 0.85) {
            keywordMatches += 0.8;
            break;
          }
        }
      }
    }

    const keywordRatio = keywords.length > 0 ? (keywordMatches / keywords.length) : 0.0;
    let finalScore = maxPhraseScore;

    if (keywordRatio > 0) {
      const boosted = (maxPhraseScore * 0.7) + (keywordRatio * 0.3);
      finalScore = Math.max(maxPhraseScore, boosted);
    }

    if (maxPhraseScore === 1.0) {
      finalScore = 1.0;
    } else if (keywordRatio === 1.0 && finalScore < 0.9 && keywords.length >= 3) {
      finalScore = 0.95;
    }

    scores.push({
      intent: name,
      score: parseFloat(finalScore.toFixed(3)),
      disqualified: false
    });
  }

  return scores.sort((a, b) => b.score - a.score);
}

module.exports = {
  matchIntent,
  cleanText,
  getPhraseSimilarity,
  formatResponse,
  getIntentScores
};
