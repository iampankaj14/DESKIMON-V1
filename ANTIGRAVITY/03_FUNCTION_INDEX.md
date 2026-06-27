# 03 — FUNCTION INDEX

## Entry Points

| Function | File | Responsibility |
|---|---|---|
| `app_main()` | `main/main.c:53` | Top-level entry. Calls Driver_Init, LCD, LVGL, then DEV or PROD path |
| `Driver_Init()` | `main/main.c:35` | Synchronous hardware init (PWR, BAT, I2C, EXIO, Flash, RTC, IMU) |
| `Driver_Loop()` | `main/main.c:21` | FreeRTOS task on core 0. Polls IMU, RTC, BAT, PWR every 100ms, then launches WiFi |

---

## SparkCore — Face System

| Function | File | Responsibility |
|---|---|---|
| `Spark_Face_Init()` | `SparkCore/spark_face.c:160` | Sets s_current_face = SPARK_FACE_BOOT, logs init |
| `Spark_Face_Set(face)` | `SparkCore/spark_face.c:221` | Main face transition. Hides all accessories, applies eye layout from SPARK_FACES[], calls switch case for per-face overrides |
| `Spark_Face_Get()` | `SparkCore/spark_face.c:165` | Returns current face enum value |
| `Spark_Face_GetName(face)` | `SparkCore/spark_face.c:169` | Returns string name for logging ("NORMAL", "HAPPY", etc.) |
| `Spark_Face_GetConfig(face)` | `SparkCore/spark_face.c:176` | Returns pointer to `spark_face_config_t` for given face |
| `Spark_Face_SetColor(hex)` | `SparkCore/spark_face.c:389` | Sets s_eye_color_hex (NOTE: does NOT update LVGL directly. Comment says "via logic_timer_cb in deskimon.c") |
| `hide_all_masks(time)` | `SparkCore/spark_face.c:183` | Private. Slides all 4 mask objects off-screen with animation |
| `hide_all_accessories(time)` | `SparkCore/spark_face.c:190` | Private. Fades all mouth/tear/closed-eye objects to OPA=0 |

---

## SparkCore — Animation System

| Function | File | Responsibility |
|---|---|---|
| `Spark_Anim_Init()` | `SparkCore/spark_animation.c:14` | Logs init (no-op) |
| `Spark_Anim_Prop(obj, cb, start, end, time)` | `SparkCore/spark_animation.c:18` | Core: runs any LVGL animation on any property via callback |
| `Spark_Anim_Fade(obj, show, time)` | `SparkCore/spark_animation.c:35` | Animates opacity 0↔255 |
| `Spark_Anim_FadeAura(obj, show, time)` | `SparkCore/spark_animation.c:45` | Animates opacity 0↔LV_OPA_20 (for aura glow) |
| `Spark_Anim_AnimateEyeBase(eye, w, h, angle, tx, ty, time)` | `SparkCore/spark_animation.c:55` | Animates all 5 transform properties of an eye container simultaneously |
| `Spark_Anim_Play(anim, target, duration)` | `SparkCore/spark_animation.c:64` | High-level: BLINK, WINK, BOUNCE, SHAKE, FLOAT |
| `Spark_Anim_Stop(target)` | `SparkCore/spark_animation.c:105` | Cancels all 6 active animations on an object |
| `Spark_Anim_SetWidthCb` | `SparkCore/spark_animation.c:7` | LVGL exec callback: sets object width |
| `Spark_Anim_SetHeightCb` | `SparkCore/spark_animation.c:8` | LVGL exec callback: sets object height |
| `Spark_Anim_SetAngleCb` | `SparkCore/spark_animation.c:9` | LVGL exec callback: sets transform_angle |
| `Spark_Anim_SetTxCb` | `SparkCore/spark_animation.c:10` | LVGL exec callback: sets translate_x |
| `Spark_Anim_SetTyCb` | `SparkCore/spark_animation.c:11` | LVGL exec callback: sets translate_y |
| `Spark_Anim_SetOpaCb` | `SparkCore/spark_animation.c:12` | LVGL exec callback: sets opacity |

---

## SparkCore — State Machine

| Function | File | Responsibility |
|---|---|---|
| `Spark_State_Init()` | `SparkCore/spark_state.c:13` | Sets state to BOOT, clears callbacks |
| `Spark_State_Get()` | `SparkCore/spark_state.c:21` | Returns current `spark_state_t` |
| `Spark_State_TransitionTo(next)` | `SparkCore/spark_state.c:25` | Validates transition, calls callbacks. NOTE: always allows transition (logs warning for invalid) |
| `Spark_State_RegisterCallback(cb)` | `SparkCore/spark_state.c:94` | Registers state change callback (max 8) |
| `Spark_State_ToString(state)` | `SparkCore/spark_state.c:102` | Returns human-readable state name |

