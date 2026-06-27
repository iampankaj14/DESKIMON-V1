# 07 — CALL GRAPH

This document compiles execution paths, calling sequences, and task flow diagrams for the primary runtime operations of the Deskimon system.

---

## 1. System Boot Pipeline

```
app_main()  [main.c]
│
├─ Driver_Init()  [main.c]
│   ├─ PWR_Init()
│   ├─ BAT_Init()
│   ├─ I2C_Init()
│   ├─ EXIO_Init()
│   ├─ Flash_Searching()         ← NVS configuration init
│   ├─ PCF85063_Init()
│   ├─ QMI8658_Init()
│   └─ xTaskCreatePinnedToCore(Driver_Loop, core 0)
│        └─ Wireless_Init()  [Wireless.c]
│             ├─ nvs_flash_init()
│             ├─ esp_netif_init()
│             ├─ Provisioning_Init()
│             │    └─ nvs_open() → loads device preferences
│             ├─ Volume_adjustment()
│             └─ Provisioning_GetState()
│                  ├─ UNPROVISIONED → Provisioning_StartCaptivePortal()
│                  │    ├─ httpd_start()
│                  │    └─ dns_server_start()
│                  └─ PROVISIONED → Provisioning_ConnectWiFi()
│                       └─ if connected:
│                            ├─ Cloud_Start() → WebSocket Link
│                            └─ Cloud_SetVoiceApiUrl()
│
├─ LCD_Init()     [LCD_Driver]
├─ LVGL_Init()    [LVGL_Driver]
│
├─ [SPARK_FACE_DEV_MODE = 1]
│   ├─ Spark_Face_Init()
│   └─ Deskimon_FaceDevMode_Start()
│        ├─ dev_mode_load_face()
│        └─ lv_timer_create(dev_mode_timer_cb)
│
└─ [SPARK_FACE_DEV_MODE = 0] (Production Mode)
    ├─ SD_Init()
    ├─ Audio_Init()             ← I2S Output Configuration
    ├─ MIC_Speech_init()        ← Audio Input Task allocation
    │    ├─ heap_caps_malloc(s_record_buf, SPIRAM)
    │    ├─ xTimerCreate(followup_timer)
    │    ├─ i2s_init(port 1, Mono, 16kHz)
    │    ├─ xTaskCreatePinnedToCore(feed_task, core 1)
    │    └─ xTaskCreatePinnedToCore(detect_task, core 1)
    ├─ Spark_State_Init()
    ├─ Spark_Face_Init()
    └─ Deskimon_Start()
         ├─ Provisioning_GetConfig() → read eye_color
         ├─ [Creates all 60+ static LVGL widgets]
         └─ lv_timer_create(logic_timer_cb, 100ms)
```

---

## 2. Face Creation & Initialization

### Production Mode (Static Allocation)
* Visual widgets are instantiated **once** on device startup. Pointers are preserved in static memory.
```
Deskimon_Start()
│
├─ lv_obj_create(eye_container_l/r)
├─ create_eye_masks(eye_l/r)  → creates mask_top, mask_moon
├─ lv_arc_create(mouth_arc_l/r)
├─ lv_obj_create(mouth_yawn)
├─ lv_obj_create(tear_l/r)
└─ lv_obj_set_style_opa(all_accessories, 0)  ← Initialized to transparent
```

### Dev Mode (Dynamic Allocation / Handoff)
* Elements are destroyed and reallocated dynamically on each face change.
```
dev_mode_load_face(face)
│
├─ destroy_active_face()
│    ├─ lv_obj_del(face_root)       ← Recursive widget tree cleanup
│    └─ s_pointers = NULL           ← Zeroes references to prevent leaks
│
├─ create_face_elements(face)
│    ├─ face_root = lv_obj_create()
│    ├─ create_dev_base_eyes()      ← If eye vectors required
│    ├─ create_dev_mouth_arcs()     ← If smile required
│    └─ create_dev_cosmic_effects() ← If cosmic face active
│
└─ Spark_Face_Set(face)
```

---

## 3. Face Switching (Transitions)

```
Spark_Face_Set(face)  [spark_face.c]
│
├─ if face == current_face: return (no-op)
│
├─ hide_all_masks(300ms)        ← Slides eyelid cuts back to default coordinates
├─ hide_all_accessories(300ms)  ← Fades mouth, tears, closed eyes to OPA=0
│
├─ Fade EYE_CONTAINER_L/R In or Out (depending on visibility configuration)
│
├─ Spark_Anim_AnimateEyeBase(containers)  ← Runs size / translate scaling
│
└─ switch(face)                 ← Applies face-specific overlays
     ├─ BLUSH/CHILL:   Spark_Anim_Fade(mouth_arcs, true)
     ├─ CRY/HAPPY_CRY: Spark_Anim_Fade(tears, true) + Prop height
     ├─ WTF:           Animate wtf_circle collapse + wtf_triangle expansion
     └─ LAUGH:         Spark_Anim_Prop(laugh_mouth height)
```

