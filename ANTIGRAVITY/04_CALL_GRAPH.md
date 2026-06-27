# 04 — CALL GRAPH

## Boot Sequence Call Graph

```
app_main()  [main.c:53]
│
├─ Driver_Init()  [main.c:35]
│   ├─ PWR_Init()
│   ├─ BAT_Init()
│   ├─ I2C_Init()
│   ├─ EXIO_Init()
│   ├─ Flash_Searching()         ← NVS init
│   ├─ PCF85063_Init()
│   ├─ QMI8658_Init()
│   └─ xTaskCreatePinnedToCore(Driver_Loop, core 0, prio 3)
│        └─ vTaskDelay(5000ms)
│           Wireless_Init()  [Wireless.c:13]
│             ├─ nvs_flash_init()
│             ├─ esp_netif_init()
│             ├─ esp_event_loop_create_default()
│             ├─ esp_netif_create_default_wifi_sta()
│             ├─ esp_netif_create_default_wifi_ap()
│             ├─ esp_wifi_init()
│             ├─ Provisioning_Init()
│             │    └─ nvs_open() → reads device_id, ssid, password,
│             │       supabase_url, auth_token, eye_color, volume, voice_api_url
│             ├─ Volume_adjustment(config->volume)
│             ├─ Provisioning_GetState()
│             │    ├─ UNPROVISIONED → Provisioning_StartCaptivePortal()
│             │    │    ├─ esp_wifi_set_mode(AP)
│             │    │    ├─ httpd_start()  (serves portal.html)
│             │    │    └─ dns_server_start()
│             │    └─ PROVISIONED → Provisioning_ConnectWiFi()
│             │         ├─ esp_wifi_set_config(STA, ssid+pass)
│             │         ├─ esp_wifi_connect()
│             │         └─ if FULLY_PROVISIONED:
│             │              ├─ Cloud_Start()
│             │              │    ├─ cJSON_InitHooks (SPIRAM)
│             │              │    ├─ Build WSS URI from supabase_url
│             │              │    ├─ esp_websocket_client_init()
│             │              │    ├─ esp_websocket_register_events()
│             │              │    ├─ esp_websocket_client_start()
│             │              │    └─ xTaskCreateStaticPinnedToCore(cloud_sync_task, core 1, prio 3)
│             │              └─ Cloud_SetVoiceApiUrl(CONFIG_DESKIMON_VOICE_API_URL)
│
├─ LCD_Init()     [LCD_Driver/]
├─ LVGL_Init()    [LVGL_Driver/]
│
├─ [SPARK_FACE_DEV_MODE = 1] ──────────────────────────────────────
│   ├─ Spark_Face_Init()
│   │    └─ s_current_face = SPARK_FACE_BOOT
│   ├─ Spark_Anim_Init()    (logs only)
│   └─ Deskimon_FaceDevMode_Start()
│        ├─ lv_scr_act()
│        ├─ lv_label_create(scr)  ← face name label
│        ├─ lv_label_create(scr)  ← face num label
│        ├─ lv_btn_create(scr)    ← NEXT button
│        ├─ dev_mode_load_face(DEV_MODE_FACES[0])
│        │    ├─ destroy_active_face()  (no-op on first call)
│        │    ├─ create_face_elements(SPARK_FACE_NORMAL)
│        │    │    ├─ face_root = lv_obj_create(lv_scr_act())
│        │    │    ├─ create_dev_base_eyes()
│        │    │    └─ [mouth/tear/cosmic as needed]
│        │    ├─ lv_label_set_text(dev_label_name, "NORMAL")
│        │    ├─ Spark_Face_Init()   ← resets face manager
│        │    └─ Spark_Face_Set(SPARK_FACE_NORMAL)
│        │         ├─ hide_all_masks(300)
│        │         ├─ hide_all_accessories(300)
│        │         └─ Spark_Anim_AnimateEyeBase(containers, ...)
│        └─ lv_timer_create(dev_mode_timer_cb, 100ms)
│
└─ [SPARK_FACE_DEV_MODE = 0] ──────────────────────────────────────
    ├─ SD_Init()
    ├─ Audio_Init()             ← PCM5101 I2S DAC
    ├─ MIC_Speech_init()
    │    ├─ heap_caps_malloc(s_record_buf, SPIRAM, 5s*16kHz)
    │    ├─ xTimerCreate(followup_timer, 15000ms)
    │    ├─ i2s_init(port 1, 16kHz, mono, 32-bit)
    │    ├─ esp_afe_sr_iface_t init (AFE data)
    │    ├─ xTaskCreatePinnedToCore(feed_task, core 1, prio 5)
    │    └─ xTaskCreatePinnedToCore(detect_task, core 1, prio 5)
    ├─ Spark_State_Init()
    ├─ Spark_Hardware_Init()
    ├─ Spark_Face_Init()
    ├─ Spark_Anim_Init()
    ├─ Spark_Emotion_Init()
    ├─ Spark_Intent_Init()
    └─ Deskimon_Start()
         ├─ Provisioning_GetConfig() → read eye_color
         ├─ s_eye_color_pending = true
         ├─ lv_obj_add_event_cb(scr, screen_event_cb, LV_EVENT_ALL)
         ├─ [creates all LVGL objects — see Face Loading Flow]
         └─ lv_timer_create(logic_timer_cb, 100ms)

Main Loop:
while(1) { vTaskDelay(10ms); lv_timer_handler(); }
```

