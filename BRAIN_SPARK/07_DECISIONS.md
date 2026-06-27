# 07 — DECISIONS

Every major engineering decision made during SPARK development — what was decided, why, and the outcome.

---

## Decision 1: Cut Supabase from the Voice Path

**Context:** The original pipeline used Supabase storage as a relay. ESP32 uploaded WAV → server polled bucket → processed → uploaded MP3 → ESP32 polled and downloaded MP3.

**Problem:** This required 4 database operations and 3 HTTP roundtrips per voice query, resulting in 16–20 second total latency. The conversation felt broken — like sending a letter and waiting a week for a reply.

**Decision:** Replaced the entire pipeline with a single HTTP POST to `server_daemon.js`. The WAV is POSTed, the MP3 is returned in the HTTP response body. Zero database I/O in the audio path.

**Outcome:** Latency dropped from ~16–20s to ~7–8s immediately. Supabase is retained only for auth, device registration, and preference sync.

---

## Decision 2: Local Intent Engine Before Cloud LLM

**Context:** Every voice query — including simple "hi", "what time is it", "how are you" — was being forwarded to Gemini, consuming quota, adding 4-5 seconds of latency, and costing money.

**Decision:** Built `intent_matcher.js` — a Levenshtein + token Jaccard matching engine — to intercept common queries locally. The threshold for local handling is 0.90 confidence.

**Intent database:** 50 intents, 219 example phrases, 500 pre-written personality responses.

**Outcome:** ~45% of queries are handled locally in ~1.1s total. Gemini calls reduced by nearly half. Personality responses are consistent and hand-crafted.

**Why not use embedding-based semantic matching instead?**
Levenshtein + token matching is deterministic, fast (~5ms), runs in Node.js without a GPU, and doesn't require external API calls. Good enough for desk companion queries.

---

## Decision 3: Groq Whisper as Primary STT

**Context:** Gemini was used as the primary transcription engine at ~900ms per query. This was slow and consumed Gemini quota on every single interaction.

**Decision:** Created an abstract `STTProvider` interface. Plugged in Groq Whisper as the primary (150–300ms, extremely fast, separate rate limits). Gemini STT retained as the automatic failover.

**Outcome:** STT latency dropped from ~900ms to ~200ms. A 4.5x improvement. Gemini quota is now reserved for generative fallback responses only.

**Key files:** `webapp/providers/groq_provider.js`, `webapp/providers/gemini_provider.js`, `webapp/stt_interface.js`

---

## Decision 4: SparkCore Manager Architecture

**Context:** As the firmware grew, `deskimon.c` and `MIC_Speech.c` became deeply tangled. Face state, conversation state, sensor polling, and animation callbacks were all mixed together. A direct call chain meant adding any new feature could break anything else.

**Identified problems (from ARCHITECTURE_AUDIT.md):**
- `deskimon.c` directly called `getAccelerometer()` (graphics code reading I2C bus)
- `MIC_Speech.c` directly called `Deskimon_SetEmotion()` (voice code modifying UI)
- Touch event handler called `MIC_StartRecordingManual()` (circular dependency)
- Faces defined as a giant switch-case — adding new faces was O(n) complexity

**Decision:** Introduced 6 independent managers under `firmware/main/SparkCore/`:
- `spark_state` — centralized FSM
- `spark_hardware` — all sensor abstraction
- `spark_face` — data-driven face configs
- `spark_animation` — reusable LVGL animation wrappers
- `spark_emotion` — intent→emotion translation bridge
- `spark_intent` — voice recording interface

**Outcome:** Clean module boundaries, no circular dependencies, face transitions are O(1), OOM crashes eliminated by storing face configs in Flash (`.rodata`), type-safe animation callbacks eliminated LVGL cast corruption bugs.

---

## Decision 5: Data-Driven Face Definitions (Static Const Structs)

**Context:** Faces were defined as a massive switch-case block with inline LVGL property assignments. Adding a new face required understanding the entire block and adding another case. The face coordinates were compiled into code, not data.

**Decision:** Defined all face configurations as static const structs in `SPARK_FACES[SPARK_FACE_MAX]` stored in Flash (`.rodata`). Each entry is a `spark_face_config_t` with eye layout, mouth layout, mask positions, and transition time.

**Outcome:** Adding a new face requires adding one struct entry. ~2KB of SRAM saved (moved to Flash). `Spark_Face_Set()` is a single clean function that reads the struct and applies all properties uniformly.

**Future:** This array could be loaded from an SD card JSON file, enabling zero-firmware-change face theme packs.

---

## Decision 6: Dev Mode as Compile-Time Flag

**Context:** Hardware validation of all face expressions required booting without network, audio, or the full manager pipeline. Running the full stack on hardware made face debugging slow and unreliable.

**Decision:** Added `#define SPARK_FACE_DEV_MODE 1` at the top of `main.c`. When enabled, `app_main()` boots only LCD + LVGL + Face + Animation, then calls `Deskimon_FaceDevMode_Start()`. Full production path is in the `#else` branch.

**Why compile-time and not runtime?**
Runtime flags require extra RAM and logic to manage. A compile-time define has zero overhead in production builds. The linker removes the dev path entirely when `SPARK_FACE_DEV_MODE 0`.

**Current state:** `SPARK_FACE_DEV_MODE 1` is active. Must be set to `0` before production flashing.

---

## Decision 7: TTS Voice Selection (AvaNeural)

**Context:** The original TTS voice was a robotic multilingual neural voice at `+40%` speed. It sounded rushed and mechanical — the opposite of Spark's chill personality.

**Decision:** Switched to `en-US-AvaNeural` (Microsoft Edge TTS) at `+10%` speed. Also raised the I2S DAC volume multiplier from `4.0f` to `10.0f` in `PCM5101.c` to properly drive the physical speaker.

**Outcome:** Voice sounds natural, clear, and matches the cosmic-chill personality. Volume is audible in normal desk environments.

---

## Decision 8: Multi-Turn Conversation Context

**Context:** Each voice query was treated as an independent interaction. Spark had no memory of what was said 30 seconds ago in the same conversation.

**Decision:** Added `ConversationManager` to `server_daemon.js`. Maintains a rolling 10-turn (5-exchange) window per device ID, with a 60-second inactivity TTL. Prior turns are injected into Gemini's `contents` array.

**Outcome:** Spark can reference what was said earlier in the same conversation. Sessions expire cleanly to prevent stale context.

---

## Decision 9: Device Preset Caching

**Context:** The personality preset (playful, sarcastic, etc.) was being fetched from Supabase on every single voice request, adding unnecessary latency and database load.

**Decision:** Added an in-memory `presetCache` Map in `server_daemon.js` with a 60-second TTL. Supabase is only queried when the cache is stale.

**Outcome:** Eliminated one Supabase round-trip per request. Dashboard changes take effect within 60 seconds of update.

---

## Decision 10: Remove All Developer Bypasses Before V1

**Context:** During development, several convenience shortcuts were added: 5-second press to enter dev mode, tap-to-cycle through all faces, on-screen label overlays showing face names and indices.

**Decision:** All of these were fully removed from `deskimon.c` before the V1 release. The only retained bypass is `HARDWARE_VALIDATION_TEST` as a compile-time define at `0`.

**Why:** Consumer devices must not contain debugging pathways. A user accidentally triggering dev mode via a long press would destroy the experience.
