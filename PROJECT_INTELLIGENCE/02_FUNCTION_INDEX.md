# 02 — FUNCTION INDEX

This function index details every important firmware function, its containing file, core responsibility, calling modules ("Called by"), and functions it invokes ("Calls").

---

## 1. System Entry & Driver Thread
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `app_main()` | `main.c` | Core firmware entry point. Initializes drivers, graphic controllers, graphics layout loop, and decides Boot Mode (Dev/Prod). | ESP-IDF Bootloader | `Driver_Init`, `LCD_Init`, `LVGL_Init`, `SD_Init` (Prod), `Audio_Init` (Prod), `MIC_Speech_init` (Prod), `Spark_State_Init`, `Deskimon_Start` / `Deskimon_FaceDevMode_Start`, `lv_timer_handler` |
| `Driver_Init()` | `main.c` | Initialises power, battery, I2C bus, extended IO expander, NVS namespace, RTC and IMU modules. Spawns Driver loop task on Core 0. | `app_main` | `PWR_Init`, `BAT_Init`, `I2C_Init`, `EXIO_Init`, `Flash_Searching`, `PCF85063_Init`, `QMI8658_Init`, `xTaskCreatePinnedToCore` |
| `Driver_Loop()` | `main.c` | Dedicated driver background thread (running every 100ms) to poll RTC, IMU, battery levels, power keys, and launches Wi-Fi. | `Driver_Init` (Task creation) | `QMI8658_Loop`, `PCF85063_Loop`, `BAT_Get_Volts`, `PWR_Loop`, `Wireless_Init` |

---

## 2. SparkCore — Face Manager
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Spark_Face_Init()` | `SparkCore/spark_face.c` | Resets current face to `SPARK_FACE_BOOT`. | `app_main`, `dev_mode_load_face` | *None* |
| `Spark_Face_Get()` | `SparkCore/spark_face.c` | Returns current face enum (`spark_face_t`). | `logic_timer_cb` | *None* |
| `Spark_Face_GetName()` | `SparkCore/spark_face.c` | Resolves face enum to its string label. | Logging utilities | *None* |
| `Spark_Face_GetConfig()` | `SparkCore/spark_face.c` | Returns configuration specs pointer for given face. | `Spark_Face_Set` | *None* |
| `Spark_Face_Set()` | `SparkCore/spark_face.c` | Manages animations and accessory rendering swaps to transition into the target face. | `set_eyes_state`, `dev_mode_load_face` | `Spark_Face_GetConfig`, `hide_all_masks`, `hide_all_accessories`, `Spark_Anim_AnimateEyeBase`, `Spark_Anim_Fade`, `Spark_Anim_Prop` |
| `Spark_Face_SetColor()` | `SparkCore/spark_face.c` | Modifies global s_eye_color_hex variable. | `Cloud.c`, `Deskimon_Start` | *None* |
| `hide_all_masks()` | `SparkCore/spark_face.c` | Animates the top and bottom eye masks off-screen. | `Spark_Face_Set` | `Spark_Anim_Prop` |
| `hide_all_accessories()` | `SparkCore/spark_face.c` | Fades out all mouths, tear overlays, and shut eyes objects to transparent. | `Spark_Face_Set` | `Spark_Anim_Fade` |

---

## 3. SparkCore — Animation Wrapper
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Spark_Anim_Init()` | `SparkCore/spark_animation.c` | Registry placeholder initialization. | `app_main` | *None* |
| `Spark_Anim_Prop()` | `SparkCore/spark_animation.c` | Sets up and runs a transition ease-in-out property animation. | `Spark_Face_Set`, `Spark_Anim_Fade`, `Spark_Anim_AnimateEyeBase`, `Spark_Anim_Play`, `Spark_Cosmic_Tick` | `lv_anim_del`, `lv_anim_init`, `lv_anim_start` |
| `Spark_Anim_Fade()` | `SparkCore/spark_animation.c` | Animates object opacity between transparent (0) and solid (255). | `Spark_Face_Set`, `hide_all_accessories`, `Spark_Cosmic_Tick` | `lv_obj_get_style_opa`, `Spark_Anim_Prop` |
| `Spark_Anim_FadeAura()` | `SparkCore/spark_animation.c` | Animates object opacity to the glow aura value (LV_OPA_20). | `Spark_Face_Set` | `Spark_Anim_Prop` |
| `Spark_Anim_AnimateEyeBase()` | `SparkCore/spark_animation.c` | Standardized bulk animation transition for eye size and position. | `Spark_Face_Set` | `Spark_Anim_Prop` |
| `Spark_Anim_Play()` | `SparkCore/spark_animation.c` | Triggers procedural cycles (BLINK, BOUNCE, SHAKE, FLOAT). | Voice pipeline callbacks | `Spark_Anim_Prop` |
| `Spark_Anim_Stop()` | `SparkCore/spark_animation.c` | Terminates all current animations affecting the object. | System resets | `lv_anim_del` |

