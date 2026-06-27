# 11 — DATA FLOW

Complete data flow diagrams for every major interaction in SPARK.

---

## 1. Voice Interaction — Full Pipeline

```
USER SPEAKS
    │
    ▼
[ESP32 Microphone — I2S]
  Records raw audio to PSRAM buffer
  Encodes as WAV (16-bit, 16kHz mono)
    │
    ▼
[HTTP POST to server_daemon:3001/api/voice]
  Body: WAV binary
  Headers:
    X-Device-Id:          <device UUID>
    X-Device-Battery:     <voltage, e.g. "3.95">
    X-Device-Volume:      <0–100>
    X-Device-WiFi-SSID:   <SSID string>
    X-Device-WiFi-RSSI:   <dBm value>
    X-Device-Boot-Count:  <boot counter>
    │
    ▼
[server_daemon.js — transcribeAudio()]
  Try: Groq Whisper API → plain text transcript (~200ms)
  Fail: Gemini STT API  → plain text transcript (~900ms)
    │
    ▼
[checkAndCleanWakeWord()]
  Strip "Hey Spark" / "Hey Deskimon" prefix if detected
  If only wake word was spoken → default to "hi"
    │
    ▼
[milestoneSystem.detectAndCelebrateMilestone()]
  Regex-match against life event patterns
  If milestone detected → use celebration response (skip Gemini)
  If no milestone → memorySystem.detectAndStoreMemory()
  Always: memorySystem.addXP(deviceId, 1)
    │
    ▼
[matchIntent(transcribedText, deviceState)]
  Normalize → Levenshtein + Token score → Substring boost
  Score ≥ 0.90 → LOCAL MATCH
    Return template response + interpolate {TIME}, {DATE}, etc.
  Score < 0.90 → GEMINI FALLBACK
    Build contents array from ConversationManager turns
    Add current query as latest user turn
    POST to Gemini 2.5 Flash with spark_personality system prompt
    │
    ▼
[TTSProvider.synthesize(text)]
  Microsoft Edge TTS (en-US-AvaNeural, +10% speed)
  OR ElevenLabs TTS
  Returns MP3 binary buffer
    │
    ▼
[HTTP Response — MP3 binary]
  Status 200
  Content-Type: audio/mpeg
    │
    ▼
[ESP32 — Audio playback]
  Stores MP3 in PSRAM buffer
  Decodes and streams to PCM5101 I2S DAC → Speaker
```

---

## 2. Hardware Event Flow (IMU / Touch)

```
PHYSICAL INTERACTION
    │
    ├─── TILT UP (Y accel > 0.6g)
    │       └── spark_hardware_task fires SPARK_HW_EVENT_TILT_UP callback
    │                └── deskimon.c handler → Spark_Emotion_Set("crying")
    │                                              └── Spark_Face_Set(SPARK_FACE_CRY)
    │
    ├─── SHAKE (delta > 1.5g²)
    │       └── spark_hardware_task fires SPARK_HW_EVENT_SHAKE callback
    │                └── deskimon.c handler → Spark_Emotion_Set("angry")
    │                                              └── Spark_Face_Set(SPARK_FACE_ANGRY)
    │
    ├─── SWIPE LEFT/RIGHT (touch gesture)
    │       └── deskimon.c touch event → Spark_Face_Set(SPARK_FACE_BLUSH)
    │
    ├─── SWIPE UP (touch gesture)
    │       └── deskimon.c touch event → Spark_Face_Set(SPARK_FACE_WTF)
    │
    ├─── SWIPE DOWN (touch gesture)
    │       └── deskimon.c touch event → Spark_Face_Set(SPARK_FACE_OOH)
    │
    ├─── DOUBLE TAP (touch gesture)
    │       └── deskimon.c touch event → Spark_Face_Set(SPARK_FACE_LAUGH)
    │                                    (or comfort if currently crying)
    │
    └─── TRIPLE TAP (touch gesture)
             └── deskimon.c touch event → Spark_Face_Set(SPARK_FACE_ANGRY)
```

---

## 3. Face Transition Flow

```
Spark_Face_Set(SPARK_FACE_HAPPY) called
    │
    ▼
Skip if already HAPPY (guard check)
    │
    ▼
If leaving IGNORE: fade in base eye containers
    │
    ▼
Update s_current_face = SPARK_FACE_HAPPY
    │
    ▼
Get config: cfg = &SPARK_FACES[SPARK_FACE_HAPPY]
    │
    ▼
If INSECURE/INTEREST/IGNORE/EYES_CLOSED:
  → Fade OUT base eye containers
Else:
  → Fade IN base eye containers
    │
    ▼
hide_all_masks(300ms)
  → Animate all 4 mask objects (TOP_L, TOP_R, MOON_L, MOON_R) to Y=-400
    │
    ▼
hide_all_accessories(300ms)
  → Fade all mouth/tear/eye accessories to opacity 0
    │
    ▼
Apply eye geometry (if eye is_visible):
  Spark_Anim_AnimateEyeBase(LEFT, w, h, angle, tx, ty, transition_ms)
  Spark_Anim_AnimateEyeBase(RIGHT, w, h, angle, tx, ty, transition_ms)
    │
    ▼
Apply mask positions (if mask_y != -400 sentinel):
  Animate MASK_TOP_L/R, MASK_MOON_L/R to their new Y positions
    │
    ▼
Apply face-specific accessories (switch statement):
  HAPPY → (no accessories)
  BLUSH → show MOUTH_ARC_L + MOUTH_ARC_R
  CRY   → show TEAR_L + TEAR_R
  LAUGH → show LAUGH_MOUTH (animate height 5→70)
  OOH   → animate eye size + show/animate MOUTH_OOH
  WTF   → animate eye size + show/animate MOUTH_WTF + WTF_CIRCLE
  etc.
```

---

## 4. Personality + Memory Context Assembly (Gemini Fallback)

```
fetchDevicePreset(deviceId)
  → Check presetCache (60s TTL)
  → On miss: query Supabase device_preferences table
    │
    ▼
memorySystem.getMemoryContext(deviceId)
  → Load memories.json
  → Format relationship context (level name + XP)
    │
    ▼
memorySystem.findRelevantMemories(deviceId, transcribedText)
  → Keyword-match current query against stored facts
    │
    ▼
buildSystemInstruction(preset, customPrompt, memoryContext, memorySnippet)
  → SPARK_BASE_IDENTITY + PRESET_ADDENDUMS[preset] + memoryContext + memorySnippet
    │
    ▼
Gemini 2.5 Flash API call:
  systemInstruction: assembled prompt
  contents: [prior turns from ConversationManager] + [current query]
    │
    ▼
Gemini returns text response
    │
    ▼
ConversationManager.addTurn(deviceId, userText, aiResponse)
  → Stores turn pair, trims to max 10 entries
```

---

## 5. Telemetry Header Data Flow

Telemetry is attached by the ESP32 on every voice request. The server uses these values for placeholder substitution in intent responses.

```
ESP32 firmware → headers:
  X-Device-Id          → deviceId variable in server_daemon.js
  X-Device-Battery     → substituted into {BATTERY} placeholder
  X-Device-Volume      → substituted into {VOLUME} placeholder
  X-Device-WiFi-SSID   → substituted into {WIFI_SSID} placeholder
  X-Device-WiFi-RSSI   → substituted into {WIFI_RSSI} placeholder
  X-Device-Boot-Count  → substituted into {BOOT_COUNT} placeholder

Server generates:
  Current time         → substituted into {TIME} placeholder
  Current date         → substituted into {DATE} placeholder
```
