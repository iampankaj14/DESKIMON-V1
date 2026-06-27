# 04 — FEATURE STATUS

## Legend
- ✅ **Completed** — Fully implemented and tested
- 🔄 **In Progress** — Started but incomplete
- 📋 **Planned** — Designed, not yet built
- 🔮 **Future** — Not yet planned in detail
- ❌ **Removed** — Was built, deliberately removed

---

## Core Firmware Features

| Feature | Status | Notes |
|---------|--------|-------|
| ESP32-S3 boot sequence | ✅ Completed | `Driver_Init()` + `Driver_Loop()` task |
| LCD + LVGL initialization | ✅ Completed | SPD2010 display driver |
| I2C bus setup | ✅ Completed | Shared by IMU, RTC, EXIO |
| Battery monitoring | ✅ Completed | ADC via `BAT_Driver`, `BAT_Get_Volts()` |
| Power key handling | ✅ Completed | `PWR_Key` module |
| RTC (real-time clock) | ✅ Completed | PCF85063 via I2C |
| IMU (accelerometer/gyro) | ✅ Completed | QMI8658 6-axis sensor |
| SD card init | ✅ Completed | SD_MMC (in production path only) |
| Wi-Fi provisioning | ✅ Completed | Captive portal + NVS storage |
| Audio DAC output | ✅ Completed | PCM5101 I2S DAC, 10x volume multiplier |
| Microphone input | ✅ Completed | I2S mic → WAV → upload |
| Face Dev Mode | ✅ Completed | `#define SPARK_FACE_DEV_MODE 1` |

---

## SparkCore Managers

| Manager | Status | Notes |
|---------|--------|-------|
| `spark_state` — State Machine | ✅ Completed | 9-state FSM, callback registration, override allowed |
| `spark_hardware` — Hardware Manager | ✅ Completed | IMU polling task, battery, backlight, callbacks |
| `spark_face` — Face Manager | ✅ Completed | 22 configured faces in static Flash array |
| `spark_animation` — Animation Manager | ✅ Completed | Type-safe LVGL wrappers, 5 procedural animations |
| `spark_emotion` — Emotion Manager | ✅ Completed | 11 emotion tags mapped to faces |
| `spark_intent` — Intent Manager | 🔄 In Progress | Thin wrapper — full wake word AFE not yet integrated |

---

## Face Expressions

| Face | Status | Notes |
|------|--------|-------|
| NORMAL | ✅ Completed | Default resting state |
| BORED | ✅ Completed | Heavy-lidded eyes shifted down |
| HAPPY | ✅ Completed | Moon mask applied (squint) |
| ANGRY | ✅ Completed | Brow-like heavy lids, same as bored |
| SLEEP | ✅ Completed | Very thin eyes |
| BLUSH | ✅ Completed | Happy eyes + arc mouth |
| BORING | ✅ Completed | Yawn mouth accessory |
| CHILL | ✅ Completed | Half-lid eyes + arc mouth |
| CRY | ✅ Completed | Thin eyes + tear accessory |
| CRYING_MOUTH | ✅ Completed | Crying + yawn mouth |
| EYES_CLOSED | ✅ Completed | Base eyes hidden, flat-line eyes shown |
| HAPPY_CRY | ✅ Completed | Thin eyes + tears + triangle mouth |
| IGNORE | ✅ Completed | Base eyes hidden, line + hemi eyes shown |
| INSECURE | ✅ Completed | Alternative eye containers + insecure mouth |
| INTEREST | ✅ Completed | Alternative eyes + interest mouth |
| OOH | ✅ Completed | Wide eyes + expanding circle mouth |
| WTF | ✅ Completed | Flat eyes + expanding triangle mouth |
| LAUGH | ✅ Completed | Eyes shifted up + large capsule mouth |
| WINK | 🔄 In Progress | Defined in enum, no config entry in `SPARK_FACES[]` |
| SKEPTICAL | 🔄 In Progress | Defined in enum, no config entry |
| DIZZY | 🔄 In Progress | Defined in enum, no config entry |
| LOVE | 🔄 In Progress | Defined in enum, no config entry |
| BOOT | ✅ Completed | Used as initial state sentinel (no rendering) |

---

## Cosmic / Experimental Faces

| Face | Status | Notes |
|------|--------|-------|
| COMET_RUSH | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| ORBIT_MODE | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| GALAXY_DRIFT | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| SUPERNOVA | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| BLACK_HOLE | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| SPACE_EXPLORER | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| CHARGING | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |
| BATTERY_LOW | ❌ Incomplete | Enum defined, **no config** — will crash if triggered |

> ⚠️ **WARNING:** Do NOT call `Spark_Face_Set()` with any cosmic/experimental face. The `SPARK_FACES[]` array has no entry for them (they will return a zero-initialized struct or NULL).

---

## Server / Backend Features

| Feature | Status | Notes |
|---------|--------|-------|
| Voice endpoint (`/api/voice`) | ✅ Completed | HTTP POST WAV → returns MP3 |
| Groq Whisper STT | ✅ Completed | Primary transcription, ~200ms |
| Gemini STT fallback | ✅ Completed | Secondary transcription |
| Local intent matching | ✅ Completed | 50 intents, Levenshtein + token score |
| Dynamic placeholder interpolation | ✅ Completed | `{TIME}`, `{DATE}`, `{BATTERY}`, etc. |
| Gemini 2.5 Flash generative fallback | ✅ Completed | Text-to-text AI responses |
| Multi-turn conversation context | ✅ Completed | 10-turn window, 60s TTL |
| Microsoft Edge TTS | ✅ Completed | `en-US-AvaNeural`, `+10%` speed |
| ElevenLabs TTS | ✅ Completed | Configurable alternative |
| Memory system (`memories.json`) | ✅ Completed | User facts, XP, relationship levels |
| Milestone system | ✅ Completed | Detects life/study/project achievements |
| Personality presets | ✅ Completed | 6 modes via Supabase device_preferences |
| Device preset cache | ✅ Completed | 60s TTL, avoids per-request Supabase query |
| Key pool rotation | ✅ Completed | Multiple API keys via `GROQ_KEY_N`, `GEMINI_KEY_N` |
| Wake word detection (ESP-SR) | 📋 Planned | Continuous local wake word on Core 1 |
| X-Emotion response header | 📋 Planned | Server sends emotion tag with MP3 response |

---

## Web App Features

| Feature | Status | Notes |
|---------|--------|-------|
| Device registration | ✅ Completed | Supabase auth + device linking |
| Personality preset selector | ✅ Completed | Dashboard UI |
| Custom personality prompt | ✅ Completed | Free-text input for `custom` preset |
| Real-time device status | 🔮 Future | Show battery, last interaction, emotion |

---

## Removed Features

| Feature | Why Removed |
|---------|-------------|
| Supabase voice shuttle | 16-20s latency — replaced by direct HTTP |
| `FACE_PREVIEW_MODE` flag | Dev-only — removed before V1 release |
| `s_developer_mode` boolean | Bypassed production behavior — removed |
| 5-second touch toggle | Entered dev mode on long press — removed |
| Tap-to-cycle faces | Bypassed emotion system — removed |
| `preview_label` / `dev_mode_label` | On-screen text overlays — removed |
| Hardcoded boot face interception | Locked to face index 0 — removed |
| Gemini-based STT (primary) | Slow (~900ms), now only fallback |
| Multi-core audio/UI shared heap | Fragmentation → OOM crashes — fixed |