---

## 4. Animation Engine

```
logic_timer_cb() (Every 100ms)
│
├─ checks flags: s_eye_color_pending, s_eye_state_pending
│
├─ switch(current_state)
│    ├─ EYES_CLOSED:  every 200ms → jitter shake of eye lines
│    ├─ LAUGH:        every 300ms → breath oscillation of capsule mouth height
│    ├─ INSECURE/INT: every 800ms → lateral drifting translations
│    └─ HAPPY_CRY:    every 800ms → expansion/collapse cycles of tears
│
└─ if idle_time >= look_time (Idle Look-Around)
     └─ animate_eye_base(eye_container, random_tx, random_ty, duration)
          └─ anim_prop(SetTxCb / SetTyCb)
```

---

## 5. Voice & Backend Processing

```
[detect_task: wake word matched by MultiNet]
│
├─ MIC_SetConvState(CONV_STATE_LISTENING) → Spark_State_TransitionTo(LISTENING)
├─ start_recording()                      → s_recording_active = true
├─ Cloud_SetListeningState(true)
└─ Spark_Emotion_Set("listening")         → set Face state to INTEREST
   │
[feed_task: VAD detects silence duration > 400ms]
   │
   └─ finish_recording_and_upload()
        ├─ s_recording_active = false
        ├─ MIC_SetConvState(CONV_STATE_PROCESSING) → TransitionTo(THINKING)
        ├─ Spark_Emotion_Set("interest")
        └─ xTaskCreatePinnedToCore(voice_upload_task)
             └─ Cloud_UploadVoiceDirect() [Cloud_Upload.c]
                  │
                  ├─ Packages WAV headers + PCM buffer in SPIRAM
                  ├─ HTTP POST to "/api/voice" (Attaches diagnostic headers)
                  │    │
                  │    ├─ [BACKEND SERVER DAEMON: /api/voice route]
                  │    │    ├─ Invokes Groq Whisper STT (transcribes WAV)
                  │    │    ├─ intent_matcher.js -> checks local database match
                  │    │    ├─ if Match >= 0.90 -> loads template, interpolates metrics
                  │    │    ├─ if Match < 0.90  -> fallback call to Gemini API
                  │    │    ├─ memory_system.js  -> updates conversation context
                  │    │    └─ tts_provider.js   -> requests Microsoft Edge TTS (MP3)
                  │    │
                  │    └─ Receives MP3 buffer stream response
                  │
                  ├─ MIC_SetConvState(CONV_STATE_SPEAKING) → TransitionTo(SPEAKING)
                  ├─ Spark_Emotion_Set("normal") (or matched intent emotion)
                  └─ Audio_Play_MP3_Buffer() [PCM5101.c]
                       ├─ Helix Software MP3 decode
                       └─ I2S DMA output stream to PCM5101 DAC
                            │
                       [Playback completes]
                            │
                            ├─ MIC_SetConvState(CONV_STATE_FOLLOWUP_LISTENING)
                            ├─ start_followup_timer() (15s wake window)
                            └─ Cloud_SetListeningState(false)
```

---

## 6. Intent Resolution Path

```
server_daemon.js: /api/voice
│
├─ intent_matcher.js: matchIntent(normalized_text)
│    ├─ Normalizes contractions (e.g. "don't" -> "do not") and strips punctuation
│    ├─ Computes Levenshtein Distance similarity score
│    ├─ Computes Token Alignment Jaccard score
│    ├─ Adds Boost if substring targets are matched in input text
│    └─ if Score >= 0.90 -> MATCHED
│
├─ if MATCHED:
│    └─ Selects random response from database configs
│    └─ Interpolates Placeholders ({TIME}, {BATTERY}, {WIFI_SSID}, etc.)
│
└─ if MISSED:
     └─ Calls Gemini LLM fallback prompt (using spark_personality.js definitions)
```

---

## 7. Memory Operations

```
MIC_Speech_init()  (Startup)
│
└─ heap_caps_malloc(s_record_buf, SPIRAM, 160KB)  ← Static recording buffer (permanent)
   │
Cloud_UploadVoiceDirect() (On recording end)
   │
   ├─ heap_caps_malloc(wav_buf, SPIRAM, ~320KB)   ← Dynamic upload buffer
   ├─ Assembles PCM to WAV
   ├─ POST upload
   ├─ heap_caps_free(wav_buf)                     ← Instantly freed post-upload
   │
   ├─ heap_caps_malloc(s_mp3_play_buf, SPIRAM)    ← Stores downloaded voice response
   ├─ Audio_Play_MP3_Buffer()                     ← Streams MP3 to I2S
   └─ heap_caps_free(s_mp3_play_buf)              ← Freed post-playback
```
