const fs = require('fs');
const path = require('path');

const memoriesFilePath = path.join(__dirname, 'memories.json');

// Memory categories
const CATEGORIES = {
  PROJECT: 'PROJECT',
  EXAM: 'EXAM',
  GOAL: 'GOAL',
  ACHIEVEMENT: 'ACHIEVEMENT',
  GENERAL_EVENT: 'GENERAL_EVENT'
};

// Default TTLs in milliseconds
const TTLS = {
  PROJECT: 30 * 24 * 60 * 60 * 1000,      // 30 days
  EXAM: 3 * 24 * 60 * 60 * 1000,          // 3 days
  GOAL: 30 * 24 * 60 * 60 * 1000,         // 30 days
  ACHIEVEMENT: null,                       // Permanent
  GENERAL_EVENT: 5 * 24 * 60 * 60 * 1000  // 5 days
};

class MemorySystem {
  constructor() {
    this.db = { devices: {} };
    this.loadMemories();
  }

  loadMemories() {
    try {
      if (fs.existsSync(memoriesFilePath)) {
        this.db = JSON.parse(fs.readFileSync(memoriesFilePath, 'utf8'));
      } else {
        this.db = { devices: {} };
        this.saveMemories();
      }
    } catch (err) {
      console.error("[MemorySystem] Failed to load memories.json:", err.message);
      this.db = { devices: {} };
    }
  }

  saveMemories() {
    try {
      fs.writeFileSync(memoriesFilePath, JSON.stringify(this.db, null, 2));
    } catch (err) {
      console.error("[MemorySystem] Failed to save memories.json:", err.message);
    }
  }

  getDeviceData(deviceId) {
    if (!this.db.devices[deviceId]) {
      this.db.devices[deviceId] = {
        memories: [],
        relationship: {
          level: 1,
          xp: 0,
          positiveInteractions: 0,
          negativeInteractions: 0,
          lastInteractionAt: new Date().toISOString()
        }
      };
    }
    return this.db.devices[deviceId];
  }

  // Increment relationship XP and check for level ups
  addXP(deviceId, amount) {
    const data = this.getDeviceData(deviceId);
    const rel = data.relationship;
    rel.xp += amount;
    rel.lastInteractionAt = new Date().toISOString();

    // Level thresholds: Level 1 (0 XP), Level 2 (50 XP), Level 3 (150 XP), Level 4 (350 XP), Level 5 (700 XP)
    const prevLevel = rel.level;
    if (rel.xp >= 700) rel.level = 5;
    else if (rel.xp >= 350) rel.level = 4;
    else if (rel.xp >= 150) rel.level = 3;
    else if (rel.xp >= 50) rel.level = 2;
    else rel.level = 1;

    if (rel.level > prevLevel) {
      console.log(`[MemorySystem] RELATIONSHIP LEVEL UP for device ${deviceId.substring(0,8)}! Level ${prevLevel} -> ${rel.level}`);
    }
    this.saveMemories();
  }

  getRelationshipName(level) {
    const names = {
      1: "Acquaintance",
      2: "Desk Partner",
      3: "Reliable Companion",
      4: "Close Friend",
      5: "Soulmate Companion"
    };
    return names[level] || "Acquaintance";
  }

  // Add a new memory entry
  addMemory(deviceId, category, content, importance, ttlMs = null) {
    const data = this.getDeviceData(deviceId);
    
    // Clean expired memories first
    this.cleanExpiredMemories(deviceId);

    const now = Date.now();
    const expiresAt = ttlMs ? new Date(now + ttlMs).toISOString() : null;

    // Detect if this is a signature moment
    const isSignatureMoment = importance >= 8;

    // Build keywords from content
    const stopWords = ["i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "he", "him", "his", "she", "her", "it", "its", "they", "them", "their", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", "over", "under", "again", "further", "then", "once"];
    const keywords = content.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"’?]/g, "")
      .split(" ")
      .filter(w => w.length > 2 && !stopWords.includes(w));

    // Prevent duplicate active memories with identical content
    const isDuplicate = data.memories.some(m => m.category === category && m.content.toLowerCase() === content.toLowerCase());
    if (isDuplicate) {
      return null;
    }

    const newMemory = {
      id: "mem_" + Math.random().toString(36).substring(2, 9),
      category,
      content,
      keywords,
      importance,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      isSignatureMoment
    };

    data.memories.push(newMemory);
    console.log(`[MemorySystem] SAVED MEMORY: [${category}] "${content}" (Importance: ${importance}, Signature: ${isSignatureMoment})`);

    // Rewards for memories
    if (isSignatureMoment) {
      console.log(`[SIGNATURE MOMENT DETECTED] for device ${deviceId.substring(0,8)}!`);
      this.addXP(deviceId, 15);
    } else {
      this.addXP(deviceId, 5);
    }

    this.saveMemories();
    return newMemory;
  }

  // Helper to clean expired memories
  cleanExpiredMemories(deviceId) {
    const data = this.getDeviceData(deviceId);
    const now = new Date().getTime();
    const initialCount = data.memories.length;
    data.memories = data.memories.filter(mem => {
      if (!mem.expiresAt) return true;
      return new Date(mem.expiresAt).getTime() > now;
    });
    if (data.memories.length < initialCount) {
      console.log(`[MemorySystem] Expired ${initialCount - data.memories.length} memories for device ${deviceId.substring(0,8)}.`);
      this.saveMemories();
    }
  }