---

## Face Loading Flow (Spark_Face_Set)

```
Spark_Face_Set(face)  [spark_face.c:221]
│
├─ if face == s_current_face: return (no-op)
│
├─ if leaving IGNORE face:
│    Spark_Anim_Fade(EYE_CONTAINER_L, true, 300)
│    Spark_Anim_Fade(EYE_CONTAINER_R, true, 300)
│
├─ s_current_face = face
├─ cfg = &SPARK_FACES[face]
│
├─ if face in {INSECURE, INTEREST, IGNORE, EYES_CLOSED}:
│    Fade EYE_CONTAINER_L/R OUT (0, 300ms)  ← hide base eyes
│  else:
│    Fade EYE_CONTAINER_L/R IN (255, 300ms) ← show base eyes
│
├─ hide_all_masks(300)        ← slide top/moon masks off-screen
├─ hide_all_accessories(300)  ← fade all mouths/tears/closed eyes to 0
│
├─ if cfg->left_eye.is_visible:
│    Spark_Anim_AnimateEyeBase(EYE_CONTAINER_L, w, h, 0, tx, ty, time)
│      ├─ Spark_Anim_Prop(obj, SetWidthCb,  current→w,  time)
│      ├─ Spark_Anim_Prop(obj, SetHeightCb, current→h,  time)
│      ├─ Spark_Anim_Prop(obj, SetAngleCb,  current→0,  time)
│      ├─ Spark_Anim_Prop(obj, SetTxCb,     current→tx, time)
│      └─ Spark_Anim_Prop(obj, SetTyCb,     current→ty, time)
│
├─ Apply mask_top_y / mask_moon_y if != -400 (sentinel = "hide")
│    Spark_Anim_Prop(MASK_TOP_L, SetTyCb, current→mask_top_y, time)
│    ...
│
└─ switch(face):
     BLUSH:        Fade(MOUTH_ARC_L/R, true, 300)
     BORING:       Fade(MOUTH_YAWN, true, 500)
     CHILL:        Fade(MOUTH_ARC_L/R, true, 400)
     CRY:          Fade(TEAR_L/R, true, 300)
     CRYING_MOUTH: Fade TEAR, Prop(TEAR height/ty), Fade(MOUTH_YAWN)
     EYES_CLOSED:  Fade(EYE_CLOSED_L/R, true, 300)
     HAPPY_CRY:    Fade TEAR, Prop(TEAR height/ty), Fade(MOUTH_TRIANGLE)
     IGNORE:       Fade(IGNORE_LINE/HEMI L/R, true, 300)
     INSECURE:     Fade(INSECURE containers + INSECURE_MOUTH + INSEC_COVER L/R)
     INTEREST:     Fade(INSECURE containers + INTEREST_MOUTH_L/R + INSEC_COVER L/R)
     OOH:          lv_obj_set_size(EYE containers, 70, 90) then AnimateEyeBase;
                   set MOUTH_OOH size 10x5, Fade true, Prop width/height 10→32
     WTF:          lv_obj_set_size(EYE containers, 20, 16) then AnimateEyeBase;
                   MOUTH_WTF_CIRCLE shrink to 0; MOUTH_WTF grow from 0→40x30
     LAUGH:        LAUGH_MOUTH size 140x5, Fade true, Prop height 5→70
     default:      nothing
```