---

## SparkCore — Emotion + Intent

| Function | File | Responsibility |
|---|---|---|
| `Spark_Emotion_Init()` | `SparkCore/spark_emotion.c:8` | Logs init (no-op) |
| `Spark_Emotion_Set(tag)` | `SparkCore/spark_emotion.c:12` | Maps string emotion → spark_face_t → calls Spark_Face_Set() |
| `Spark_Emotion_ProcessIntent(name)` | `SparkCore/spark_emotion.c:46` | Maps intent name string → emotion string → Spark_Emotion_Set() |
| `Spark_Intent_Init()` | `SparkCore/spark_intent.c` | Stub, currently minimal |

---

## SparkCore — UI Object Registry

| Function | File | Responsibility |
|---|---|---|
| `Spark_UI_GetObj(id)` | `LVGL_UI/deskimon.c:1513` | Returns `lv_obj_t*` for any of the 60+ registered UI objects by enum ID. Returns NULL for unknown IDs |

---

## LVGL_UI — Main UI Engine

| Function | File | Responsibility |
|---|---|---|
| `Deskimon_Start()` | `LVGL_UI/deskimon.c:789` | Production startup. Creates ALL LVGL objects (eyes, mouths, tears, cosmic objects). Registers touch/gesture events. Creates logic_timer |
| `Deskimon_FaceDevMode_Start()` | `LVGL_UI/deskimon.c:2404` | Dev mode startup. Creates UI chrome (labels, NEXT button), loads first face via dev_mode_load_face() |
| `Deskimon_SetEyeColor(hex)` | `LVGL_UI/deskimon.c:1477` | Queues eye color update (sets s_eye_color_pending flag) |
| `Deskimon_SetEmotion(string)` | `LVGL_UI/deskimon.c:1483` | Maps string emotion to eye_state_t (duplicates Spark_Emotion_Set logic) |
| `logic_timer_cb(t)` | `LVGL_UI/deskimon.c:337` | 100ms timer. Handles: state sync, color apply, per-state animations, IMU reactions, idle timeouts |
| `screen_event_cb(e)` | `LVGL_UI/deskimon.c:708` | Touch/gesture event handler for all screen events |
| `set_eyes_state(new_state)` | `LVGL_UI/deskimon.c:330` | Sets local current_state + resets state_time + calls Spark_Face_Set() |
| `create_eye_masks(eye, top, moon)` | `LVGL_UI/deskimon.c:769` | Creates the two black masking objects inside each eye container |
| `animate_eye_base(eye, w, h, angle, tx, ty, time)` | `LVGL_UI/deskimon.c:319` | LOCAL duplicate of Spark_Anim_AnimateEyeBase (uses private callbacks) |
| `anim_prop(obj, cb, start, end, time)` | `LVGL_UI/deskimon.c:207` | LOCAL duplicate of Spark_Anim_Prop (same implementation) |

---

## LVGL_UI — Dev Mode Functions

| Function | File | Responsibility |
|---|---|---|
| `dev_mode_load_face(face)` | `LVGL_UI/deskimon.c:2354` | Destroys old face, creates new face, updates labels, calls Spark_Face_Set or Spark_Cosmic_SetFace |
| `dev_mode_next_face()` | `LVGL_UI/deskimon.c:2376` | Advances face index, resets timers, calls dev_mode_load_face |
| `dev_mode_timer_cb(t)` | `LVGL_UI/deskimon.c:2390` | 100ms timer. Ticks cosmic animations. Auto-advances face every 4000ms |
| `destroy_active_face()` | `LVGL_UI/deskimon.c:1669` | Calls lv_obj_del(face_root) and NULLs all static pointers |
| `create_face_elements(face)` | `LVGL_UI/deskimon.c:2277` | Decides which sub-create functions to call based on face requirements |
| `create_dev_base_eyes()` | `LVGL_UI/deskimon.c:1737` | Creates eye containers, auras, pupils, masks |
| `create_dev_insecure_eyes()` | `LVGL_UI/deskimon.c:1812` | Creates insecure/interest alternate eye style |
| `create_dev_mouth_arcs()` | `LVGL_UI/deskimon.c:1913` | Creates blush/chill arc mouths |
| `create_dev_cosmic_effects()` | `LVGL_UI/deskimon.c:2178` | Creates 8 particles, 8 rings, core, 2 trails, 2 arcs, shadow, 4 lines, reticle |

