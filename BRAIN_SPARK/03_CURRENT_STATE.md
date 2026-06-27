# 03 — CURRENT STATE

## What Currently Works

### Firmware (ESP32-S3)
- ✅ Boot sequence: drivers init → LCD → LVGL → SparkCore managers → main loop
- ✅ Face system: 22 active face configs loaded from Flash, transitions via LVGL animations
- ✅ Animation system: type-safe LVGL wrappers for all property animations
- ✅ Hardware manager: IMU polling detects shake and tilt events
- ✅ State machine: FSM with 9 states (BOOT → IDLE → LISTENING → THINKING → SPEAKING → SLEEPING → CHARGING → UPDATING → ERROR)
- ✅ Touch gestures: Swipe Left/Right (Blush), Up (WTF), Down (Ooh), Double Tap (Laugh), Triple Tap (Angry)
- ✅ IMU reactions: Tilt Up → Crying, Shake → Angry
- ✅ Face Dev Mode: `SPARK_FACE_DEV_MODE 1` — cycles all faces for hardware testing

### Server Daemon (`server_daemon.js`)
- ✅ Voice endpoint: `POST /api/voice` receives WAV, returns MP3
- ✅ STT: Groq Whisper (primary) + Gemini STT (fallback)
- ✅ Intent matching: local engine handles ~45% of queries at ~1.1s total
- ✅ Generative fallback: Gemini 2.5 Flash text-to-text
- ✅ TTS: Microsoft Edge TTS `en-US-AvaNeural` or ElevenLabs
- ✅ Multi-turn conversation: 10-turn (5-exchange) context window per device, 60s TTL
- ✅ Memory system: Stores user facts in `memories.json`, XP + relationship levels 1–5
- ✅ Milestone system: Detects and celebrates life/study/project achievements
- ✅ Personality presets: 6 modes (playful, sarcastic, helpful, calm, energetic, custom)
- ✅ Device preset cache: 60s TTL caching of Supabase personality settings

### Web App
- ✅ Next.js dashboard for device registration and account linking
- ✅ Supabase auth + device preferences
- ✅ Personality preset selection per device

---

## What Is Incomplete

- ⚠️ **Intent manager firmware (`spark_intent.c`):** Currently a thin wrapper around `MIC_StartRecordingManual()`. The full wake word + AFE pipeline integration is minimal/stubbed.
- ⚠️ **Emotion manager coverage:** Only maps ~11 emotion tags. Many intents in the 50-intent database don't have explicit emotion mappings (default to "normal").
- ⚠️ **Cosmic faces:** `SPARK_FACE_COMET_RUSH`, `ORBIT_MODE`, `GALAXY_DRIFT`, `SUPERNOVA`, `BLACK_HOLE`, `SPACE_EXPLORER`, `CHARGING`, `BATTERY_LOW` are defined in the enum but have **no config entries in `SPARK_FACES[]`** — they will crash if triggered.
- ⚠️ **X-Emotion header:** The architecture plan specifies that `server_daemon.js` should send `X-Emotion` in the HTTP response for the ESP32 to trigger face changes. This is not yet implemented end-to-end.

---

## What Is Disabled

- 🔴 **Face Dev Mode is currently ACTIVE** — `#define SPARK_FACE_DEV_MODE 1` in `main.c`. This skips the full boot sequence (no network, no audio, no intent processing).
- 🔴 **Full production boot** (`Deskimon_Start()`) is behind the `#else` branch in `main.c`.
- 🔴 **Hardware validation test** (`HARDWARE_VALIDATION_TEST`) is compiled out at `0` — solid color screen test for factory QA only.
- 🔴 **Developer bypass modes** (5-second press, tap-to-cycle faces) were removed during the V1 cleanup.
- 🔴 **Supabase voice shuttle** (the legacy path) is fully removed from the audio pipeline.

---

## Current Milestone

> **Milestone: Face Dev Mode hardware validation**
>
> The firmware is currently compiled in Face Dev Mode to test and verify all face expressions render correctly on the physical hardware before switching back to full production mode.
>
> **Next step:** After hardware validation, set `SPARK_FACE_DEV_MODE 0` and test the full production pipeline end-to-end.

---

## Current Performance Metrics

| Metric | Value |
|--------|-------|
| STT (Groq Whisper) | 150–300ms |
| Intent match (local) | ~5–10ms |
| Gemini fallback | ~450–600ms |
| Edge TTS generation | ~700–800ms |
| **Total (local match)** | **~1.1–1.5s** |
| **Total (Gemini fallback)** | **~1.6–2.0s** |