---

## Animation Flow (logic_timer_cb — 100ms tick)

```
logic_timer_cb()  [deskimon.c:337]
│
├─ state_time += 100
├─ idle_time += 100
│
├─ [DEV MODE check — returns early if SPARK_DEVELOPER_PREVIEW_MODE=1]
│
├─ Sync face state: if Spark_Face_Get() != current_state → set_eyes_state()
│
├─ if s_eye_state_pending: set_eyes_state(s_pending_eye_state)
│
├─ if s_eye_color_pending:
│    Apply s_eye_color_hex to ALL LVGL objects:
│    eye_l, eye_r (bg_color, border), auras (bg_color, opa),
│    insecure_eye_l/r (same), line colors for: ec_l/r, insec_cover,
│    arc colors for: mouth_arc_l/r, interest_mouth_l/r,
│    bg colors for: mouth_yawn, tear_l/r, mouth_triangle,
│                   ignore_hemi_l/r, mouth_wtf, mouth_wtf_circle,
│                   laugh_mouth, laugh_hemi_l/r, insecure_mouth,
│    border color: mouth_ooh,
│    line color: ignore_line_l/r
│
├─ Per-state live animations:
│    EYES_CLOSED: every 200ms → random translate_x/y shake of eye_closed_l/r
│    LAUGH: every 300ms → oscillate laugh_mouth height 55↔75
│    INSECURE/INTEREST/IGNORE/HAPPY_CRY/CRYING_MOUTH:
│      every 800ms → random lateral drift of eyes/mouth elements
│    HAPPY_CRY / CRYING_MOUTH:
│      every 800ms → animate tear height (40→70-110)
│      at 400ms offset → collapse tears back to 40
│
├─ BOOT state: after 1000ms → set_eyes_state(NORMAL)
│
├─ getAccelerometer()   ← reads QMI8658 IMU
│    tilted_up = Accel.y > 0.6
│    shaking = move_amount > 1.5
│
├─ IMU reactions:
│    tilted_up + shaking   → CRYING_MOUTH
│    tilted_up + not shake → CRY (if not already crying)
│    movement > 0.05 + in SLEEP/EYES_CLOSED → CHILL
│    movement > 0.05 + in BORED → NORMAL
│    shaking + not tilted + shaking_x → IGNORE
│    shaking + not tilted + not x → ANGRY
│
└─ Idle/state timeout logic:
     NORMAL + idle > 7000ms   → BORING
     NORMAL + state >= look_time → random eye pan (animate_eye_base with random tx/ry)
     BORING + state > 4500ms  → BORED
     BORED  + idle > 15000ms  → SLEEP
     SLEEP  + state > 10000ms → EYES_CLOSED
     HAPPY/BLUSH/CRY/IGNORE + state > 3500ms → NORMAL
     HAPPY_CRY + state > 3500ms → HAPPY
     WTF + state > 2500ms → INTEREST
     CHILL/INSECURE/INTEREST/OOH/LAUGH + state > 2500ms → NORMAL
     ANGRY + state > 5000ms → INSECURE
     CRYING_MOUTH + state > 4500ms + not shaking + not tilted → NORMAL
```

---

## Voice Flow Call Graph

