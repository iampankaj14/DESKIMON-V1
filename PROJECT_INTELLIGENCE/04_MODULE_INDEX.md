# 04 — MODULE INDEX

This document provides a comprehensive single-page overview of every software and hardware module inside the Deskimon project.

---

## 1. Firmware Entry & Core Orchestration
* **Module Name**: System Entry (`main`)
* **Files**: [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c)
* **Role**: The main bootstrap module. It configures the compile-time execution flags (`SPARK_FACE_DEV_MODE`, `SPARK_DEVELOPER_PREVIEW_MODE`), initializes the primary hardware drivers, and schedules the background driver polling task (`Driver_Loop`) on Core 0.

---

## 2. SparkCore Abstraction Layer
* **Module Name**: SparkCore Architecture
* **Files**: [`SparkCore/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/)
* **Role**: Serves as the system interface layer, decoupling the low-level graphics engine from high-level device logic. It maintains configuration registers, states, and mappings:
  * **`spark_face`**: The database of geometric dimensions, eyelids, and accessories for 19 faces.
  * **`spark_animation`**: Standard wrapper over LVGL's property transitions and procedural effects.
  * **`spark_state`**: The master device state tracking engine (BOOT, IDLE, LISTENING, etc.).
  * **`spark_emotion`**: Parses incoming voice metadata strings to match appropriate face enums.
  * **`spark_ui_objects`**: Central ID lookup table mapping static UI widgets to memory pointers.

---

## 3. Cosmic Animation Subsystem
* **Module Name**: Cosmic Engine
* **Files**: [`SparkCore/spark_cosmic.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.h)
* **Role**: A complex procedural rendering component. It calculates orbit positions, scaling rates, speed lines, and alpha fades to animate space-themed particle displays (Comet Rush, Orbit Mode, Supernova, etc.) across 4 sequential phase transitions.

---

## 4. Face UI Engine
* **Module Name**: UI Controller (`LVGL_UI`)
* **Files**: [`LVGL_UI/deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.h)
* **Role**: Creates all visual LVGL widgets on startup. Owns the 100ms `logic_timer_cb` that checks state changes, updates eye color filters, runs per-state animations, and handles touch gestures (swipes, taps). It also implements the separate Dev Mode loading routine.

---

## 5. Voice Input Pipeline
* **Module Name**: Speech Capture (`MIC_Driver`)
* **Files**: [`MIC_Driver/MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.h)
* **Role**: Manages the I2S microphone interface, feeds audio streams to the AFE (Audio Front End) to execute noise cancellation and Voice Activity Detection (VAD), runs WakeNet wake-word recognition, and buffers voice queries into SPIRAM.

---

## 6. Cloud & Networking Integration
* **Module Name**: Cloud Sync (`Cloud`)
* **Files**: [`Cloud/Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c), [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c), [`Wireless/Wireless.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Wireless/Wireless.c)
* **Role**: Manages network configurations, scans for local routers, connects to Supabase via a Realtime WebSocket, parses database preferences (updates colors, volumes, and custom APIs), compiles WAV format voice envelopes, and streams AI response buffers.

---

## 7. Provisioning & Storage
* **Module Name**: Device Setup (`Provisioning`)
* **Files**: [`Provisioning/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/), [`SD_Card/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SD_Card/)
* **Role**: Manages long-term device personalization records stored in NVS. If unprovisioned, it hosts a captive Wi-Fi portal serving a setup interface (`portal.html`) to capture and save local network credentials and Supabase credentials.

---

## 8. Physical Drivers (Peripherals)
* **Module Name**: Hardware Drivers
* **Files**: [`LCD_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LCD_Driver/), [`LVGL_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_Driver/), [`Touch_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Touch_Driver/), [`Audio_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/), [`I2C_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/I2C_Driver/), [`BAT_Driver/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/BAT_Driver/), [`PWR_Key/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PWR_Key/), [`EXIO/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/EXIO/), [`QMI8658/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/QMI8658/), [`PCF85063/`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PCF85063/)
* **Role**: Operates lower-level chip hardware interfaces:
  * **`Display`**: Custom controller interface initialization for the SPD2010 screen.
  * **`Touch`**: Capacitive touch panel driver converting coordinates for screen gestures.
  * **`Audio`**: I2S output DAC controller. Software decodes incoming MP3 buffers using the Helix library.
  * **`IMU`**: Gathers 6-axis spatial coordinate readings to drive tilt and shake behaviors.
  * **`RTC`**: Local hardware clock keeping time across offline periods.
  * **`Battery`**: Measures voltage to generate telemetry estimates of device battery charge.

---

## 9. Backend Voice Service (Server Daemon)
* **Module Name**: Backend Core (`webapp`)
* **Files**: [`webapp/server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js), [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js), [`tts_provider.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/tts_provider.js), [`memory_system.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/memory_system.js)
* **Role**: Operates the external AI voice processing pipeline. It intercepts binary WAV data sent by the device, calls Groq Whisper to transcribe speech, calculates matches against 50 local intents, accesses fallback generative LLMs (Gemini), synthesizes Edge TTS speech streams, and manages persistent conversational memory.