---

## 4. SparkCore — State Machine
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Spark_State_Init()` | `SparkCore/spark_state.c` | Sets device state to `SPARK_STATE_BOOT` and clears event registers. | `app_main` | *None* |
| `Spark_State_Get()` | `SparkCore/spark_state.c` | Returns current high-level state enum. | `logic_timer_cb` | *None* |
| `Spark_State_TransitionTo()` | `SparkCore/spark_state.c` | Validates, transition-logs, and dispatches callbacks for new states. | `MIC_SetConvState`, `app_main` | Callback vector loops |
| `Spark_State_RegisterCallback()`| `SparkCore/spark_state.c` | Registers callback hooks for state change triggers. | `MIC_Speech_init` | *None* |

---

## 5. SparkCore — Emotion & Intent
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Spark_Emotion_Init()` | `SparkCore/spark_emotion.c` | Stubs emotion registry init. | `app_main` | *None* |
| `Spark_Emotion_Set()` | `SparkCore/spark_emotion.c` | Parses emotion string tag, resolves layout, and invokes Face Set. | `MIC_Speech.c`, `Cloud_Upload.c` | `Spark_Face_Set` |
| `Spark_Emotion_ProcessIntent()`| `SparkCore/spark_emotion.c` | Maps matching intent labels to emotion strings and updates face. | Intent callbacks | `Spark_Emotion_Set` |
| `Spark_Intent_Init()` | `SparkCore/spark_intent.c` | Intent handler stub. | `app_main` | *None* |

---