  // Analyze text to automatically extract and store memory
  detectAndStoreMemory(deviceId, text) {
    if (!text) return null;
    const cleanedText = text.toLowerCase();
    
    // Heuristic 1: Achievements (Highest importance, checks first)
    // "i passed my chemistry exam" / "finished my website" / "got the job"
    const achievementRegex = /\b(?:passed my|finished my|completed the|got the job|finally did|passed the)\s+([a-zA-Z0-9_\-\s]{3,30})\b/i;
    const achievementMatch = text.match(achievementRegex);
    if (achievementMatch && achievementMatch[1]) {
      const achName = achievementMatch[1].trim();
      return this.addMemory(deviceId, CATEGORIES.ACHIEVEMENT, `User achieved: ${achName}`, 9, TTLS.ACHIEVEMENT);
    }

    // Heuristic 2: Exams
    // "i have an exam tomorrow" / "physics test on monday" / "finals next week"
    const examRegex = /\b(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(exam|test|finals|midterm)\s+(?:(?:is\s+)?(?:tomorrow|on\s+[a-zA-Z0-9_-]+|next\s+[a-zA-Z0-9_-]+))\b/i;
    const examMatch = text.match(examRegex);
    if (examMatch) {
      const subject = examMatch[1] ? examMatch[1].trim() : "";
      const examType = examMatch[2].trim();
      const examDetail = examMatch[0].trim();
      const content = subject && !["an", "a", "my", "the"].includes(subject.toLowerCase()) 
        ? `User has ${subject} ${examType}: ${examDetail}` 
        : `User has: ${examDetail}`;
      return this.addMemory(deviceId, CATEGORIES.EXAM, content, 8, TTLS.EXAM);
    }

    // Heuristic 3: Projects
    // "i am working on my compiler" / "i'm building a robot" / "coding a website"
    const projectRegex = /\b(?:working on|building|creating|coding|developing|programming)\s+(?:a|an|my)?\s*([a-zA-Z0-9_\-\s]{3,30})\b/i;
    const projectMatch = text.match(projectRegex);
    if (projectMatch && projectMatch[1]) {
      const projName = projectMatch[1].trim();
      if (!["something", "it", "code", "this", "that", "a project", "projects"].includes(projName)) {
        return this.addMemory(deviceId, CATEGORIES.PROJECT, `User is working on: ${projName}`, 7, TTLS.PROJECT);
      }
    }

    // Heuristic 4: Goals
    // "my goal is to exercise" / "i want to learn rust" / "planning to finish my thesis"
    const goalRegex = /\b(?:my goal is|i want to|planning to|going to try to)\s+([a-zA-Z0-9_\-\s]{3,50})\b/i;
    const goalMatch = text.match(goalRegex);
    if (goalMatch && goalMatch[1]) {
      const goalName = goalMatch[1].trim();
      if (!["sleep", "go", "do it", "do this", "eat"].includes(goalName)) {
        return this.addMemory(deviceId, CATEGORIES.GOAL, `User's goal: ${goalName}`, 6, TTLS.GOAL);
      }
    }

    // Heuristic 5: Important user events
    if (cleanedText.includes("my birthday") || cleanedText.includes("its my birthday")) {
      return this.addMemory(deviceId, CATEGORIES.GENERAL_EVENT, "It is the user's birthday", 9, TTLS.GENERAL_EVENT);
    }
    if (cleanedText.includes("vacation") || cleanedText.includes("holiday")) {
      return this.addMemory(deviceId, CATEGORIES.GENERAL_EVENT, `User event: going on vacation`, 5, TTLS.GENERAL_EVENT);
    }

    return null;
  }

  // Retrieve memories relevant to the user query
  retrieveRelevantMemories(deviceId, queryText, limit = 2) {
    this.cleanExpiredMemories(deviceId);
    const data = this.getDeviceData(deviceId);
    const memories = data.memories;

    if (memories.length === 0) return [];

    const queryWords = queryText.toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?'"’?]/g, "")
      .split(" ")
      .filter(w => w.length > 2);

    const scoredMemories = memories.map(mem => {
      let matchCount = 0;
      mem.keywords.forEach(kw => {
        if (queryWords.includes(kw)) matchCount++;
      });

      const sim = queryWords.length > 0 ? (matchCount / queryWords.length) : 0.0;
      const retrievalScore = (sim * 0.7) + ((mem.importance / 10) * 0.3);

      return {
        memory: mem,
        score: retrievalScore
      };
    });

    scoredMemories.sort((a, b) => b.score - a.score);
    return scoredMemories.slice(0, limit).map(sm => sm.memory);
  }

  // Get a summary string of the device state (relationship level, active memories) to inject into prompts
  getMemoryContextPrompt(deviceId) {
    this.cleanExpiredMemories(deviceId);
    const data = this.getDeviceData(deviceId);
    const rel = data.relationship;
    const relName = this.getRelationshipName(rel.level);

    let prompt = `[Deskimon Memory Context]\n`;
    prompt += `Relationship Level: ${rel.level} (${relName}), XP: ${rel.xp}\n`;
    
    if (data.memories.length > 0) {
      prompt += `Active Memories:\n`;
      data.memories.forEach(mem => {
        prompt += `- [${mem.category}] ${mem.content} (Recorded: ${mem.createdAt.split('T')[0]})\n`;
      });
    } else {
      prompt += `Active Memories: None yet. Keep track of what they are working on, goals, exams, or achievements.\n`;
    }

    return prompt;
  }
}

module.exports = new MemorySystem();
module.exports.CATEGORIES = CATEGORIES;
module.exports.TTLS = TTLS;
