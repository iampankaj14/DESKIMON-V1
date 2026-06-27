# 01 — ARCHITECTURE

## Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          SERVER SIDE                            │
│  server_daemon.js :3001                                         │
│  ┌───────────┐   ┌───────────────┐   ┌──────────────────────┐  │
│  │ Groq STT  │   │intent_matcher │   │   Edge TTS (MSFT)    │  │
│  │ (Whisper) │   │  .js (local)  │   │   AvaNeural @+10%    │  │
│  └───────────┘   └───────────────┘   └──────────────────────┘  │
│         ↑               ↓                      ↓                │
│   WAV POST       Intent matched?         MP3 response           │
│                 Yes→template / No→Gemini                        │
│  ┌────────────────────────────────────┐                         │
│  │  Supabase (PostgreSQL)             │  ← WebSocket Realtime   │
│  │  Tables: devices, device_prefs     │                         │
│  └────────────────────────────────────┘                         │
└─────────────────────────────────────────────────────────────────┘
                      HTTP / WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                         ESP32-S3 DEVICE                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  app_main()  [main.c]                                    │   │
│  │  │                                                       │   │
│  │  ├─ Driver_Init()  (PWR, BAT, I2C, EXIO, Flash, RTC, IMU)│  │
│  │  ├─ LCD_Init() + LVGL_Init()                             │   │
│  │  ├─ [DEV MODE] Spark_Face_Init, Anim_Init, FaceDevMode   │   │
│  │  │  OR                                                   │   │
│  │  ├─ [PROD MODE] SD + Audio + MIC + SparkCore + Deskimon  │   │
│  │  └─ lv_timer_handler() main loop (10ms tick)             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  SparkCore Managers:                                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │spark_    │ │spark_    │ │spark_    │ │ spark_emotion.c  │   │
│  │state.c   │ │face.c    │ │anim.c    │ │ spark_intent.c   │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│                                                                 │
│  UI Engine:                                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ deskimon.c  (LVGL_UI)  — 2443 lines                       │ │
│  │  - All LVGL widget creation                               │ │
│  │  - logic_timer_cb (100ms) — state + animation + color     │ │
│  │  - screen_event_cb — touch + gesture events               │ │
│  │  - Deskimon_Start() — normal mode entry                   │ │
│  │  - Deskimon_FaceDevMode_Start() — dev mode entry          │ │
│  │  - Spark_UI_GetObj() — global object registry             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Voice Pipeline:                                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ MIC_Speech.c                                              │ │
│  │  feed_handler → I2S read → AFE → Wake word / VAD          │ │
│  │  detect_handler → MultiNet wake word detection            │ │
│  │  → record to SPIRAM buffer (16kHz, 5s max)                │ │
│  │  → finish_recording_and_upload → voice_upload_task        │ │
│  │  → Cloud_UploadVoiceDirect (HTTP POST WAV)                │ │
│  │  → Receive MP3 → PCM5101 playback                         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  Cloud Sync:                                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Cloud.c                                                   │ │
│  │  Cloud_Start() → WebSocket to Supabase Realtime           │ │
│  │  Subscribes: device_preferences UPDATE events             │ │
│  │  → parse_supabase_realtime_msg → Deskimon_SetEyeColor()   │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Relationships