## 6. LVGL UI — Core Rendering Engine
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Deskimon_Start()` | `LVGL_UI/deskimon.c` | Bootstraps production mode UI: constructs 60+ static objects and links event timers. | `app_main` | `Provisioning_GetConfig`, `create_eye_masks`, `lv_obj_create`, `lv_obj_add_event_cb`, `lv_timer_create` |
| `Deskimon_FaceDevMode_Start()`| `LVGL_UI/deskimon.c` | Bootstraps dev mode UI: mounts test frame indicators and cycles face tables. | `app_main` | `dev_mode_load_face`, `lv_timer_create` |
| `Deskimon_SetEyeColor()` | `LVGL_UI/deskimon.c` | Signals that a pending eye color update requires render application. | `Cloud.c`, `Deskimon_Start` | *None* (Sets flag) |
| `Deskimon_SetEmotion()` | `LVGL_UI/deskimon.c` | Cloud-triggered emotion setting (mirrors SparkCore emotion string lookup). | `Cloud.c` | `set_eyes_state` |
| `logic_timer_cb()` | `LVGL_UI/deskimon.c` | Main 100ms UI update timer: manages idle look-around, color overrides, continuous animations, and sensor updates. | LVGL Timer Queue | `Spark_Face_Get`, `set_eyes_state`, `getAccelerometer`, `animate_eye_base` |
| `screen_event_cb()` | `LVGL_UI/deskimon.c` | Interprets screen taps and swipe gesture vectors, updates face states. | LVGL Input Driver | `set_eyes_state`, `MIC_StartRecordingManual` |
| `set_eyes_state()` | `LVGL_UI/deskimon.c` | Transition helper: resets local timers and calls Spark_Face_Set. | `logic_timer_cb`, `screen_event_cb` | `Spark_Face_Set` |
| `create_eye_masks()` | `LVGL_UI/deskimon.c` | Creates top and bottom black overlay objects inside eye container. | `Deskimon_Start`, `create_dev_base_eyes` | `lv_obj_create` |
| `Spark_UI_GetObj()` | `LVGL_UI/deskimon.c` | Returns specific LVGL widget pointer given its ID enum. | `Spark_Cosmic_Tick`, `Spark_Face_Set` | *None* |

---

## 7. Dev Mode Operations (deskimon.c)
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `dev_mode_load_face()` | `LVGL_UI/deskimon.c` | Destroys active face, sets up layout config, and loads the target face. | `Deskimon_FaceDevMode_Start`, `dev_mode_next_face` | `destroy_active_face`, `create_face_elements`, `Spark_Face_Init`, `Spark_Face_Set`, `Spark_Cosmic_SetFace` |
| `dev_mode_next_face()` | `LVGL_UI/deskimon.c` | Iterates to the next face in the development preview list. | `dev_btn_event_cb`, `dev_mode_timer_cb` | `dev_mode_load_face` |
| `dev_mode_timer_cb()` | `LVGL_UI/deskimon.c` | Runs cosmic frame updates and triggers 4s auto-advance cycling. | LVGL Timer Queue | `Spark_Cosmic_Tick`, `dev_mode_next_face` |
| `destroy_active_face()` | `LVGL_UI/deskimon.c` | Cleans up the active face container tree and sets pointers to NULL. | `dev_mode_load_face` | `lv_obj_del` |
| `create_face_elements()` | `LVGL_UI/deskimon.c` | Dispatches specific widget generators depending on target face type. | `dev_mode_load_face` | `create_dev_base_eyes`, `create_dev_mouth_arcs`, `create_dev_cosmic_effects` |

---

## 8. MIC Driver — Audio Input Pipeline
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `MIC_Speech_init()` | `MIC_Driver/MIC_Speech.c` | Initializes srmodels, configures physical audio I2S RX, allocates SPIRAM storage, and spawns processing tasks. | `app_main` | `heap_caps_malloc`, `xTimerCreate`, `i2s_init`, `esp_afe_sr_init`, `xTaskCreatePinnedToCore`, `Spark_State_RegisterCallback` |
| `MIC_GetConvState()` | `MIC_Driver/MIC_Speech.c` | Returns active conversational pipeline status. | Cloud routines | *None* |
| `MIC_SetConvState()` | `MIC_Driver/MIC_Speech.c` | Updates conversational pipelines and synchronizes device state. | `feed_handler`, `detect_handler`, `voice_upload_task` | `Spark_State_TransitionTo` |
| `feed_handler()` | `MIC_Driver/MIC_Speech.c` | Dedicated thread. Acquires I2S samples, scales to 16-bit, feeds AFE, and saves speech window frames during active recording. | `MIC_Speech_init` (Task) | `i2s_read`, `esp_afe_sr_feed`, `finish_recording_and_upload` |
| `detect_handler()` | `MIC_Driver/MIC_Speech.c` | Dedicated thread. Watches processed AFE audio lines, searching for wake-words via WakeNet. | `MIC_Speech_init` (Task) | `esp_afe_sr_detect`, `start_recording` |
| `start_recording()` | `MIC_Driver/MIC_Speech.c` | Signals listening trigger and starts buffering incoming audio. | `detect_handler` | `MIC_SetConvState`, `Cloud_SetListeningState`, `Spark_Emotion_Set` |
| `finish_recording_and_upload()`| `MIC_Driver/MIC_Speech.c` | Finishes active recording windows and generates temporary upload task. | `feed_handler` | `MIC_SetConvState`, `Spark_Emotion_Set`, `xTaskCreatePinnedToCore` |
| `voice_upload_task()` | `MIC_Driver/MIC_Speech.c` | Transient worker thread: calls Cloud upload direct, then terminates. | `finish_recording_and_upload` | `Cloud_UploadVoiceDirect`, `vTaskDelete` |
| `transition_to_idle()` | `MIC_Driver/MIC_Speech.c` | Resets pipeline state and re-enables wake word engine. | `followup_timer_callback` | `MIC_SetConvState`, `Spark_Emotion_Set` |

---

## 9. Cloud Sync & Network Uploads
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Cloud_Start()` | `Cloud/Cloud.c` | Sets up WebSocket hooks and establishes persistent real-time connection to Supabase. | `Wireless_Init` | `esp_websocket_client_init`, `esp_websocket_client_start`, `xTaskCreateStaticPinnedToCore` |
| `Cloud_ReportDiagnostics()` | `Cloud/Cloud.c` | Posts device health (battery %, Wi-Fi RSSI) to database. | `cloud_sync_task` | `BAT_Get_Volts`, `esp_http_client_perform` |
| `websocket_event_handler()` | `Cloud/Cloud.c` | Dispatches received WebSocket packets to parsing queues. | ESP-WebSocket | `parse_supabase_realtime_msg` |
| `parse_supabase_realtime_msg()`| `Cloud/Cloud.c` | Parses cJSON UPDATE frames to update settings (eye color, volume). | `websocket_event_handler`| `Deskimon_SetEyeColor`, `Deskimon_SetEmotion`, `Volume_adjustment` |
| `cloud_sync_task()` | `Cloud/Cloud.c` | Static thread task running every 30s to keep WebSocket links alive. | `Cloud_Start` (Task) | `esp_websocket_client_send_bin`, `Cloud_ReportDiagnostics` |
| `Cloud_UploadVoiceDirect()` | `Cloud/Cloud_Upload.c` | Builds a WAV format block in SPIRAM, POSTs voice query to AI backend, and fetches response MP3. | `voice_upload_task` | `heap_caps_malloc`, `esp_http_client_perform`, `Audio_Play_MP3_Buffer`, `heap_caps_free` |

