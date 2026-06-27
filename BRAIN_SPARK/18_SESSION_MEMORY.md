# 18 — SESSION MEMORY

A chronological record of major development sessions and what was accomplished.

---

## Session: Initial Architecture & Supabase Pipeline
**Outcome:** First working voice pipeline using Supabase as an audio relay. Device could speak and receive responses.
**Latency:** ~16–20 seconds. Functional but unusably slow.
**State left in:** Supabase shuttle working, ESP32 uploaded WAV, polled for MP3 response.

---

## Session: Direct HTTP Refactor (Phase 1)
**Goal:** Cut Supabase from the voice path entirely.
**What was done:**
- `server_daemon.js` created as the single voice processing server on port 3001
- ESP32 `Cloud_Upload.c` updated to POST WAV directly and receive MP3 in response body
- Zero Supabase I/O in the audio path
**Result:** Latency dropped from ~16–20s to ~7–8s.

---

## Session: Audio Quality Improvements (Phase 1.1)
**What was done:**
- Switched TTS voice from robotic multilingual → `en-US-AvaNeural`
- Reduced speaking rate: `+40%` → `+10%`
- Increased I2S volume multiplier: `4.0f` → `10.0f` in `PCM5101.c`
**Result:** Voice sounds natural. Speaker volume audible in desk environment.

---

## Session: Local Intent Engine (Phase 2)
**What was done:**
- Designed and built `intent_matcher.js` (Levenshtein + token Jaccard scoring)
- Created `intents.json`: 50 intents, 219 example phrases, 500 personality responses
- Integrated wake word detection and stripping
- Dynamic placeholder substitution (`{TIME}`, `{DATE}`, `{BATTERY}`, etc.)
**Result:** ~45% of queries handled locally. Total latency for local matches: ~1.1s.

---

## Session: Groq Whisper STT Integration (Phase 2.1)
**What was done:**
- Created abstract `STTProvider` interface (`stt_interface.js`)
- Implemented `providers/groq_provider.js` (Groq Whisper API)
- Retained `providers/gemini_provider.js` as automatic failover
- `STT_PROVIDER` env var controls which is primary
**Result:** STT latency: 900ms → 150–300ms. 4.5x improvement.

---

## Session: Architecture Audit & SparkCore Design
**What was done:**
- Conducted full architectural audit of firmware (`ARCHITECTURE_AUDIT.md`)
- Identified tight coupling, race conditions, scalability bottlenecks
- Designed the SparkCore manager architecture (6 independent managers)
- Created `ARCHITECTURE.md` as the design specification
**Result:** Architecture plan approved. Ready for implementation.

---

## Session: SparkCore Implementation & Migration
**What was done:**
- Created `SparkCore/` directory and implemented all 6 managers:
  - `spark_state.c/h` — 9-state FSM
  - `spark_hardware.c/h` — IMU polling task, battery, backlight
  - `spark_face.c/h` — 18 face configs in static Flash array
  - `spark_animation.c/h` — type-safe LVGL animation wrappers
  - `spark_emotion.c/h` — intent→emotion→face translation
  - `spark_intent.c/h` — mic recording interface
- Converted `deskimon.c` from state owner to pure LVGL DOM + event router
- Replaced direct cross-module calls with manager APIs
- Fixed LVGL animation cast corruption bugs
- Restructured repo into `SPARK-V1/firmware/` layout
**Result:** OOM crashes eliminated. Face transitions O(1). Clean module boundaries.

---

## Session: Dev Mode Removal & V1 QA
**What was done:**
- Removed all developer bypass mechanisms from `deskimon.c`:
  - `FACE_PREVIEW_MODE` and `s_developer_mode` flags
  - 5-second press dev mode toggle
  - Tap-to-cycle face bypass
  - On-screen label overlays
  - Hardcoded boot face interception
- Retained `HARDWARE_VALIDATION_TEST` as compile-time define at `0`
- Generated `SPARK_V1_RELEASE_REPORT.md` — all systems PASS
**Result:** Firmware passes static QA. Ready for physical hardware validation.

---

## Session: Face Dev Mode Implementation
**Goal:** Test and debug all face expressions on physical hardware without the full boot sequence.
**What was done:**
- Added `#define SPARK_FACE_DEV_MODE 1` at top of `main.c`
- Modified `app_main()` to conditionally boot into `Deskimon_FaceDevMode_Start()` vs full `Deskimon_Start()`
- Face dev mode: boots only LCD + LVGL + Face + Animation managers — no network, no audio, no mic
- `Deskimon_FaceDevMode_Start()` cycles through face expressions for visual inspection
**Current state:** `SPARK_FACE_DEV_MODE 1` is active in the current build.

---

## Session: Personality & Memory Systems (Server)
**What was done:**
- Created `spark_personality.js` as single source of truth for Spark's AI character
- Defined base identity + 5 personality presets + custom prompt support
- Built `memory_system.js`: per-device fact storage, XP tracking, relationship levels 1–5
- Built `milestone_system.js`: detects life/study/project achievements, generates in-character celebrations
- Integrated multi-turn `ConversationManager` (10-turn window, 60s TTL)
- Added `presetCache` (60s TTL) to avoid per-request Supabase queries
**Result:** Spark has persistent memory, growing relationships, and celebrates user milestones.

---

## Notes on Key Files Modified Across Sessions

| File | Change Summary |
|------|---------------|
| `main.c` | Cleaned up task spawning, added SparkCore init, added dev mode flag |
| `LVGL_UI/deskimon.c` | Stripped state logic, now pure DOM creator + event router |
| `MIC_Driver/MIC_Speech.c` | Replaced `Deskimon_SetEmotion()` calls with `Spark_Emotion_ProcessIntent()` |
| `Cloud/Cloud.c` | Replaced `Deskimon_SetEyeColor()` with `Spark_Face_SetColor()` |
| `Cloud/Cloud_Upload.c` | Replaced Supabase upload with direct HTTP POST |
| `webapp/server_daemon.js` | Complete rewrite from stub to full voice pipeline |
| `webapp/intent_matcher.js` | New file — local intent matching engine |
| `webapp/intents.json` | New file — 50 intents with 500 responses |
| `webapp/spark_personality.js` | New file — Spark's AI character definition |
| `webapp/memory_system.js` | New file — user memory + relationship tracking |
| `webapp/milestone_system.js` | New file — life event detection |