```
main.c
  ├── Driver_Init()
  │     ├── PWR_Key.h
  │     ├── BAT_Driver.h
  │     ├── I2C_Driver.h
  │     ├── TCA9554PWR.h  (EXIO)
  │     ├── PCF85063.h    (RTC)
  │     └── QMI8658.h     (IMU)
  │
  ├── LCD_Init()          → Display_SPD2010.h
  ├── LVGL_Init()         → LVGL_Driver/
  │
  ├── [PROD] Audio_Init() → PCM5101.h
  ├── [PROD] MIC_Speech_init()
  │     └── MIC_Speech.c
  │           ├── Cloud.h / Cloud_Upload.c
  │           ├── spark_emotion.h
  │           ├── spark_state.h
  │           └── PCM5101.h
  │
  ├── Spark_State_Init()  → spark_state.c  (no deps)
  ├── Spark_Hardware_Init() → spark_hardware.c
  ├── Spark_Face_Init()   → spark_face.c
  │     ├── spark_animation.h
  │     └── spark_ui_objects.h
  ├── Spark_Anim_Init()   → spark_animation.c (no deps)
  ├── Spark_Emotion_Init() → spark_emotion.c
  │     └── spark_face.h
  ├── Spark_Intent_Init() → spark_intent.c (stub)
  │
  └── Deskimon_Start() / Deskimon_FaceDevMode_Start()
        → deskimon.c (LVGL_UI)
              ├── spark_face.h
              ├── spark_animation.h
              ├── spark_ui_objects.h
              ├── spark_cosmic.h
              │     └── spark_cosmic.c (huge animation engine)
              ├── MIC_Speech.h
              └── QMI8658.h

Wireless.c (launched from Driver_Loop FreeRTOS task):
  ├── Provisioning.c  (captive portal, NVS config)
  ├── Cloud.c
  └── Cloud_SetVoiceApiUrl()

Cloud.c:
  ├── Cloud_Upload.c (Cloud_UploadVoiceDirect)
  ├── MIC_Speech.h (MIC_SetConvState, s_record_buf)
  ├── spark_face.h
  ├── spark_emotion.h
  └── Provisioning.h

Cloud_Upload.c:
  ├── Provisioning.h
  ├── spark_emotion.h
  ├── BAT_Driver.h
  └── PCM5101.h
```

---

## Data Flow

### Voice Pipeline Data Flow

```
I2S Hardware (microphone)
  │  32-bit samples at 16kHz
  ↓
feed_handler() [MIC_Speech.c]
  │  Converts i2s_buff (int32) → feed_buf (int16) via >> 14
  │  Feeds → AFE (Audio Front End) for noise suppression/echo cancel
  │  During FOLLOWUP_LISTENING: VAD energy detection
  │  During s_recording_active: PCM buffered to s_record_buf (SPIRAM)
  │  On silence detected: → finish_recording_and_upload()
  ↓
detect_handler() [MIC_Speech.c]
  │  MultiNet processes AFE output
  │  On wake word → start_recording()
  ↓
voice_upload_task() [MIC_Speech.c]
  │  Calls Cloud_UploadVoiceDirect(s_record_buf, num_samples)
  ↓
Cloud_UploadVoiceDirect() [Cloud_Upload.c]
  │  Builds WAV header + PCM in SPIRAM
  │  HTTP POST /api/voice (custom headers: battery, SSID, RSSI, boot count)
  │  Receives MP3 stream in response body → SPIRAM buffer
  ↓
Audio_Play_MP3_Buffer() [PCM5101.c]
  │  Helix MP3 decode → I2S DMA → PCM5101 DAC → Speaker
  ↓
Playback complete
  │  MIC_SetConvState(CONV_STATE_FOLLOWUP_LISTENING)
  │  start_followup_timer() (15s window)
  │  Spark_Emotion_Set("normal")
```

### Eye Color Update Flow (Supabase Realtime)

```
User edits eye_color in webapp
  ↓
Supabase UPDATE event on device_preferences table
  ↓
WebSocket message → websocket_event_handler() [Cloud.c]
  ↓
parse_supabase_realtime_msg() → extracts eye_color hex
  ↓
Deskimon_SetEyeColor(hex) [deskimon.c]
  → sets s_eye_color_hex + s_eye_color_pending = true
  ↓
logic_timer_cb() (next 100ms tick)
  → applies color to all LVGL eye objects (eye_l, eye_r, aura, borders, mouths, tears...)
```

---

## Boot Flow

