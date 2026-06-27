# 01 — PROJECT INDEX

This index lists every important source file in the **Deskimon** workspace (both ESP-IDF firmware and web backend), detailing its purpose and related modules.

---

## Firmware Source Files (`SPARK-V1/firmware/main/`)

### Core Entry & Orchestration
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c) | System entry point (`app_main`). Directs initialization of hardware drivers, configures production or developer modes, and hosts the core FreeRTOS driver loop. | `Driver_Init`, `LVGL_UI`, `Wireless`, `SparkCore` |

### SparkCore Abstraction Layer
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`SparkCore/spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.h) | Configures static parameters for the first 19 face layouts (sizes, offsets, masks) and contains the `Spark_Face_Set()` transition state machine. | `LVGL_UI`, `spark_animation.h` |
| [`SparkCore/spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.h) | Thin abstraction wrapping LVGL `lv_anim_t` routines. Defines procedural primitives such as `Spark_Anim_Prop`, `Spark_Anim_Fade`, and `Spark_Anim_Play`. | `spark_face.c`, `LVGL_UI` |
| [`SparkCore/spark_cosmic.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.h) | Cosmic animation subsystem. Manages rendering updates for particle streams, trails, reticles, and rings across multi-phase states. | `LVGL_UI`, `spark_ui_objects.h` |
| [`SparkCore/spark_state.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_state.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_state.h) | High-level device state machine controller (`spark_state_t`), managing notifications for transitions (e.g., IDLE, LISTENING, THINKING, SPEAKING). | `MIC_Driver`, `Cloud`, `LVGL_UI` |
| [`SparkCore/spark_emotion.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_emotion.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_emotion.h) | Translates high-level emotion tags (strings) into specific face configurations (e.g., "normal" -> `SPARK_FACE_NORMAL`). | `spark_face.c`, `Cloud` |
| [`SparkCore/spark_intent.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_intent.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_intent.h) | Dispatcher shell for local device command intent handling (stub). | `SparkCore` |
| [`SparkCore/spark_hardware.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_hardware.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_hardware.h) | Abstract layer for querying hardware statuses (stub). | `main.c` |
| [`SparkCore/spark_ui_objects.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_ui_objects.h) | Contains the enumeration list for all 60+ static and dynamic UI widget references compiled into the face rendering engine. | `LVGL_UI`, `spark_cosmic.c` |

### UI Rendering
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`LVGL_UI/deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.h) | Core UI file. Allocates and constructs all LVGL screen objects (eyes, mouths, tears, borders), manages the 100ms logic timer, and handles screen gesture touch events. | `SparkCore`, `QMI8658`, `Touch_Driver` |

### Inputs, Storage, & Provisioning
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`MIC_Driver/MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.h) | Handles I2S audio microphone input feeds, voice activity detection (VAD), WakeNet/MultiNet wake-word matching, and schedules audio upload tasks. | `Cloud`, `Audio_Driver`, `spark_state.h` |
| [`Provisioning/Provisioning.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/Provisioning.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/Provisioning.h) | Parses and stores NVS configuration settings, spins up the SoftAP HTTP Captive Portal for credentials config, and manages Wi-Fi credentials store. | `Wireless`, `dns_server.c`, `portal.html` |
| [`Provisioning/dns_server.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/dns_server.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/dns_server.h) | DNS resolver redirect for Captive Portal setups. | `Provisioning.c` |
| [`Provisioning/portal.html`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/portal.html) | Embedded HTML markup served by the provisioning web server. | `Provisioning.c` |
| [`SD_Card/SD_MMC.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SD_Card/SD_MMC.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SD_Card/SD_MMC.h) | MicroSD card hardware bus initializer. | `main.c` |

### Cloud & Network Connectivity
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`Cloud/Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.h) | Instantiates the Supabase Realtime WebSocket client and parses preference changes (e.g., eye color updates, volume settings) via cJSON. | `Provisioning`, `LVGL_UI`, `Audio_Driver` |
| [`Cloud/Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c) | Assembles raw PCM frames into a WAV container and makes direct HTTP POST requests to the AI voice backend, receiving down-streamed MP3 buffers. | `MIC_Driver`, `Audio_Driver` |
| [`Wireless/Wireless.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Wireless/Wireless.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Wireless/Wireless.h) | Wraps WiFi initialization, credentials check, and connection callbacks. | `Provisioning`, `Cloud` |

