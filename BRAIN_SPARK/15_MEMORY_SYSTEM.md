# 15 — MEMORY SYSTEM

## Overview

SPARK has two distinct memory systems that serve very different purposes:

| System | Location | Purpose |
|--------|----------|---------|
| **Firmware Memory** | ESP32-S3 hardware | RAM management, PSRAM usage, Flash storage |
| **User Memory** | `memory_system.js` (server) | Persistent user facts, relationship tracking |

---

## Part 1: Firmware Memory

### Hardware Memory Resources (ESP32-S3)
- **Internal SRAM:** ~512KB — Critical. Used for FreeRTOS stacks, LVGL internal state, I2C/SPI buffers, DMA descriptors
- **PSRAM (8MB):** Used for audio recording buffers (WAV data), LVGL display framebuffers, MP3 playback buffer, Wi-Fi network stack
- **Flash (16MB):** Stores firmware binary, NVS (settings), constant data (`.rodata`)

### Key Memory Design Decisions

**Face configs in Flash:**
- `static const spark_face_config_t SPARK_FACES[SPARK_FACE_MAX]` is stored in `.rodata` (Flash)
- Never loads into SRAM unless read
- Saves ~2KB of critical internal SRAM

**LVGL framebuffer in PSRAM:**
- The display draw buffers are allocated in PSRAM to avoid SRAM pressure
- Cost: slightly slower DMA access, but acceptable for 60fps display

**Audio buffer in PSRAM:**
- WAV recording buffer and MP3 playback buffer both reside in PSRAM
- Prevents heap fragmentation in internal SRAM during audio operations

**Animation callbacks on stack:**
- `lv_anim_t` structs are stack-allocated inside `Spark_Anim_Prop()` — they are copied by LVGL into its own internal queue
- No heap allocation for individual animations

### NVS (Non-Volatile Storage)
Stores persistent device settings across power cycles:
- Device UUID / identifier
- Wi-Fi SSID + password
- Volume level (default: 100)
- Boot count

### Partition Layout (`partitions.csv`)
- App partition: main firmware binary
- NVS partition: device settings
- Additional partitions for OTA updates (if implemented)

---

## Part 2: User Memory System (`memory_system.js`)

### Storage
All user memories are stored in `webapp/memories.json` — a JSON file on the server. It is loaded at startup and written on every modification.

### Data Structure
```json
{
  "devices": {
    "<device-uuid>": {
      "memories": [
        {
          "category": "PROJECT",
          "content": "Working on a Figma redesign for client X",
          "storedAt": "2026-06-20T10:00:00Z",
          "expiresAt": "2026-07-20T10:00:00Z"
        }
      ],
      "relationship": {
        "level": 2,
        "xp": 73,
        "positiveInteractions": 45,
        "negativeInteractions": 2,
        "lastInteractionAt": "2026-06-26T18:00:00Z"
      }
    }
  }
}
```

### Memory Categories and TTLs

| Category | Example | TTL |
|----------|---------|-----|
| `PROJECT` | "Working on a Figma redesign" | 30 days |
| `EXAM` | "Physics exam tomorrow" | 3 days |
| `GOAL` | "Finish the module by Friday" | 30 days |
| `ACHIEVEMENT` | "Got the internship" | **Permanent** |
| `GENERAL_EVENT` | "Going to a concert tonight" | 5 days |

### How Memory Is Used
When a Gemini fallback response is generated:
1. `memorySystem.getMemoryContext(deviceId)` → formats relationship level into a text summary
2. `memorySystem.findRelevantMemories(deviceId, transcript)` → keyword-matches the current query against stored memories
3. Both are injected into the Gemini system prompt:
   ```
   Current Relationship Context:
   You are at Level 2 (Desk Partner) with this user. XP: 73.

   [Highly Relevant User Memories — reference if appropriate]:
   - PROJECT: Working on a Figma redesign (stored 6 days ago)
   ```

Spark then responds with natural awareness of what the user has shared previously.

### Relationship Levels

| Level | Name | XP |
|-------|------|----|
| 1 | Acquaintance | 0 |
| 2 | Desk Partner | 50 |
| 3 | Reliable Companion | 150 |
| 4 | Close Friend | 350 |
| 5 | Soulmate Companion | 700 |

**XP is earned:** +1 XP per voice interaction. Level-ups logged in server console.

---

## Part 3: Conversation Session Memory

Managed by `ConversationManager` in `server_daemon.js`. This is **short-term, per-session** memory.

- **Storage:** In-memory Map (lost on server restart)
- **Scope:** Per device ID
- **TTL:** 60 seconds of inactivity
- **Max turns:** 10 message pairs (5 user + 5 Spark exchanges)
- **Cleanup:** Runs every 30 seconds, removes expired sessions

When a new Gemini request is made, all prior turns from the current session are prepended to the `contents` array, giving Gemini multi-turn conversational context.

---

## Memory Limits and Risks

| Risk | Mitigation |
|------|-----------|
| `memories.json` grows without bound | TTL-based expiry on all non-ACHIEVEMENT categories |
| PSRAM audio buffer pointer lost during crash | Audio buffer is re-allocated each recording session |
| ConversationManager session not cleaned up | 30-second periodic cleanup + 60s TTL |
| Internal SRAM exhaustion (LVGL + audio + network) | Face configs in Flash, PSRAM for large buffers |
| I2C bus contention during sensor polling | Hardware task has 6s startup delay; polls at 100ms intervals on Core 0 |
