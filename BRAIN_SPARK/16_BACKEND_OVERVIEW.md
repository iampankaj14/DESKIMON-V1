# 16 — BACKEND OVERVIEW

## System Map

The backend consists of three components:

```
┌─────────────────────────────────────┐
│         server_daemon.js            │
│         (Node.js HTTP Server)       │
│         Port: 3001                  │
│                                     │
│  ┌─────────┐  ┌───────────────────┐ │
│  │ Voice   │  │ ConversationMgr   │ │
│  │ Pipeline│  │ PresetCache       │ │
│  └────┬────┘  └───────────────────┘ │
│       │                             │
│  ┌────▼────────────────────────┐    │
│  │ STT → Intent → Gemini → TTS│    │
│  └────────────────────────────┘    │
└─────────────────────────────────────┘
          │                │
          ▼                ▼
   ┌────────────┐   ┌──────────────┐
   │  Supabase  │   │  External AI  │
   │  (auth +   │   │  APIs        │
   │  prefs)    │   │  Groq/Gemini │
   └────────────┘   │  Edge TTS    │
                    └──────────────┘

┌─────────────────────────────────────┐
│         Next.js Web App             │
│         (User Dashboard)            │
└─────────────────────────────────────┘
```

---

## `server_daemon.js` — The Core Backend

**What it is:** A single-file Node.js HTTP server that handles all device communication.

**How to start:**
```bash
cd webapp
node server_daemon.js
```

**Prerequisites:**
- `session.json` must exist (created by running the webapp and logging in)
- `.env.local` must contain all API keys

**Port:** `3001` (configurable via `VOICE_API_PORT` env var)

---

## API Endpoints

### `POST /api/voice`
The only endpoint the device calls. Handles the complete voice pipeline.

**Request:**
- Body: Raw WAV audio bytes
- Content-Type: `audio/wav`
- Required headers:
  - `X-Device-Id` — Device UUID (required for conversation tracking)
  - `X-Device-Battery` — Battery voltage string
  - `X-Device-Volume` — Volume level (0–100)
  - `X-Device-WiFi-SSID` — Current Wi-Fi network name
  - `X-Device-WiFi-RSSI` — Signal strength in dBm
  - `X-Device-Boot-Count` — Number of device reboots

**Response:**
- Status: `200 OK`
- Content-Type: `audio/mpeg`
- Body: Raw MP3 audio bytes

**Error responses:**
- `400` — Missing or invalid WAV data
- `500` — Internal processing failure

---

## Environment Variables (`.env.local`)

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# STT Provider (groq or gemini)
STT_PROVIDER=groq

# Single API keys (legacy)
NEXT_PUBLIC_GROQ_API_KEY=gsk_xxx
NEXT_PUBLIC_GEMINI_API_KEY=AIza_xxx

# Key pools (optional — enables rotation)
GROQ_KEY_1=gsk_xxx
GROQ_KEY_2=gsk_yyy
GEMINI_KEY_1=AIza_xxx
GEMINI_KEY_2=AIza_yyy

# TTS
TTS_PROVIDER=edge_tts          # or 'elevenlabs'
ELEVENLABS_API_KEY=xxx          # only needed for elevenlabs
ELEVENLABS_VOICE_ID=xxx
ELEVENLABS_KEY_1=xxx            # key pool support
ELEVENLABS_KEY_2=yyy

# Port
VOICE_API_PORT=3001
```

---

## Supabase Tables Used

| Table | Purpose |
|-------|---------|
| `device_preferences` | Stores `personality_preset` and `personality_custom_prompt` per device |
| `devices` | Device registration, links device UUID to user account |
| `auth.users` | Supabase auth — user accounts |

**Not used for audio:** Supabase is NOT in the voice pipeline. Audio never touches Supabase.

---

## External API Dependencies

| Service | Purpose | Provider |
|---------|---------|----------|
| Groq Whisper | Primary STT | `groq.com` |
| Gemini 2.5 Flash | Generative AI + fallback STT | `googleapis.com` |
| Edge TTS | Primary TTS | Microsoft (via `edge-tts` npm package) |
| ElevenLabs | Alternative TTS | `elevenlabs.io` |

---

## Authentication Flow

1. User logs in via the Next.js web dashboard
2. Supabase session is saved to `webapp/session.json`
3. `server_daemon.js` reads `session.json` on startup and calls `supabase.auth.setSession()`
4. All subsequent Supabase queries run as the authenticated user
5. Token refreshes are handled by Supabase SDK and automatically saved back to `session.json`

**Important:** If `session.json` is missing or expired and refresh fails, `server_daemon.js` proceeds with anonymous Supabase access. Device-to-server voice API still works (it doesn't require auth).

---

## Key In-Memory State

`server_daemon.js` maintains the following in-memory objects (lost on server restart):

| Object | Purpose | TTL |
|--------|---------|-----|
| `conversations` Map | Multi-turn conversation context per device | 60s inactivity |
| `presetCache` Map | Personality preset per device | 60s |

---

## Rate Limiting & API Key Rotation

The `discoverKeys()` function in `config/key_discovery.js` discovers multiple API keys by scanning environment variables for `GROQ_KEY_N`, `GEMINI_KEY_N`, `ELEVENLABS_KEY_N` patterns.

**Current state:** Key pool is discovered but active rotation between keys is manual. The first key found is used for each provider's primary client instance. Future work: implement round-robin or failure-based rotation across the pool.

---

## Server Health & Diagnostics

The server logs extensively to stdout:
- `[STT]` — Transcription provider used, time taken, transcript
- `[INTENT MATCH]` / `[INTENT MISS]` — Routing decision
- `[ROUTING TRACE]` — Full routing summary per request
- `[ConvMgr]` — Session creation, expiry, turn count
- `[Preset]` — Device personality fetch/cache
- `[MemorySystem]` — Memory detections, XP gains, level-ups
- `[Voice]` — Request start, turn number, new vs. follow-up

**No health check endpoint** currently exists. Monitor via stdout logging.

---

## Next.js Web App

- **Framework:** Next.js (served via `npm run dev` or `npm start`)
- **Port:** Default Next.js port (3000)
- **Auth:** Supabase email/password
- **Key pages:**
  - Login / Registration
  - Device dashboard (personality preset selector)
  - Custom personality prompt editor

The web app and `server_daemon.js` are in the same `webapp/` directory and share `session.json` and `.env.local`.
