# 02 — HISTORY

## Project Timeline

### Era 0: Origin
- Project started as a hardware experiment: ESP32-S3 + round display
- Goal was to display animated eyes on a physical desk object
- The round display + circular face concept emerged naturally from the hardware form factor

---

### Era 1: Supabase Shuttle Architecture (Legacy V2)
- **Voice pipeline:** ESP32 → upload WAV to Supabase bucket → server polls bucket → Gemini generates → upload MP3 to bucket → ESP32 polls and downloads
- **Latency:** ~16–20 seconds end to end (4 database operations + 3 HTTP roundtrips)
- **Problems:** High latency made the conversation feel broken. Each exchange felt like sending a letter and waiting for a reply.
- **TTS Voice:** Robotic multilingual neural voice, +40% speed — unnatural

---

### Era 2: Direct HTTP Refactor (Phase 1)
- **Decision:** Cut Supabase entirely from the voice path
- **New pipeline:** ESP32 POSTs WAV directly to `server_daemon.js` → server processes inline → returns MP3 in HTTP response body
- **Latency improvement:** ~16–20s → ~7–8s
- Supabase retained only for user account auth, device registration, and preference sync

### Phase 1.1: Audio Quality Fixes
- Replaced robotic TTS voice with `en-US-AvaNeural` (Microsoft Edge TTS)
- Reduced speaking rate from `+40%` to `+10%` — much more natural
- Increased I2S volume multiplier from `4.0f` to `10.0f` to actually drive the physical speaker

---

### Era 3: Local Intent Engine (Phase 2)
- **Decision:** Gemini was being called even for "hi" and "what time is it"
- **New component:** `intent_matcher.js` — Levenshtein + token-match algorithm
- **Intent database:** `intents.json` — 50 intents, 219 example phrases, 500 responses
- **Threshold:** 0.90 confidence minimum for local match
- **Result:** ~45% of queries handled locally with ~1.1s total latency. Gemini calls dropped by nearly half.

### Phase 2.1: Modular STT (Groq Primary + Gemini Fallback)
- Gemini was also being used for STT at ~900ms per transcription
- Integrated Groq Whisper API: ~150–300ms transcription
- Created abstract `STTProvider` layer so providers are swappable
- Gemini STT retained as failover for rate limit scenarios

---

### Era 4: SparkCore Architecture Refactor (V1 Migration)
- **Problem identified (via ARCHITECTURE_AUDIT.md):** All state, sensors, and rendering were tangled together in `deskimon.c` and `MIC_Speech.c`. Adding more features was becoming impossible.
- **Refactor:** Introduced `SparkCore` — 6 independent manager modules
- **Modules introduced:** `spark_state`, `spark_hardware`, `spark_face`, `spark_animation`, `spark_emotion`, `spark_intent`
- **Key improvements:**
  - Faces moved from giant switch-case to static const structs in Flash
  - Animation callbacks became type-safe (fixed LVGL cast bugs)
  - State machine centralized — no more race conditions
  - OOM crashes eliminated
- **Repository restructured** into `SPARK-V1/` with clean `firmware/` subdirectory

---

### Era 5: Face Dev Mode (Current)
- Added `SPARK_FACE_DEV_MODE` compile flag to `main.c`
- When enabled: boots directly into `Deskimon_FaceDevMode_Start()` — skips network, audio, all managers
- Purpose: test and validate all face expressions on hardware without the full boot sequence
- Current status: `#define SPARK_FACE_DEV_MODE 1` (dev mode is ON in the current build)

---

## Important Decisions Log (Summary)

| Decision | Why |
|----------|-----|
| Cut Supabase from voice path | 16-20s latency was unusable |
| Local intent engine | Gemini calls for simple greetings were wasteful and slow |
| Groq Whisper STT | 900ms → 200ms transcription — 4x speedup |
| SparkCore manager pattern | Untangled spaghetti coupling between UI, hardware, and voice |
| Data-driven faces (structs) | Made adding new faces O(1) instead of modifying giant switch-cases |
| Face dev mode compile flag | Hardware validation without needing full firmware boot |
