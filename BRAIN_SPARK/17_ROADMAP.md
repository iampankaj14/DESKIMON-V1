# 17 — ROADMAP

## Current Milestone: Face Dev Mode Hardware Validation

**Status:** Active
**Goal:** Verify all face expressions render correctly on physical hardware with the new SparkCore architecture.
**Compile flag:** `#define SPARK_FACE_DEV_MODE 1` in `main.c`

**Remaining tasks:**
- [ ] Run `Deskimon_FaceDevMode_Start()` on physical hardware
- [ ] Visually inspect each of the 18+ configured faces
- [ ] Confirm animations transition smoothly
- [ ] Confirm tears, mouths, masks all render in correct positions
- [ ] Confirm no OOM or rendering crashes during face cycling

---

## Next Milestone: V1 Production Build

**Goal:** Switch off dev mode and validate the full production pipeline on hardware.

**Tasks:**
1. Set `#define SPARK_FACE_DEV_MODE 0` in `main.c`
2. Recompile and reflash
3. Run full boot sequence checklist (from `MIGRATION_REPORT.md`):
   - [ ] Boot: eye layout correct on power-on
   - [ ] Voice: say "Spark" → listening arc → speech → intent response → correct emotion face
   - [ ] Gestures: Swipe Left/Right (Blush), Up (WTF), Down (Ooh), Double Tap (Laugh), Triple Tap (Angry)
   - [ ] IMU: Tilt forward → Crying, Shake → Angry
   - [ ] Cloud: Change eye color on dashboard → confirm device updates
4. Tag release as `v1.0.0`

---

## V1.1 — Intent Coverage Expansion

**Goal:** Increase local intent match rate from ~45% to ~65%+ by adding more intents and example phrases.

**Tasks:**
- Add 20–30 more intents to `intents.json` (weather questions, focus/study modes, jokes)
- Improve intent coverage for edge-case phrasing
- Run `test_all_intents.js` to validate no regression in existing matches
- Add unit test for wake word stripping edge cases

---

## V1.2 — Emotion Header Integration

**Goal:** Complete the `Intent → Emotion → Face` pipeline end-to-end.

**Current state:** The architecture specifies that `server_daemon.js` should return an `X-Emotion` header with the MP3 response. The ESP32 should read this header and call `Spark_Emotion_Set()` to update the face to match the spoken response.

**Tasks:**
- Add `X-Emotion` header to HTTP responses in `server_daemon.js`
- Read `X-Emotion` header in `Cloud_Upload.c` on the ESP32
- Call `Spark_Emotion_ProcessIntent()` or `Spark_Emotion_Set()` with the received emotion tag
- Test the full loop: speak → AI responds happy → face shows HAPPY

---

## V2.0 — Wake Word Integration

**Goal:** Continuous local wake word detection using ESP-SR on Core 1.

**Current state:** Recording starts only when manually triggered (touch or button). There is no always-on listening.

**Tasks:**
- Integrate `esp-sr` MultiNet wake word engine to run continuously on Core 1
- Configure wake phrase ("Hey Spark" or custom phrase)
- On wake word detected: transition to LISTENING state, trigger recording
- Ensure Core 1 wake word detection doesn't interfere with Core 0 LVGL rendering

---

## V2.1 — Complete Remaining Face Expressions

**Goal:** Implement all currently incomplete faces.

**Tasks:**
- Implement: WINK, SKEPTICAL, DIZZY, LOVE (standard faces)
- Implement: CHARGING, BATTERY_LOW (utility faces)
- Design and implement Cosmic faces (COMET_RUSH, ORBIT_MODE, GALAXY_DRIFT, etc.) via `spark_cosmic.c`
- Integrate `spark_cosmic.c` into the build system

---

## V2.2 — Dynamic Face Themes (OTA)

**Goal:** Allow face theme packs to be loaded from SD card or OTA update without firmware reflash.

**Architecture:** The `SPARK_FACES[]` array could be replaced by a loader that reads face configs from a JSON file on the SD card. New faces = new JSON entries.

**Tasks:**
- Design JSON schema for face configuration
- Implement SD card JSON loader in `spark_face.c`
- Create tooling to generate face config JSON from a design spec
- OTA delivery mechanism for theme pack updates

---

## V3.0 — Desktop Agent Integration

**Goal:** Spark monitors the user's computer and reacts autonomously.

**Architecture:** A small desktop app (Mac/Windows) sends status to the server:
- Active application (coding, browsing, Spotify)
- System CPU/memory usage
- Calendar events
- Build/compile status

Spark reacts based on context:
- BORED face when user is on social media
- INTEREST face when user is reading
- Yawn when CPU pegs at 100% during a build

**Tasks:**
- Design the desktop app (Electron or system tray app)
- Define the event protocol (HTTP or WebSocket to server_daemon)
- Map computer events to Spark emotions
- Handle privacy: user must opt-in, data stays local

---

## V4.0 — Long-Term Vector Memory

**Goal:** Spark remembers everything across months, not just 5-day TTLs.

**Architecture:**
- Store user memories as vector embeddings in Supabase pgvector
- Semantic search: query "what are we working on this week?" retrieves relevant past conversations
- Relationship model deepens — Spark references past goals, celebrates progress over time

**Tasks:**
- Set up Supabase pgvector extension
- Implement embedding generation (Gemini Embeddings API or similar)
- Replace keyword-match in `memory_system.js` with vector similarity search
- Design memory importance scoring (some memories are more significant)

---

## Long-Term Vision Summary

| Milestone | Status |
|-----------|--------|
| V1.0 — Production-ready firmware | 🔄 In Progress |
| V1.1 — Intent coverage expansion | 📋 Planned |
| V1.2 — Emotion header end-to-end | 📋 Planned |
| V2.0 — Wake word integration | 📋 Planned |
| V2.1 — Complete all face expressions | 📋 Planned |
| V2.2 — OTA face theme packs | 📋 Planned |
| V3.0 — Desktop agent integration | 🔮 Future |
| V4.0 — Vector memory | 🔮 Future |
