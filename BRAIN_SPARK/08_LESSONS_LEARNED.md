# 08 — LESSONS LEARNED

Every major mistake, what caused it, and what was learned.

---

## Lesson 1: Database Relays Do Not Belong in Real-Time Audio Pipelines

**What happened:** The first version used Supabase storage as a message shuttle between the ESP32 and the server. Upload WAV → poll → download → process → upload MP3 → poll → download. This produced 16–20 second latencies.

**Root cause:** The architecture was designed around database availability, not latency. Treating a storage bucket as a message queue is an anti-pattern for real-time media.

**What was learned:** Audio pipelines must be request-response. The ESP32 should POST audio and receive audio back in the same HTTP transaction. Any intermediate storage creates compounding delays.

**Fix:** Direct HTTP POST to `server_daemon.js` returning MP3 in the response body. Latency dropped to ~7s immediately.

---

## Lesson 2: Never Route Simple Queries to an LLM

**What happened:** Every voice input — including "hi", "good morning", "what time is it" — was sent to Gemini. This consumed rate-limited quota, added 4–5 seconds per request, and produced inconsistent personality responses.

**Root cause:** It was easier to forward everything to Gemini than to build a local matcher. The shortcut worked for testing but not for production.

**What was learned:** Local intent matching for structured, common queries is not optional — it's essential for any interactive voice system. The latency and cost savings are dramatic. Gemini should only receive queries that genuinely require generative capability.

**Fix:** `intent_matcher.js` with 50 intents and 0.90 confidence threshold. ~45% of queries now handled locally in ~5–10ms.

---

## Lesson 3: Tight Coupling Between UI and Voice Logic Causes Race Conditions

**What happened:** `MIC_Speech.c` called `Deskimon_SetEmotion()` directly. `Cloud_Upload.c` called `Deskimon_SetEyeColor()` directly. Touch events in `deskimon.c` called `MIC_StartRecordingManual()`. This created circular dependencies and timing races — the screen would tear, animations would interrupt each other, OOM crashes occurred when both the microphone daemon and cloud daemon tried to update LVGL simultaneously.

**Root cause:** No architectural boundary between hardware, voice, and UI layers. Everything was globally accessible and called directly.

**What was learned:** On a real-time embedded system, UI mutations must go through a single gatekeeper. Hardware events must go through a callback registry, not direct function calls. State changes must be atomic and centralized.

**Fix:** SparkCore manager architecture. `MIC_Speech.c` now calls `Spark_Emotion_ProcessIntent()`. Cloud callbacks call `Spark_Face_SetColor()`. The Face Manager is the single entry point for all visual changes.

---

## Lesson 4: Hardcoded Faces as Switch-Cases Don't Scale

**What happened:** The original `deskimon.c` had a giant `switch (eye_state)` block. Every face was defined with inline LVGL property calls. Adding a new face required understanding the entire block. The file grew to thousands of lines.

**Root cause:** Natural "quickest path" coding — adding a case to a switch is fast. It works for 5 faces. It breaks down at 20+.

**What was learned:** Faces are data, not code. As soon as you have more than a handful of visual states, they must be described as structs and interpreted by a generic renderer.

**Fix:** `SPARK_FACES[]` static const array in Flash. `Spark_Face_Set()` reads the struct and applies transitions uniformly. Adding a new face is now one struct entry.

---

## Lesson 5: LVGL Animation Casts Are Dangerous

**What happened:** The original animation code used `(lv_anim_exec_xcb_t)lv_obj_set_style_translate_y` — casting a style setter function to the LVGL animation callback type. This produced undefined behavior during screen redraws, causing occasional crashes and visual corruption.

**Root cause:** LVGL's animation API requires callbacks with a specific signature `void cb(void *var, int32_t v)`. Directly casting LVGL style setters (which have different signatures) is not type-safe and invokes undefined behavior.

**What was learned:** Always write explicit wrapper functions for LVGL animation callbacks. Never cast style setters directly.

**Fix:** `Spark_Anim_SetWidthCb`, `Spark_Anim_SetHeightCb`, `Spark_Anim_SetTyCb`, etc. in `spark_animation.c` — each is a properly typed wrapper that internally calls the correct LVGL function.

---

## Lesson 6: Storing Face Configs in RAM Wastes Precious SRAM

**What happened:** Face configuration data (coordinates, sizes, transition times for all expressions) was held in global variables in SRAM. This consumed ~2KB of internal RAM that was needed for the audio buffer and network stack.

**Root cause:** Default C behavior — global variables go to SRAM unless explicitly placed in Flash.

**What was learned:** Any large, read-only configuration array must be marked `static const` to let the compiler place it in Flash (`.rodata`). On ESP32-S3, SRAM is a critical resource — audio DMA, LVGL framebuffer, and network stack all compete for it.

**Fix:** `static const spark_face_config_t SPARK_FACES[SPARK_FACE_MAX]` in `spark_face.c`. Saved ~2KB of SRAM.

---

## Lesson 7: Developer Bypasses Left in Production Code Are Liabilities

**What happened:** During development, a 5-second long press toggled `s_developer_mode`, which bypassed gesture handling and allowed tap-to-cycle through all face states. These bypasses were left in the codebase.

**Root cause:** Convenience during testing. The developer mode was added quickly and never had a clear "remove before production" marker.

**What was learned:** Every dev bypass must be documented the moment it's added, with an explicit removal plan. Compile-time flags (`#define DEV_MODE 0`) are safer than runtime flags because they are compiled out entirely.

**Fix:** All runtime developer bypasses removed. Only `HARDWARE_VALIDATION_TEST` remains as a compile-time `#define` explicitly set to `0` in normal builds.

---

## Lesson 8: Gemini STT Consumes Quota on Every Interaction

**What happened:** Using Gemini as the primary STT engine meant every voice query — even failed or garbled ones — consumed Gemini API quota. This triggered rate limits (`429 RESOURCE_EXHAUSTED`) during heavy testing sessions.

**Root cause:** No separation between STT quota and generative quota. Both were drawing from the same Gemini API key.

**What was learned:** STT and generative AI should use separate providers (or at minimum separate keys) so rate limiting in one doesn't block the other.

**Fix:** Groq Whisper as primary STT (separate service, separate rate limits). Gemini STT retained as failover. Gemini API key now used exclusively for generative responses.

---

## Lesson 9: Leaving Cosmic Faces Defined But Unimplemented Is a Crash Risk

**What happened:** Several experimental faces (`COMET_RUSH`, `ORBIT_MODE`, `GALAXY_DRIFT`, `SUPERNOVA`, `BLACK_HOLE`, `SPACE_EXPLORER`, `CHARGING`, `BATTERY_LOW`) were added to the `spark_face_t` enum without corresponding entries in `SPARK_FACES[]`.

**Consequence:** If `Spark_Face_Set()` is called with any of these values, it accesses uninitialized memory in the `SPARK_FACES[]` array — a guaranteed crash or undefined rendering behavior.

**What was learned:** Never add enum values to a data-driven system without simultaneously adding the corresponding data entry. The enum and the data array must always be in sync.

**Current status:** These faces are still unimplemented. Treat them as off-limits until the full cosmic face system (`spark_cosmic.c`) is completed and integrated.
