# 03 — SEARCH INDEX

Use this search index to quickly identify which files and functions to open when working on a particular subsystem or feature.

---

## Keyword-to-File Search Matrix

### 1. Boot
* **Focus**: Device power-on sequence, initialization tasks, boot configurations.
* **Files to Open**:
  * [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c) — See `app_main()` (line 53) and `Driver_Init()` (line 35).
  * [`Wireless.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Wireless/Wireless.c) — See `Wireless_Init()` (line 13) for Wi-Fi start.
* **Functions to Open**:
  * `app_main()`
  * `Driver_Init()`
  * `Driver_Loop()`
  * `Wireless_Init()`

### 2. Face
* **Focus**: Adding faces, updating eye geometry, modifying accessory overlays.
* **Files to Open**:
  * [`spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c) — See static configuration table `SPARK_FACES[]` (line 13).
  * [`spark_face.h`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.h) — See `spark_face_t` enum.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See `Deskimon_Start()` (line 789) and `set_eyes_state()` (line 330).
* **Functions to Open**:
  * `Spark_Face_Set()`
  * `set_eyes_state()`
  * `dev_mode_load_face()`

### 3. Blink & Wink
* **Focus**: Blinking animations and Wink behaviors.
* **Files to Open**:
  * [`spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c) — See case `SPARK_ANIM_BLINK` in `Spark_Anim_Play()` (line 64).
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See the blink triggers in `logic_timer_cb()`.
* **Functions to Open**:
  * `Spark_Anim_Play()`
  * `logic_timer_cb()`

### 4. Animation
* **Focus**: LVGL animation parameters, custom easing, and translation loops.
* **Files to Open**:
  * [`spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c) — Abstraction layer functions.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See duplicate animation wrappers `anim_prop()` and `animate_eye_base()`.
* **Functions to Open**:
  * `Spark_Anim_Prop()`
  * `Spark_Anim_Fade()`
  * `Spark_Anim_AnimateEyeBase()`
  * `anim_prop()` (Private duplicate in `deskimon.c`)

### 5. Emotion
* **Focus**: Translating backend sentiment / mood tags to specific hardware face shapes.
* **Files to Open**:
  * [`spark_emotion.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_emotion.c) — Maps strings to enum configurations.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See mapping duplicate `Deskimon_SetEmotion()`.
* **Functions to Open**:
  * `Spark_Emotion_Set()`
  * `Deskimon_SetEmotion()`
  * `Spark_Emotion_ProcessIntent()`

### 6. Voice & STT
* **Focus**: Audio recording, I2S microphone interface, VAD triggers, wake-words, and network streaming.
* **Files to Open**:
  * [`MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) — Handles recording buffers and AFE interfaces.
  * [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c) — Voice WAV packaging and HTTP POST transmission.
* **Functions to Open**:
  * `feed_handler()`
  * `detect_handler()`
  * `finish_recording_and_upload()`
  * `Cloud_UploadVoiceDirect()`

### 7. Battery
* **Focus**: Battery ADC sampling, telemetry reporting, and low battery triggers.
* **Files to Open**:
  * [`BAT_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/BAT_Driver/BAT_Driver.c) — ADC reading.
  * [`Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c) — See diagnostic telemetry reports in `Cloud_ReportDiagnostics()`.
* **Functions to Open**:
  * `BAT_Get_Volts()`
  * `Cloud_ReportDiagnostics()`

### 8. WiFi & Provisioning
* **Focus**: SoftAP captive portals, NVS storage keys, and network connection parameters.
* **Files to Open**:
  * [`Provisioning.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/Provisioning.c) — Portal HTTP requests and NVS access.
  * [`Wireless.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Wireless/Wireless.c) — Wi-Fi credentials connection loops.
* **Functions to Open**:
  * `Provisioning_Init()`
  * `Provisioning_StartCaptivePortal()`
  * `Provisioning_ConnectWiFi()`
  * `Wireless_Init()`

### 9. Display & Touch
* **Focus**: SPD2010 panel drivers, touch coordinate callbacks, and backlight.
* **Files to Open**:
  * [`Display_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LCD_Driver/Display_SPD2010.c) — Panel initializer.
  * [`Touch_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Touch_Driver/Touch_SPD2010.c) — Touch handler coordinates.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See `screen_event_cb()` (line 708) for gesture handlers.
* **Functions to Open**:
  * `LCD_Init()`
  * `screen_event_cb()`

### 10. LVGL
* **Focus**: Canvas setups, custom draw masks, object registry, and timer ticks.
* **Files to Open**:
  * [`LVGL_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_Driver/LVGL_Driver.c) — HAL layers.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — LVGL widgets initialization and draw mask callbacks.
* **Functions to Open**:
  * `LVGL_Init()`
  * `Deskimon_Start()`
  * `Spark_UI_GetObj()`
  * `eye_mask_event_cb()`

### 11. Intent Engine
* **Focus**: Local command classification, Token matching, and response formatting.
* **Files to Open**:
  * [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js) — Fuzzy distance and token similarity algorithms.
  * [`intents.json`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intents.json) — Database of 50 local intents.
* **Functions to Open**:
  * `matchIntent()`
  * `calculateSimilarity()`

### 12. Memory
* **Focus**: SRAM/SPIRAM allocation strategies, task stack sizing, and memory leaks.
* **Files to Open**:
  * [`partitions.csv`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/partitions.csv) — Partition tables.
  * [`MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) — Check SPIRAM allocation of s_record_buf.
  * [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c) — Check transient WAV/MP3 SPIRAM buffer lifecycles.
* **Functions to Open**:
  * `MIC_Speech_init()`
  * `Cloud_UploadVoiceDirect()`

### 13. API & Backend
* **Focus**: Server daemon routes, fallback AI completions, TTS streaming, and Supabase integration.
* **Files to Open**:
  * [`server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js) — Port 3001 routing.
  * [`tts_provider.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/tts_provider.js) — Edge TTS streams.
  * [`Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c) — WebSocket listener for UPDATE signals.
* **Functions to Open**:
  * `/api/voice` POST handler
  * `parse_supabase_realtime_msg()`
  * `websocket_event_handler()`
