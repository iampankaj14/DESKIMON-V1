# 02 — FOLDER MAP

## Root: `/Users/pankaj/Desktop/DESKIMON/`

```
DESKIMON/
├── SPARK-V1/               ← Main firmware project (ESP-IDF)
├── webapp/                 ← Next.js web dashboard
├── supabase/               ← Supabase configuration / migrations
├── assets/                 ← Branding assets, images
├── web_simulator/          ← Web-based face simulator (HTML/JS)
├── venv/                   ← Python venv (tools/scripts)
├── DESKIMON_MASTER_CONTEXT.md  ← Single source of truth for project context
├── branding.json
├── intents_top100.json     ← Expanded intent training data
└── nvs.bin                 ← Pre-built NVS partition image
```

---

## SPARK-V1 Root

```
SPARK-V1/
├── firmware/               ← ESP-IDF project root
├── assets/                 ← Additional firmware assets
├── docs/                   ← Existing documentation
├── scripts/                ← Build/flash helper scripts
├── tools/                  ← Development tools
├── ARCHITECTURE.md         ← Original architecture doc (pre-ANTIGRAVITY)
├── CHANGELOG.md
├── MIGRATION_REPORT.md     ← Previously written migration notes
├── README.md
└── LICENSE
```

---

## `firmware/` — ESP-IDF Project

```
firmware/
├── main/                   ← ALL source code lives here (single component)
├── components/             ← Third-party ESP components (manually added)
├── managed_components/     ← IDF Component Manager deps
├── build/                  ← Build artifacts (gitignored)
├── CMakeLists.txt          ← Top-level CMake (points to main/)
├── partitions.csv          ← Partition table
├── sdkconfig               ← Active Kconfig configuration
├── sdkconfig.defaults      ← Default Kconfig overrides (checked in)
└── dependencies.lock       ← IDF component lock file
```

### `components/` — Third-Party Libraries

```
components/
├── chmorgan__esp-audio-player/   ← MP3 audio playback to I2S
├── chmorgan__esp-libhelix-mp3/   ← Helix MP3 software decoder
├── espressif__esp-dsp/           ← DSP math (FFT, filters)
├── espressif__esp-sr/            ← Speech recognition (AFE, WakeNet, MultiNet)
└── lvgl__lvgl/                   ← LVGL v8 graphics library
```

---

## `main/` — Full Source Map

```
main/
│
├── main.c                  ← app_main() entry point. Two modes: DEV / PROD
├── CMakeLists.txt          ← Registers all source files for compilation
├── Kconfig.projbuild       ← Project-level Kconfig (voice API URL, etc.)
├── idf_component.yml       ← Component manifest
│
├── SparkCore/              ← Clean architecture managers (SPARK abstraction layer)
│   ├── spark_face.h/.c     ← Face configuration database + Spark_Face_Set()
│   ├── spark_animation.h/.c ← LVGL animation primitives (Prop, Fade, AnimateEyeBase)
│   ├── spark_cosmic.h/.c   ← Cosmic face particle/ring/trail animation engine
│   ├── spark_state.h/.c    ← Device state machine (BOOT/IDLE/LISTENING/THINKING/SPEAKING)
│   ├── spark_emotion.h/.c  ← String emotion tag → spark_face_t converter
│   ├── spark_intent.h/.c   ← Intent dispatcher stub (currently minimal)
│   ├── spark_hardware.h/.c ← Hardware capability queries (currently minimal)
│   ├── spark_ui_objects.h  ← Enum of ALL 60+ UI object IDs + Spark_UI_GetObj()
│   └── [leftover files]
│       ├── missing_block.txt        ← Debugging artifact
│       ├── spark_cosmic_all_steps.txt
│       ├── spark_cosmic.c.extracted / .extracted2 / .extracted3
│       ├── spark_cosmic.c.reconstructed / .recovered / .step2230
│       └── transcript_matches.txt
│
├── LVGL_UI/                ← The entire face rendering engine
│   ├── deskimon.c          ← 2443 lines. ALL face objects, logic, event handlers
│   └── deskimon.h          ← Public API: Deskimon_Start, FaceDevMode_Start, SetEyeColor, SetEmotion
│
├── MIC_Driver/             ← Voice input and recording
│   ├── MIC_Speech.c        ← Wake word, VAD, recording, upload dispatch
│   └── MIC_Speech.h        ← Public API + conv_state_t enum
│
├── Cloud/                  ← HTTP + WebSocket cloud connectivity
│   ├── Cloud.c             ← WebSocket Supabase Realtime, diagnostics, audio download task
│   ├── Cloud_Upload.c      ← Cloud_UploadVoiceDirect (primary) + legacy Supabase paths
│   └── Cloud.h             ← Public API
│
├── Wireless/               ← Wi-Fi init + provisioning check
│   ├── Wireless.c
│   └── Wireless.h
│
├── Provisioning/           ← Captive portal + NVS config
│   ├── Provisioning.c      ← HTTP server, NVS read/write, device_config_t
│   ├── Provisioning.h      ← device_config_t struct (device_id, supabase_url, auth_token, eye_color, volume, ...)
│   ├── portal.html         ← Embedded HTML for captive portal web page
│   ├── dns_server.c/.h     ← DNS server for captive portal redirect
│
├── Audio_Driver/           ← PCM5101 I2S DAC
│   ├── PCM5101.c           ← I2S init, Audio_Init, Audio_Play_MP3_Buffer, Volume_adjustment
│   └── PCM5101.h
│
├── LCD_Driver/             ← Display hardware driver
│   └── [SPD2010 display driver files]
│
├── LVGL_Driver/            ← LVGL HAL (flush callback, input driver)
│   └── [LVGL platform integration]
│
├── Touch_Driver/           ← Capacitive touch input driver
│
├── I2C_Driver/             ← I2C bus initialization
│
├── BAT_Driver/             ← Battery voltage ADC monitor
│
├── PWR_Key/                ← Physical power key GPIO handler
│
├── EXIO/                   ← TCA9554 I2C I/O expander driver
│
├── QMI8658/                ← 6-axis IMU driver
│   └── QMI8658.c/.h        — getAccelerometer(), QMI8658_Init(), QMI8658_Loop()
│
├── PCF85063/               ← I2C RTC driver
│   └── PCF85063.c/.h       — PCF85063_Init(), PCF85063_Loop(), time functions
│
├── SD_Card/                ← SD/MMC storage driver
│
└── Assets/                 ← Embedded font/image assets for LVGL
```

---

## Key File Sizes (as indicator of complexity)

| File | Lines / Size | Role |
|---|---|---|
| `LVGL_UI/deskimon.c` | 2,443 lines / 107KB | Everything face-related |
| `SparkCore/spark_cosmic.c` | ~2,500 lines / 88KB | Cosmic animations |
| `Cloud/Cloud.c` | 831 lines / 31KB | WebSocket + cloud |
| `MIC_Driver/MIC_Speech.c` | 785 lines / 31KB | Voice pipeline |
| `Cloud/Cloud_Upload.c` | 540 lines / 19KB | HTTP upload |
| `SparkCore/spark_face.c` | 393 lines / 22KB | Face configs |
| `Wireless/Wireless.c` | 237 lines / 8KB | WiFi + provisioning |
| `SparkCore/spark_state.c` | 116 lines / 4KB | State machine |
| `SparkCore/spark_animation.c` | 114 lines / 4KB | Animation primitives |
| `SparkCore/spark_emotion.c` | 68 lines / 2KB | Emotion → face |
