# 00 — PROJECT OVERVIEW

## What is SPARK / Deskimon?

**Deskimon** is an AI-powered interactive desktop companion built on the **ESP32-S3** microcontroller. It sits on a desk, listens to natural voice commands, responds audibly via TTS, and expresses personality through animated robotic eyes on a round touch display.

The firmware is called **SPARK-V1** — it is the embedded system that runs entirely on the device.

**Core identity:**
- Physical desk toy with a round face LCD
- Local + cloud-hybrid AI voice assistant
- Emotive animated face with 26+ expressions
- Responds to voice, touch, gestures, and physical motion (IMU)

---

## Current Project Goal

The immediate goal is a **production-stable SPARK-V1 firmware** with:
1. All 26 face animations working and validated (currently in `SPARK_FACE_DEV_MODE`)
2. Stable voice pipeline: wake-word → record → HTTP POST WAV → receive MP3 → playback
3. Touch + IMU gesture reactions
4. Provisioning via captive portal
5. Live eye color updates from Supabase `device_preferences`
6. Foundation ready for future emotion responses from AI backend

---

## Tech Stack

### Firmware (On-Device)
| Layer | Technology |
|---|---|
| MCU | ESP32-S3, Xtensa dual-core LX7 @ 240MHz |
| RTOS | FreeRTOS (via ESP-IDF v5.3.2) |
| Graphics | LVGL v8 |
| Display Driver | SPD2010 (custom `Display_SPD2010.h`) |
| Audio Output | PCM5101 I2S DAC |
| Audio Input | I2S microphone → ESP-SR (AFE + MultiNet) |
| Speech Recognition | Espressif ESP-SR: Wake word (MultiNet) + VAD |
| MP3 Decode | `chmorgan/esp-libhelix-mp3` |
| Audio Player | `chmorgan/esp-audio-player` |
| Wi-Fi | ESP-IDF Wi-Fi stack |
| HTTP Client | `esp_http_client` |
| WebSocket | `esp_websocket_client` |
| JSON | cJSON |
| NVS Storage | ESP-IDF NVS (key-value flash) |
| IMU | QMI8658 6-axis (I2C) |
| RTC | PCF85063 (I2C) |
| I/O Expander | TCA9554PWR (I2C → EXIO) |
| Battery Monitor | ADC (`BAT_Driver`) |
| SD Card | SDMMC |

### Backend (Server-Side)
| Layer | Technology |
|---|---|
| Server Daemon | Node.js (`server_daemon.js`) on local machine / cloud VM |
| Voice API | HTTP POST `/api/voice` on port `3001` |
| Speech-to-Text | Groq Whisper API (primary), Gemini STT (fallback) |
| Intent Matching | Custom JS `intent_matcher.js` (Levenshtein + Jaccard) |
| AI Fallback | Gemini `gemini-2.5-flash` (text-to-text) |
| Text-to-Speech | Microsoft Edge TTS `AvaNeural` @ +10% speed |
| Database | Supabase (PostgreSQL) |
| Real-time Sync | Supabase Realtime WebSocket |
| Web Dashboard | Next.js webapp |

---

## Hardware

| Component | Part | Bus |
|---|---|---|
| MCU | ESP32-S3 (8MB PSRAM, 16MB Flash) | — |
| Display | Round LCD (SPD2010 controller) | QSPI/SPI |
| Audio DAC | PCM5101 | I2S |
| Speaker | Passive speaker | Analog via DAC |
| Microphone | I2S MEMS mic | I2S |
| IMU | QMI8658 6-axis accel/gyro | I2C |
| RTC | PCF85063 | I2C |
| Touch | Capacitive touchscreen | I2C |
| I/O Expander | TCA9554PWR | I2C |
| Battery Monitor | ADC pin | ADC |
| Storage | SD/MMC slot | SDMMC |

**Key constraints:**
- 8MB PSRAM (SPIRAM) — used extensively for audio buffers, cJSON, WebSocket buffers
- 16MB Flash — stores firmware + `srmodels.bin` (wake word + command models ~2.4MB)
- No GPU — all graphics are LVGL software-rendered on CPU

---

## Firmware Overview

The firmware is organized as a **single ESP-IDF component** (`main/`) containing:

1. **Drivers** — Hardware abstraction for LCD, Audio, I2C, Battery, Power Key, QMI8658, PCF85063, SD Card, Touch
2. **LVGL_UI** — `deskimon.c`: The entire face rendering engine (2443 lines), LVGL widget creation, face state machine, touch/gesture handlers
3. **SparkCore** — Clean architecture layer:
   - `spark_face.c` — Face configuration database + face switching logic
   - `spark_animation.c` — Reusable LVGL animation primitives
   - `spark_cosmic.c` — Cosmic face system (particle, ring, trail effects)
   - `spark_state.c` — Centralized device state machine (BOOT → IDLE → LISTENING → THINKING → SPEAKING)
   - `spark_emotion.c` — Intent-to-face emotion mapping
   - `spark_intent.c` — Placeholder intent dispatcher
   - `spark_ui_objects.h` — Enum + getter for all 60+ LVGL UI objects
4. **MIC_Driver** — `MIC_Speech.c`: Wake word detection, VAD recording, follow-up conversation, upload dispatch
5. **Cloud** — `Cloud.c` (WebSocket + Supabase sync), `Cloud_Upload.c` (direct HTTP voice upload)
6. **Wireless** — WiFi + BLE init, provisioning flow
7. **Provisioning** — Captive portal, NVS config storage
8. **main.c** — Entry point: `app_main()`, LVGL timer loop, two compile-time modes

**Two compile modes (controlled by `#define SPARK_FACE_DEV_MODE` in `main.c`):**

```
SPARK_FACE_DEV_MODE = 1  →  Face testing mode (current active mode)
                             Only: LCD + LVGL + Face + Anim + FaceDevMode_Start()
                             No: WiFi, Audio, MIC, Cloud, Emotion, Intent

SPARK_FACE_DEV_MODE = 0  →  Full production mode
                             All subsystems initialized including voice pipeline
```

---

## Performance Metrics (Production Mode)

| Metric | Value |
|---|---|
| Wake-to-STT (Groq Whisper) | 150–300 ms |
| Intent Match (local) | ~5–10 ms |
| AI Fallback (Gemini text→text) | ~450–600 ms |
| TTS Generation (Edge TTS) | ~700–800 ms |
| **Total (matched intent)** | **~1.1–1.5 seconds** |
| **Total (AI fallback)** | **~1.6–2.0 seconds** |
| Binary size | 1,361,776 bytes (57% of 3MB partition used) |
| srmodels.bin | 2,468,364 bytes |
