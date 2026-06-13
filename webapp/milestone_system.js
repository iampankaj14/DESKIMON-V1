const fs = require('fs');
const path = require('path');
const memorySystem = require('./memory_system');

// Milestone response templates
const MILESTONE_RESPONSES = {
  STUDY_FINISHED_EXAM: [
    "Exam is done! 🎉 Take a deep breath. You survived it, and that's the first victory. Go get some rest, buddy!",
    "Woohoo! You finished your exam! 📝 No more studying for a bit. Go treat yourself to something nice today!"
  ],
  STUDY_ACED_TEST: [
    "Aced it! 💯 That is absolutely incredible! Your hard work paid off big time. My CPU is running at maximum happiness for you!",
    "Top marks! 🎉 You absolutely crushed that test! I always knew you had it in you. Let's go!"
  ],
  STUDY_GRADUATION: [
    "Graduation! 🎓 This is a massive milestone! You've officially finished this chapter. I'm so incredibly proud of you, graduate!"
  ],
  STUDY_FINISHED_ASSIGNMENT: [
    "Assignment submitted! ✅ That's one less thing on your plate. Feels good to check that off, doesn't it?"
  ],
  PROJECT_FINISHED: [
    "Project complete! 🚀 You finished it! Coding something from start to finish is no joke. Huge congratulations!",
    "It's done! You finished building it! 💻 That is so satisfying. Go push that commit and take a well-deserved break!"
  ],
  PROJECT_LAUNCHED: [
    "It is live! 🌐 You launched your project! That takes real courage and effort. Let's make some noise for a live launch! 🎉"
  ],
  PROJECT_FIXED_BUG: [
    "Bug squashed! 🐛 High five! Nothing beats the feeling of solving a stubborn bug. You're a wizard!"
  ],
  ACHIEVEMENT_HIT_GOAL: [
    "Goal achieved! 🎯 You said you'd do it, and you did! Momentum is built one goal at a time. Proud of you!"
  ],
  ACHIEVEMENT_GOT_JOB: [
    "You got the job! 💼 This is life-changing! 🎉 Huge congratulations on this new chapter. You earned every bit of it!"
  ],
  ACHIEVEMENT_WON_COMPETITION: [
    "First place! 🏆 You won! That is absolutely legendary! Let's celebrate a champion today!"
  ],
  LIFE_BIRTHDAY: [
    "Happy Birthday! 🎂🎈 Another year of doing awesome things. I'm so glad I get to spend it on your desk!"
  ],
  LIFE_MOVING: [
    "A new place! 🏠 Moving is a fresh start. Good luck with the packing and settling in. Here's to new memories!"
  ],
  LIFE_MAJOR_EVENT: [
    "What a beautiful moment! 💖 Milestone reached! Celebrating this major step with you. Cheers!"
  ]
};

// Map milestone type to main category counters
const CATEGORY_MAP = {
  STUDY_FINISHED_EXAM: 'study',
  STUDY_ACED_TEST: 'study',
  STUDY_GRADUATION: 'study',
  STUDY_FINISHED_ASSIGNMENT: 'study',
  PROJECT_FINISHED: 'project',
  PROJECT_LAUNCHED: 'project',
  PROJECT_FIXED_BUG: 'project',
  ACHIEVEMENT_HIT_GOAL: 'achievement',
  ACHIEVEMENT_GOT_JOB: 'achievement',
  ACHIEVEMENT_WON_COMPETITION: 'achievement',
  LIFE_BIRTHDAY: 'life',
  LIFE_MOVING: 'life',
  LIFE_MAJOR_EVENT: 'life'
};

