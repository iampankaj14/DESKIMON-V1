# 11 — CODE MAP

This document provides a high-level code map of the entire Deskimon project directory structure, pointing out where key features live.

---

## 1. Project Directory Structure

```
DESKIMON/                             ← Workspace Root
├── SPARK-V1/                         ← Firmware Project Root
│   ├── assets/                       ← Raw vector graphics and fonts
│   ├── docs/                         ← Firmware design audits and reviews
│   ├── scripts/                      ← Python/Shell flash and build helpers
│   └── firmware/                     ← ESP-IDF build directory
│       ├── partitions.csv            ← Partition offset layout map
│       ├── sdkconfig.defaults        ← Compile overrides (committed configs)
│       └── main/                     ← Core source files
│           ├── main.c                ← Entry points and hardware config flags
│           ├── SparkCore/            ← Abstraction layer managers
│           │   ├── spark_face.c      ← Face configurations and set transitions
│           │   ├── spark_animation.c ← LVGL animation wrappers
│           │   ├── spark_cosmic.c    ← Space particle tick systems
│           │   ├── spark_state.c     ← Device state machine (BOOT, IDLE, etc.)
│           │   ├── spark_emotion.c   ← Emotion string lookup tables
│           │   └── spark_ui_objects.h← Object ID enum table
│           ├── LVGL_UI/              ← Graphics layer
│           │   └── deskimon.c        ← Eye/mouth widget maps, event handlers
│           ├── MIC_Driver/           ← Audio Input Capture
│           │   └── MIC_Speech.c      ← Real-time I2S mic feeds, wake detection
│           ├── Cloud/                ← Networks & Connectivity
│           │   ├── Cloud.c           ← Supabase WebSocket real-time sync
│           │   └── Cloud_Upload.c    ← Voice WAV generation and HTTP POST upload
│           ├── Provisioning/         ← First-time setup
│           │   ├── Provisioning.c    ← SoftAP HTTP captive setup portal
│           │   └── portal.html       ← HTML setup configuration sheet
│           └── [Hardware Drivers]/   ← Low-level peripheral files
│               ├── Audio_Driver/     ← I2S audio PCM5101 DAC + Helix decoders
│               ├── LCD_Driver/       ← Display panel initializers (SPD2010)
│               ├── Touch_Driver/     ← Capacitive screen interfaces
│               ├── I2C_Driver/       ← Bus controllers (0 and 1)
│               ├── BAT_Driver/       ← Analog-digital battery voltage checks
│               ├── PWR_Key/          ← Power key GPIO interrupt lines
│               ├── QMI8658/          ← IMU accelerometer sensor loops
│               └── PCF85063/         ← Real-time clock timekeepers
│
├── webapp/                           ← Next.js Server & User Dashboard Root
│   ├── server_daemon.js              ← Port 3001 HTTP API voice daemon handler
│   ├── intent_matcher.js             ← Fuzzy matching & Levenshtein equations
│   ├── tts_provider.js               ← Microsoft Edge Speech Synthesis interface
│   ├── memory_system.js              ← Conversational context file logger
│   ├── intents.json                  ← Database of 50 local intents & answers
│   └── src/app/                      ← Dashboard UI panels
│
├── supabase/                         ← Database Migration Root
│   └── migrations/                   ← Schemas (devices, preferences)
│
├── web_simulator/                    ← Standalone web-based testing console
│   ├── index.html                    ← Simulator page
│   └── script.js                     ← Web animation testing engine
│
└── DESKIMON_MASTER_CONTEXT.md        ← Master architecture context sheet
```

---

## 2. Component Handoff Maps

### Where to go to modify features:

| Feature Task | Target Folder | Key Files to Open |
| :--- | :--- | :--- |
| **Tweak Eyelid/Pupil Geometries** | `SPARK-V1/firmware/main/SparkCore/` | [`spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c) |
| **Add New Eye/Mouth Widgets** | `SPARK-V1/firmware/main/LVGL_UI/` | [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) |
| **Fine-tune Wake Word / VAD** | `SPARK-V1/firmware/main/MIC_Driver/` | [`MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) |
| **Adjust Audio Playback/DMA** | `SPARK-V1/firmware/main/Audio_Driver/` | [`PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c) |
| **Update Local Voice Responses** | `webapp/` | [`intents.json`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intents.json) |
| **Tune Intent Match Parameters** | `webapp/` | [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js) |
| **Modify Fallback Prompt Tone** | `webapp/` | [`spark_personality.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/spark_personality.js) |
| **Alter Captive Portal Screen** | `SPARK-V1/firmware/main/Provisioning/` | [`portal.html`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/portal.html) |
