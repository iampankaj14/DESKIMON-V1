# 09 — ARCHITECTURE SUMMARY

## System Overview

SPARK (Deskimon) is split into two distinct systems that communicate over HTTP:

```
┌─────────────────────────────────┐         ┌──────────────────────────────────┐
│       ESP32-S3 (Firmware)       │  HTTP   │    Server (Node.js Daemon)       │
│                                 │ ──────▶ │                                  │
│  SparkCore Managers             │  WAV    │  STT → Intent Match → Gemini     │
│  ├── State Machine              │         │  → TTS → MP3                     │
│  ├── Hardware Manager           │ ◀────── │                                  │
│  ├── Face Manager               │  MP3    │  Supabase (auth + preferences)   │
│  ├── Animation Manager          │         └──────────────────────────────────┘
│  ├── Emotion Manager            │
│  └── Intent Manager             │
│                                 │
│  Drivers                        │
│  ├── LCD + LVGL (display)       │
│  ├── PCM5101 (audio out)        │
│  ├── MIC (audio in)             │
│  ├── QMI8658 (IMU)              │
│  ├── PCF85063 (RTC)             │
│  ├── BAT (battery)              │
│  ├── Touch panel                │
│  └── TCA9554 (I/O expander)     │
└─────────────────────────────────┘
```

---

## Firmware Architecture

### Boot Sequence
1. `Driver_Init()` — PWR, BAT, I2C, EXIO, Flash, PCF85063, QMI8658
2. `Driver_Loop` task spawned on Core 0 — polls QMI8658, RTC, battery, power key every 100ms
3. LCD + LVGL initialized
4. SparkCore managers initialized (face, animation, emotion, intent, hardware, state)
5. `Deskimon_Start()` called — enters the face/animation main loop

> **Currently:** `SPARK_FACE_DEV_MODE 1` is set, so step 4 is partial and step 5 calls `Deskimon_FaceDevMode_Start()` instead.

### The SparkCore Layer
Six managers, each with a clean public API:

| Manager | File | Responsibility |
|---------|------|----------------|
| `spark_state` | `spark_state.c/h` | 9-state FSM, transition validation, callbacks |
| `spark_hardware` | `spark_hardware.c/h` | IMU events, battery reads, backlight control |
| `spark_face` | `spark_face.c/h` | Face configs, face transitions, LVGL dispatch |
| `spark_animation` | `spark_animation.c/h` | LVGL animation wrappers, procedural animations |
| `spark_emotion` | `spark_emotion.c/h` | Emotion string → face ID translation |
| `spark_intent` | `spark_intent.c/h` | Microphone recording interface |

### UI Object Registry
All LVGL objects are registered in `spark_ui_objects.h` as `spark_ui_obj_id_t` enum values. Access is through `Spark_UI_GetObj(id)`. No module holds direct LVGL object pointers — all UI access goes through this registry.

---

## Server Architecture (`server_daemon.js`)

The server is a single Node.js HTTP server listening on port `3001`.

### Request flow for a voice query:
```
ESP32 POST /api/voice (WAV body + telemetry headers)
  │
  ├── transcribeAudio()         ← Groq Whisper (or Gemini fallback)
  ├── checkAndCleanWakeWord()   ← Strip "Hey Spark" / "Hey Deskimon"
  ├── milestoneSystem.detect()  ← Check for life event celebration
  ├── matchIntent()             ← Local Levenshtein + token match
  │     ├── MATCH (≥0.90)  → use local response template
  │     └── MISS (<0.90)   → Gemini 2.5 Flash generative response
  ├── TTSProvider.synthesize()  ← Edge TTS or ElevenLabs
  └── HTTP response (MP3 binary)
```

### Key server modules:
- `intent_matcher.js` — matching algorithm
- `intents.json` — 50 intents × 500 responses
- `spark_personality.js` — Gemini system prompt builder
- `memory_system.js` — per-device facts, XP, relationship levels
- `milestone_system.js` — life event detection + celebration
- `tts_provider.js` — TTS abstraction (Edge TTS or ElevenLabs)
- `providers/groq_provider.js` — Groq Whisper STT
- `providers/gemini_provider.js` — Gemini STT fallback

---

## Web App Architecture

Next.js dashboard served alongside `server_daemon.js`.

- Auth: Supabase email/password, session stored in `session.json`
- Device registration: Device UUID linked to Supabase user account
- Preferences: `device_preferences` table stores personality preset + custom prompt
- Device communicates with server daemon using its UUID as `X-Device-Id` header

---

## Data Flow Summary

```
[User speaks]
     ↓
[ESP32 records WAV to PSRAM]
     ↓
[HTTP POST to server_daemon:3001/api/voice]
  Headers: X-Device-Id, X-Device-Battery, X-Device-Volume, X-Device-WiFi, X-Device-Boot-Count
     ↓
[Groq Whisper → plain text transcript]
     ↓
[Wake word stripped]
     ↓
[Memory/Milestone check]
     ↓
[Intent matcher: score ≥ 0.90 → local response]
[Intent matcher: score < 0.90 → Gemini generative]
     ↓
[Edge TTS → MP3 buffer]
     ↓
[HTTP response: MP3 binary]
     ↓
[ESP32 plays MP3 from PSRAM buffer via PCM5101 DAC → speaker]
```