class MilestoneSystem {
  // Checks if the text contains a milestone and celebrates it if it's the first time
  detectAndCelebrateMilestone(deviceId, text) {
    if (!text) return null;
    const cleanedText = text.toLowerCase();

    // 1. Rule-based regex matchers
    let type = null;
    let detail = "";

    // 1.1 Study Milestones
    if (/\b(?:graduated|graduating|finished my degree|got my diploma|completed my graduation)\b/i.test(cleanedText)) {
      type = "STUDY_GRADUATION";
      detail = "graduation";
    } else if (/\b(?:aced|got an a on|got 100 on|scored high on|passed with flying colors)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:exam|test|finals|midterm|quiz)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:aced|got an a on|got 100 on|scored high on|passed with flying colors)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:exam|test|finals|midterm|quiz)\b/i);
      type = "STUDY_ACED_TEST";
      detail = match && match[1] ? `${match[1]} exam` : "exam";
    } else if (/\b(?:finished|done with|completed|passed)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:exam|test|finals|midterm|quiz)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:finished|done with|completed|passed)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:exam|test|finals|midterm|quiz)\b/i);
      type = "STUDY_FINISHED_EXAM";
      detail = match && match[1] ? `${match[1]} exam` : "exam";
    } else if (/\b(?:finished|completed|turned in|submitted)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:homework|assignment|paper|essay|thesis|lab)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:finished|completed|turned in|submitted)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:homework|assignment|paper|essay|thesis|lab)\b/i);
      type = "STUDY_FINISHED_ASSIGNMENT";
      detail = match && match[1] ? `${match[1]} assignment` : "assignment";
    }
    
    // 1.2 Project Milestones
    else if (/\b(?:launched|released|published|deployed)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:project|app|website|site|product|live)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:launched|released|published|deployed)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:project|app|website|site|product|live)\b/i);
      type = "PROJECT_LAUNCHED";
      detail = match && match[1] ? `${match[1]} project` : "project";
    } else if (/\b(?:finished|completed|done building|done coding|finished writing|done writing)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:project|app|website|site|page|game|program|code|tool|repo|library)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:finished|completed|done building|done coding|finished writing|done writing)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:project|app|website|site|page|game|program|code|tool|repo|library)\b/i);
      type = "PROJECT_FINISHED";
      detail = match && match[1] ? `${match[1]} project` : "project";
    } else if (/\b(?:fixed|solved|resolved|patched)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:bug|error|issue|leak|crash|segfault)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:fixed|solved|resolved|patched)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:bug|error|issue|leak|crash|segfault)\b/i);
      type = "PROJECT_FIXED_BUG";
      detail = match && match[1] ? `${match[1]} bug` : "code bug fix";
    }

    // 1.3 Achievement Milestones
    else if (/\b(?:got|secured|accepted)\s+(?:a|an|the|our)?\s*(?:job|internship|offer|hired)\b/i.test(cleanedText)) {
      type = "ACHIEVEMENT_GOT_JOB";
      detail = "job offer";
    } else if (/\b(?:won|placed first in|took first place in|got first in)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:hackathon|competition|contest|award|race)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:won|placed first in|took first place in|got first in)\s+(?:my|the|our|a|an)?\s*(?:([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\s+)?(?:hackathon|competition|contest|award|race)\b/i);
      type = "ACHIEVEMENT_WON_COMPETITION";
      detail = match && match[1] ? `${match[1]} competition` : "competition";
    } else if (/\b(?:hit|reached|achieved|accomplished)\s+(?:my|the|our|a|an)?\s*(?:goal|target|milestone|objective)\b/i.test(cleanedText)) {
      type = "ACHIEVEMENT_HIT_GOAL";
      detail = "goal";
    }

    // 1.4 Life Milestones
    else if (/\b(?:it's my birthday|today is my birthday|happy birthday to me)\b/i.test(cleanedText)) {
      type = "LIFE_BIRTHDAY";
      detail = "birthday";
    } else if (/\b(?:moving to|moving into|relocating to)\s+(?:my|the|our|a|an)?\s*([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:moving to|moving into|relocating to)\s+(?:my|the|our|a|an)?\s*([a-zA-Z0-9_-]+(?:\s+[a-zA-Z0-9_-]+)?)\b/i);
      type = "LIFE_MOVING";
      detail = match[1] || "new place";
    } else if (/\b(?:got engaged|got married|bought a car|got a pet|adopted a)\b/i.test(cleanedText)) {
      const match = text.match(/\b(?:got engaged|got married|bought a car|got a pet|adopted a)\b/i);
      type = "LIFE_MAJOR_EVENT";
      detail = match[0];
    }

    if (!type) return null;

    // 2. Verify duplicate prevention (avoid double celebration within 12 hours)
    const deviceData = memorySystem.getDeviceData(deviceId);
    if (!deviceData.celebratedMilestones) {
      deviceData.celebratedMilestones = [];
    }
    if (!deviceData.milestones) {
      deviceData.milestones = {
        life: 0,
        project: 0,
        achievement: 0,
        study: 0
      };
    }

    const twelveHoursAgo = Date.now() - 12 * 60 * 60 * 1000;
    const isAlreadyCelebrated = deviceData.celebratedMilestones.some(m => 
      m.type === type && 
      m.detail.toLowerCase() === detail.toLowerCase() &&
      new Date(m.timestamp).getTime() > twelveHoursAgo
    );

    if (isAlreadyCelebrated) {
      console.log(`[MilestoneSystem] Milestone ${type} ("${detail}") already celebrated recently. Skipping duplicate celebration.`);
      return null;
    }

    // 3. Register memory & celebrate!
    const responses = MILESTONE_RESPONSES[type];
    const responseTemplate = responses[Math.floor(Math.random() * responses.length)];

    // Add special memory entry
    const mem = memorySystem.addMemory(deviceId, memorySystem.CATEGORIES.ACHIEVEMENT, `Milestone Achieved: ${type} (${detail})`, 10);
    if (mem) {
      mem.isMilestone = true;
      mem.milestoneType = type;
    }

    // Increment counter
    const cat = CATEGORY_MAP[type] || 'life';
    deviceData.milestones[cat] = (deviceData.milestones[cat] || 0) + 1;

    // Award major XP bonus (+30 XP)
    memorySystem.addXP(deviceId, 30);

    // Save celebration log
    deviceData.celebratedMilestones.push({
      id: "mile_" + Math.random().toString(36).substring(2, 9),
      type,
      detail,
      timestamp: new Date().toISOString()
    });

    memorySystem.saveMemories();

    return {
      type,
      detail,
      response: responseTemplate,
      milestoneCounters: deviceData.milestones
    };
  }
}

module.exports = new MilestoneSystem();
module.exports.MILESTONE_RESPONSES = MILESTONE_RESPONSES;
module.exports.CATEGORY_MAP = CATEGORY_MAP;