```
app_main() [main.c]
  │
  ├─ Driver_Init()
  │    ├─ PWR_Init()            — power key GPIO
  │    ├─ BAT_Init()            — battery ADC
  │    ├─ I2C_Init()            — I2C bus 0 and 1
  │    ├─ EXIO_Init()           — TCA9554 I/O expander
  │    ├─ Flash_Searching()     — NVS namespace init
  │    ├─ PCF85063_Init()       — RTC init
  │    ├─ QMI8658_Init()        — IMU init
  │    └─ xTaskCreatePinnedToCore(Driver_Loop, core 0, prio 3)
  │         └── vTaskDelay(5000ms) → Wireless_Init()
  │              ├─ nvs_flash_init()
  │              ├─ esp_netif_init()
  │              ├─ Provisioning_Init()  → reads NVS config
  │              ├─ if UNPROVISIONED → Provisioning_StartCaptivePortal()
  │              └─ if PROVISIONED   → Provisioning_ConnectWiFi()
  │                   └─ if connected + fully provisioned:
  │                        ├─ Cloud_Start()         → WebSocket sync
  │                        └─ Cloud_SetVoiceApiUrl() → from Kconfig
  │
  ├─ LCD_Init()                 — display hardware init
  ├─ LVGL_Init()                — LVGL library init + display driver
  │
  ├─ [FACE_DEV_MODE=1]
  │    ├─ Spark_Face_Init()     — sets s_current_face = SPARK_FACE_BOOT
  │    ├─ Spark_Anim_Init()     — logs "Animation Registry initialized"
  │    └─ Deskimon_FaceDevMode_Start()
  │         ├─ Creates screen, labels, NEXT button
  │         ├─ dev_mode_load_face(SPARK_FACE_NORMAL) — first face
  │         └─ lv_timer_create(dev_mode_timer_cb, 100ms)
  │
  └─ [FACE_DEV_MODE=0]
       ├─ SD_Init()
       ├─ Audio_Init()           — PCM5101 I2S DAC
       ├─ MIC_Speech_init()     — AFE + MultiNet init, I2S RX
       │    ├─ i2s_init()
       │    ├─ Creates s_record_buf (SPIRAM, 5s @ 16kHz)
       │    ├─ Creates s_followup_timer (FreeRTOS timer)
       │    ├─ xTaskCreatePinnedToCore(feed_task, core 1)
       │    └─ xTaskCreatePinnedToCore(detect_task, core 1)
       ├─ Spark_State_Init()
       ├─ Spark_Hardware_Init()
       ├─ Spark_Face_Init()
       ├─ Spark_Anim_Init()
       ├─ Spark_Emotion_Init()
       ├─ Spark_Intent_Init()
       └─ Deskimon_Start()
            ├─ Reads eye_color from Provisioning_GetConfig()
            ├─ Creates all LVGL objects (eyes, masks, mouths, tears, cosmic)
            ├─ lv_obj_add_event_cb(scr, screen_event_cb)
            └─ lv_timer_create(logic_timer_cb, 100ms)

main loop:
  while(1) { vTaskDelay(10ms); lv_timer_handler(); }
```

---

## Event Flow

### Touch Events (screen_event_cb)
```
LV_EVENT_GESTURE
  └─ LV_DIR_LEFT / RIGHT → EYE_STATE_BLUSH
  └─ LV_DIR_TOP          → EYE_STATE_WTF
  └─ LV_DIR_BOTTOM       → EYE_STATE_OOH

LV_EVENT_PRESSED (tap counting, 600ms window)
  └─ tap_count >= 3  → EYE_STATE_ANGRY
  └─ tap_count == 2  → LAUGH / HAPPY_CRY / INTEREST (context-dependent)
  └─ tap_count == 1  → HAPPY / CHILL / LAUGH / WTF (context-dependent)

LV_EVENT_LONG_PRESSED
  └─ MIC_StartRecordingManual()  → manual recording trigger
```

### IMU Events (logic_timer_cb → getAccelerometer())
```
tilted_up (Accel.y > 0.6)
  └─ shaking   → EYE_STATE_CRYING_MOUTH
  └─ not shake → EYE_STATE_CRY

shaking + not tilted + shaking_x → EYE_STATE_IGNORE
shaking + not tilted + not x     → EYE_STATE_ANGRY
```

### Idle Timeout Events (logic_timer_cb)
```
EYE_STATE_NORMAL + idle_time > 7000ms   → EYE_STATE_BORING
EYE_STATE_BORING + state_time > 4500ms  → EYE_STATE_BORED
EYE_STATE_BORED  + idle_time > 15000ms  → EYE_STATE_SLEEP
EYE_STATE_SLEEP  + state_time > 10000ms → EYE_STATE_EYES_CLOSED
```

### Voice Events (MIC_Speech.c conv_state_t)
```
CONV_STATE_IDLE
  └─ Wake word detected → CONV_STATE_LISTENING → start_recording()

CONV_STATE_LISTENING
  └─ Silence detected (0.4s) → CONV_STATE_PROCESSING
     └─ voice_upload_task → Cloud_UploadVoiceDirect()
        └─ response received → CONV_STATE_SPEAKING → PCM5101 playback
           └─ playback done → CONV_STATE_FOLLOWUP_LISTENING
              └─ speech onset → CONV_STATE_LISTENING again
              └─ 15s timeout → CONV_STATE_IDLE
```