---

## MIC_Driver — Voice Pipeline

| Function | File | Responsibility |
|---|---|---|
| `MIC_Speech_init()` | `MIC_Driver/MIC_Speech.c` | Allocates s_record_buf in SPIRAM, creates followup timer, inits I2S, starts feed_task + detect_task |
| `MIC_GetConvState()` | `MIC_Driver/MIC_Speech.c:83` | Returns current conversation state |
| `MIC_SetConvState(state)` | `MIC_Driver/MIC_Speech.c:88` | Updates s_conv_state, syncs to Spark_State via TransitionTo() |
| `MIC_StartRecordingManual()` | `MIC_Driver/MIC_Speech.c` | Allows manual recording trigger from long press |
| `feed_handler(self)` | `MIC_Driver/MIC_Speech.c:287` | Runs on dedicated FreeRTOS task. Reads I2S, converts to 16-bit, feeds AFE, handles VAD recording |
| `detect_handler(self)` | `MIC_Driver/MIC_Speech.c:424` | Runs on dedicated FreeRTOS task. Processes AFE output through MultiNet wake word model |
| `start_recording()` | `MIC_Driver/MIC_Speech.c:180` | Sets s_recording_active + resets record_index |
| `finish_recording_and_upload(samples)` | `MIC_Driver/MIC_Speech.c:248` | Stops recording, transitions to PROCESSING, creates voice_upload_task |
| `voice_upload_task(pvParams)` | `MIC_Driver/MIC_Speech.c:226` | Transient task: calls Cloud_UploadVoiceDirect(), deletes self |
| `transition_to_idle()` | `MIC_Driver/MIC_Speech.c:156` | Centralized cleanup: cancels timer, re-enables wake word, resets state |
| `followup_timer_callback(timer)` | `MIC_Driver/MIC_Speech.c:117` | 15s timeout: returns to IDLE if no follow-up speech |
| `start_followup_timer()` | `MIC_Driver/MIC_Speech.c:134` | Starts/resets xTimerHandle |
| `cancel_followup_timer()` | `MIC_Driver/MIC_Speech.c:144` | Stops xTimerHandle |

---

## Cloud — HTTP + WebSocket

| Function | File | Responsibility |
|---|---|---|
| `Cloud_Start()` | `Cloud/Cloud.c:51` | Builds WSS URI, inits WebSocket client, starts cloud_sync_task |
| `Cloud_Stop()` | `Cloud/Cloud.c:153` | Disconnects WebSocket, frees buffers |
| `Cloud_ReportDiagnostics()` | `Cloud/Cloud.c:175` | HTTP PATCH to Supabase: battery, RSSI, uptime, last_seen_at |
| `Cloud_SetListeningState(bool)` | `Cloud/Cloud.c` | Updates listening indicator in Supabase |
| `Cloud_StartLinkingTask()` | `Cloud/Cloud.c` | Polls Supabase until device is linked to an account |
| `websocket_event_handler(...)` | `Cloud/Cloud.c:268` | Handles WS connect/disconnect/data events. Reassembles fragmented messages. Calls parse_supabase_realtime_msg |
| `parse_supabase_realtime_msg(msg, len)` | `Cloud/Cloud.c` | Parses cJSON from Supabase Realtime UPDATE events. Extracts eye_color, voice_api_url, volume, etc. |
| `cloud_sync_task(pvParams)` | `Cloud/Cloud.c` | FreeRTOS task: sends WebSocket heartbeats every 30s |
| `audio_download_task(pvParams)` | `Cloud/Cloud.c:372` | Downloads audio file from URL, plays via PCM5101 (legacy Supabase path) |
| `Cloud_SetVoiceApiUrl(url)` | `Cloud/Cloud_Upload.c:23` | Sets s_voice_api_url static pointer |
| `Cloud_UploadVoiceDirect(pcm, samples)` | `Cloud/Cloud_Upload.c:363` | PRIMARY VOICE PATH. Builds WAV in SPIRAM → HTTP POST → receives MP3 → plays |
| `Cloud_UploadVoiceBuffer(pcm, samples)` | `Cloud/Cloud_Upload.c:186` | LEGACY: uploads WAV to Supabase Storage |
| `Cloud_UploadVoiceFile(filepath)` | `Cloud/Cloud_Upload.c:30` | LEGACY: reads WAV from SD card, uploads to Supabase Storage |
| `direct_voice_http_event(evt)` | `Cloud/Cloud_Upload.c:337` | HTTP event callback: collects response body into SPIRAM buffer |