### Hardware Drivers
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`Audio_Driver/PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.h) | Runs software decoding of MP3 streams using Helix and drives I2S DMA audio output to the PCM5101 DAC. | `Cloud_Upload`, `main.c` |
| [`LCD_Driver/Display_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LCD_Driver/Display_SPD2010.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LCD_Driver/Display_SPD2010.h) | Sets up display hardware, panel handles, and handles display backlight parameters. | `main.c`, `LVGL_Driver` |
| [`LVGL_Driver/LVGL_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_Driver/LVGL_Driver.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_Driver/LVGL_Driver.h) | Integrates the LVGL engine frame buffer layout and registers rendering flush routines. | `LCD_Driver`, `main.c` |
| [`Touch_Driver/Touch_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Touch_Driver/Touch_SPD2010.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Touch_Driver/Touch_SPD2010.h) | Standard driver for capacitive screen interactions. Registers touch points to LVGL. | `main.c`, `LVGL_Driver` |
| [`I2C_Driver/I2C_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/I2C_Driver/I2C_Driver.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/I2C_Driver/I2C_Driver.h) | Configures and runs ESP32 I2C bus ports 0 and 1. | `main.c`, `QMI8658`, `PCF85063`, `EXIO` |
| [`BAT_Driver/BAT_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/BAT_Driver/BAT_Driver.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/BAT_Driver/BAT_Driver.h) | Performs ADC measurements of battery voltage levels. | `main.c`, `Cloud_Upload` |
| [`PWR_Key/PWR_Key.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PWR_Key/PWR_Key.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PWR_Key/PWR_Key.h) | Manages hardware GPIO power button wake interrupts. | `main.c` |
| [`EXIO/TCA9554PWR.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/EXIO/TCA9554PWR.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/EXIO/TCA9554PWR.h) | Controls the TCA9554 I2C I/O expander for ancillary GPIO lines. | `main.c` |
| [`QMI8658/QMI8658.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/QMI8658/QMI8658.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/QMI8658/QMI8658.h) | Initializes and reads the 6-axis IMU (accelerometer + gyroscope) for physical device tilts and shake movements. | `main.c`, `LVGL_UI` |
| [`PCF85063/PCF85063.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PCF85063/PCF85063.c) / [`.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PCF85063/PCF85063.h) | Initializes and queries the external I2C PCF85063 Real-Time Clock. | `main.c` |

---

## Backend & WebApp Source Files (`webapp/`)

### Core Daemon & Logic
| File Path | Purpose | Related Modules |
| :--- | :--- | :--- |
| [`server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js) | Central server logic listening on port `3001`. Intercepts voice POST requests, calls the STT API, invokes the intent matcher, queries Gemini on fallback, requests TTS audio, and writes back diagnostic telemetry. | `intent_matcher.js`, `tts_provider.js`, `memory_system.js` |
| [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js) | Processes text transcripts through normalization, fuzzy Levenshtein calculations, token alignment, and boosted substring checks to return local templates. | `server_daemon.js`, `intents.json` |
| [`spark_personality.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/spark_personality.js) | Contains the base system prompts defining the witty, slightly sarcastic tone of Deskimon when querying fallback LLMs. | `server_daemon.js` |
| [`tts_provider.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/tts_provider.js) | Interfaces with Microsoft Edge TTS to stream voice speech generation. | `server_daemon.js` |
| [`memory_system.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/memory_system.js) | Handles the local device-linked session database of memories (`memories.json`) to persist context across continuous conversation steps. | `server_daemon.js` |
| [`intents.json`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intents.json) | Local database of 50 intent configurations, training phrases, and dynamic placeholder templates. | `intent_matcher.js` |
