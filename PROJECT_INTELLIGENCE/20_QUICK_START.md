# 20 — QUICK START

Welcome to **Deskimon**! This document is designed to help a new developer or AI assistant understand the project and begin modifying code within 15 minutes.

---

## 1. What is Deskimon?
Deskimon is an interactive, AI-powered desktop companion built on the **ESP32-S3** microcontroller. It features:
* A round touch display showing animated eye and mouth widgets (**LVGL v8**).
* An I2S microphone to record user queries.
* An I2S DAC speaker to play audio responses.
* A Next.js backend server daemon that processes voice files, matches local intents, queries generative LLMs, and returns synthesized TTS voice response streams.

---

## 2. Voice Pipeline in 30 Seconds

```
 [ESP32 MEMS Mic] ──► Records 16kHz audio into SPIRAM
        │
        ▼
 [Cloud_Upload.c] ──► Packs WAV → HTTP POST to "/api/voice" on Server Daemon
        │
        ▼
 [server_daemon.js] ──► Transcribes WAV via Groq Whisper STT
        │
        ▼
 [intent_matcher.js] ──► Fuzzy checks text against 50 local intents (intents.json)
        │                 │
        │                 ├─► Match (>= 90%) ──► Fills local response template
        │                 └─► Miss  (< 90%)  ──► Sends transcript query to Gemini API
        ▼
 [tts_provider.js] ──► Synthesizes response text to MP3 via Microsoft Edge TTS
        │
        ▼
 [Audio Playback] ──► Down-streams MP3 in HTTP body → Helix decodes → PCM5101 DAC
```

---

## 3. Codebase Cheat Sheet

### Key Firmware Files (`SPARK-V1/firmware/main/`)
* **[`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c)**: Coordinates startup and holds development mode switches.
* **[`LVGL_UI/deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c)**: The main UI file. Allocates eye/mouth widgets, handles swipes, and manages update timers.
* **[`SparkCore/spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c)**: The face geometry database. Adjust eye sizes, eyelids, and transitions here.
* **[`MIC_Driver/MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c)**: Audio input and wake word processing loop.
* **[`Cloud/Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c)**: Assembles WAV data and manages HTTP voice uploads.
* **[`Audio_Driver/PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c)**: Helix MP3 software decoder and I2S DAC driver.

### Key Backend Files (`webapp/`)
* **[`server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js)**: Runs the local API voice route listener on port `3001`.
* **[`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js)**: Runs fuzzy similarity calculations on transcribed text.
* **[`intents.json`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intents.json)**: The database of 50 local intents and response templates.
* **[`spark_personality.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/spark_personality.js)**: Prompt context template that defines the AI's personality.

---

## 4. How to Build & Flash (Command Reference)

Before running commands, activate the ESP-IDF toolchain paths in your terminal:
```bash
. ~/esp/esp-idf/export.sh
```

Navigate to `SPARK-V1/firmware` and run:
```bash
# 1. Build the firmware
idf.py build

# 2. Flash to the device (replaces cu.usbserial-* with active port)
idf.py -p /dev/cu.usbserial-* flash

# 3. Fast Flash (flashes ONLY the app code partition, bypassing drivers)
idf.py -p /dev/cu.usbserial-* app-flash

# 4. Open the serial output logs
idf.py -p /dev/cu.usbserial-* monitor
# (To close monitor, press Ctrl + ])
```

---

## 5. Active Development Modes

To switch modes, modify these `#define` flags at the top of [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c):

```c
#define SPARK_FACE_DEV_MODE 1          // 1 = Dev Mode (Preview), 0 = Production Mode
#define SPARK_DEVELOPER_PREVIEW_MODE 0 // 1 = Overlay NEXT buttons on production screen
```

* **Dev Mode (`1`)**: Boots directly to a face preview cycle that auto-advances faces every 4 seconds. Disables Wi-Fi and audio for fast iteration.
* **Production Mode (`0`)**: Connects to the internet and runs the real-time voice pipeline.

---

## 6. Engineering Safety Guidelines

| File | Safe to Edit? | Guidelines |
| :--- | :---: | :--- |
| **`intents.json`** | 🟢 **Yes** | Safe to add new intents or edit response variations. |
| **`spark_personality.js`** | 🟢 **Yes** | Safe to modify the system prompt to alter the companion's personality. |
| **`spark_face.c`** | 🟡 **High Risk** | Safe to tweak eye geometries in `SPARK_FACES[]`. Ensure config indices align with the enums in `spark_face.h`. |
| **`deskimon.c`** | 🔴 **Critical** | Large file with high state coupling. Avoid large modifications. Beware of **H2 Animation conflicts** and **H1 Stale Pointers** in dev mode. |
| **`MIC_Speech.c`** | 🔴 **Critical** | Timing-sensitive audio capture threads. Do not alter task priorities or polling intervals. |