---

## Wireless + Provisioning

| Function | File | Responsibility |
|---|---|---|
| `Wireless_Init()` | `Wireless/Wireless.c:13` | Full WiFi + provisioning startup sequence |
| `WIFI_Init(arg)` | `Wireless/Wireless.c:72` | Legacy: basic WiFi init + scan (no provisioning) |
| `WIFI_Scan()` | `Wireless/Wireless.c:87` | Starts WiFi scan, returns AP count |
| `BLE_Init(arg)` | `Wireless/Wireless.c:181` | BLE init + scan (currently unused in production) |
| `Provisioning_Init()` | `Provisioning/Provisioning.c` | Reads NVS config into device_config_t |
| `Provisioning_GetConfig()` | `Provisioning/Provisioning.c` | Returns pointer to static device_config_t |
| `Provisioning_GetState()` | `Provisioning/Provisioning.c` | Returns PROV_STATE_UNPROVISIONED / PROV_STATE_WIFI_ONLY / PROV_STATE_FULLY_PROVISIONED |
| `Provisioning_StartCaptivePortal()` | `Provisioning/Provisioning.c` | Starts WiFi AP + HTTP server + DNS server for portal.html |
| `Provisioning_ConnectWiFi()` | `Provisioning/Provisioning.c` | Connects to stored SSID/password from NVS |

---

## Cosmic Face System

| Function | File | Responsibility |
|---|---|---|
| `Spark_Cosmic_Init()` | `SparkCore/spark_cosmic.c` | Initialize cosmic subsystem |
| `Spark_Cosmic_HideAll(fade_ms)` | `SparkCore/spark_cosmic.c` | Fade all cosmic UI elements to transparent |
| `Spark_Cosmic_SetFace(face)` | `SparkCore/spark_cosmic.c` | Activate and configure a specific cosmic face (COMET_RUSH, ORBIT_MODE, etc.) |
| `Spark_Cosmic_Tick(face, ms)` | `SparkCore/spark_cosmic.c` | Called every 100ms to drive multi-phase animation sequences |

---

## IMU + RTC + Battery

| Function | File | Responsibility |
|---|---|---|
| `QMI8658_Init()` | `QMI8658/QMI8658.c` | I2C init + configure IMU |
| `QMI8658_Loop()` | `QMI8658/QMI8658.c` | Poll IMU data, update global Accel struct |
| `getAccelerometer()` | `QMI8658/QMI8658.c` | Read Accel.x/y/z into global |
| `PCF85063_Init()` | `PCF85063/PCF85063.c` | I2C RTC init |
| `PCF85063_Loop()` | `PCF85063/PCF85063.c` | Periodic RTC read |
| `BAT_Init()` | `BAT_Driver/BAT_Driver.c` | ADC channel setup |
| `BAT_Get_Volts()` | `BAT_Driver/BAT_Driver.c` | Reads battery voltage (3.3V–4.2V range) |

---

## Audio Output

| Function | File | Responsibility |
|---|---|---|
| `Audio_Init()` | `Audio_Driver/PCM5101.c` | I2S DMA setup for audio output |
| `Audio_Play_MP3_Buffer(buf, len)` | `Audio_Driver/PCM5101.c` | Helix decode + I2S stream playback |
| `Volume_adjustment(level)` | `Audio_Driver/PCM5101.c` | Applies software volume scaling |

---

## LVGL Event Callbacks (private to deskimon.c)

| Function | File:Line | Responsibility |
|---|---|---|
| `happy_mouth_mask_event_cb` | `deskimon.c:224` | Custom draw mask for triangle mouth (two-line clip) |
| `wtf_mouth_mask_event_cb` | `deskimon.c:249` | Custom draw mask for WTF inverted triangle mouth |
| `eye_mask_event_cb` | `deskimon.c:275` | Custom draw mask for insecure/interest eye diagonal cuts |
| `eye_container_event_cb` | `deskimon.c:305` | SIZE_CHANGED event: resizes aura to match container |
| `dev_btn_event_cb` | `deskimon.c:2383` | NEXT button click in dev mode |
| `preview_btn_event_cb` | `deskimon.c:172` | NEXT button click in DEVELOPER_PREVIEW_MODE |