```
[Wake word detected by MultiNet in detect_handler]
│
├─ self->detected = true
├─ MIC_SetConvState(CONV_STATE_LISTENING)
│    └─ Spark_State_TransitionTo(SPARK_STATE_LISTENING)
├─ start_recording()
│    └─ s_recording_active = true, s_record_index = 0
├─ Cloud_SetListeningState(true)
└─ Spark_Emotion_Set("listening")
     └─ Spark_Face_Set(SPARK_FACE_INTEREST)

[feed_handler: VAD silence detected]
│
└─ finish_recording_and_upload(final_samples)
     ├─ s_recording_active = false
     ├─ MIC_SetConvState(CONV_STATE_PROCESSING)
     │    └─ Spark_State_TransitionTo(SPARK_STATE_THINKING)
     ├─ Spark_Emotion_Set("interest")   ← "thinking" face
     └─ xTaskCreatePinnedToCore(voice_upload_task, core 1, prio 5)
          └─ Cloud_UploadVoiceDirect(s_record_buf, num_samples)  [Cloud_Upload.c:363]
               ├─ if no s_voice_api_url → Cloud_UploadVoiceBuffer() (Supabase fallback)
               ├─ Build WAV header (RIFF/WAVE/fmt/data) in SPIRAM
               ├─ Copy PCM data into WAV buffer
               ├─ esp_http_client_init(s_voice_api_url + "/api/voice")
               ├─ Set headers:
               │    X-Device-Id, X-Device-Battery, X-Device-Volume,
               │    X-Device-Wifi-SSID, X-Device-Wifi-RSSI, X-Device-Boot-Count
               ├─ HTTP POST (WAV body)
               │    [LATENCY_AUDIT: HTTP Upload End]
               ├─ Wait for response (HTTP event handler collects MP3)
               │    [LATENCY_AUDIT: First Byte Received]
               ├─ Response complete → MP3 in SPIRAM (s_mp3_play_buf)
               ├─ MIC_SetConvState(CONV_STATE_SPEAKING)
               │    └─ Spark_State_TransitionTo(SPARK_STATE_SPEAKING)
               └─ Audio_Play_MP3_Buffer(s_mp3_play_buf, len)
                    ├─ Helix MP3 decode
                    ├─ I2S DMA output → PCM5101 → Speaker
                    └─ Playback complete:
                         ├─ heap_caps_free(s_mp3_play_buf)
                         ├─ MIC_SetConvState(CONV_STATE_FOLLOWUP_LISTENING)
                         ├─ start_followup_timer()   ← 15s window
                         ├─ s_settling_active = true (300ms post-playback mute)
                         ├─ Cloud_SetListeningState(false)
                         └─ Spark_Emotion_Set("normal")
```

---

## Memory Flow

```
s_record_buf allocation:
  MIC_Speech_init() → heap_caps_malloc(16000*5*2 bytes, SPIRAM)
                    = 160,000 bytes (160KB) in SPIRAM
  This buffer is PERMANENT (never freed during device lifetime)

WAV build (per voice query):
  Cloud_UploadVoiceDirect() → heap_caps_malloc(wav_size, SPIRAM)
  wav_size = 44 (header) + num_samples * 2
  Example: 5s * 16kHz = 160,000 samples * 2 = 320,044 bytes
  Freed immediately after HTTP upload

MP3 response buffer:
  Cloud_UploadVoiceDirect → heap_caps_malloc(response_max, SPIRAM)
  response_max = configured for expected MP3 size
  Freed after Audio_Play_MP3_Buffer() completes

WebSocket receive buffer:
  Cloud.c → heap_caps_malloc(payload_len + 1, SPIRAM)
  Allocated per message, freed after parse_supabase_realtime_msg()

cJSON buffers:
  Hooks set to use SPIRAM. All cJSON allocs go to SPIRAM.

Cloud sync task stack:
  Static: 8192 bytes from SPIRAM

feed_handler loop buffers:
  i2s_buff: malloc(chunk * sizeof(int32)) — internal heap (small, ~512B)
  feed_buf: malloc(chunk * sizeof(int16)) — internal heap (small, ~256B)
  These are task-local and live for the task lifetime.
```