---

## 10. Hardware Drivers (Audio & IMU)
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Audio_Init()` | `Audio_Driver/PCM5101.c` | Configures and starts standard I2S audio output bus. | `app_main` | `i2s_channel_init` |
| `Audio_Play_MP3_Buffer()` | `Audio_Driver/PCM5101.c` | Helix soft-decodes MP3 memory buffer, pushing frames to DAC DMA. | `Cloud_UploadVoiceDirect` | `MP3InitDecoder`, `MP3Decode`, `Volume_adjustment`, `i2s_channel_write` |
| `Volume_adjustment()` | `Audio_Driver/PCM5101.c` | Applies digital volume level adjustments on raw PCM data. | `Audio_Play_MP3_Buffer`, `Provisioning_Init` | *None* |
| `QMI8658_Init()` | `QMI8658/QMI8658.c` | Initializes the I2C registers of the 6-axis IMU. | `Driver_Init` | `I2C_Write` |
| `QMI8658_Loop()` | `QMI8658/QMI8658.c` | Periodically reads raw accelerometer lines. | `Driver_Loop` | `I2C_Read` |
| `getAccelerometer()` | `QMI8658/QMI8658.c` | populates global `Accel` structure. | `logic_timer_cb` | *None* |

---

## 11. Cosmic Subsystem (spark_cosmic.c)
| Function | File | Responsibility | Called By | Calls |
| :--- | :--- | :--- | :--- | :--- |
| `Spark_Cosmic_Init()` | `SparkCore/spark_cosmic.c` | Cosmic registry initializer (no-op). | `app_main` | *None* |
| `Spark_Cosmic_HideAll()` | `SparkCore/spark_cosmic.c` | Animates the opacity of all 30+ cosmic elements to transparent. | `dev_mode_load_face` | `Spark_Anim_Fade` |
| `Spark_Cosmic_SetFace()` | `SparkCore/spark_cosmic.c` | Configures structural sizes and starting points for cosmic animations. | `dev_mode_load_face` | `Spark_UI_GetObj`, `lv_obj_set_size` |
| `Spark_Cosmic_Tick()` | `SparkCore/spark_cosmic.c` | Step evaluator driving active particle locations, orbits, and scaling lines. | `dev_mode_timer_cb` | `Spark_UI_GetObj`, `Spark_Anim_Prop`, `lv_obj_set_style_transform_angle` |
