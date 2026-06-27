# 10 — MODULE SUMMARY

A plain-language explanation of every major module in the SPARK project.

---

## Firmware Modules

### `main.c`
**What it does:** The entry point for the entire ESP32 firmware.
- Calls `Driver_Init()` to set up all hardware
- Spawns `Driver_Loop` task (Core 0) for polling IMU, RTC, battery, power key
- Then either starts Face Dev Mode (testing) or the full production stack
- Runs `lv_timer_handler()` every 10ms in the main while loop (LVGL tick)

**Key flag:** `#define SPARK_FACE_DEV_MODE` at line 1 — controls which boot path runs.

---

### `SparkCore/spark_state.c`
**What it does:** The central state machine for the entire device.
- Tracks which "mode" Spark is in: BOOT, IDLE, LISTENING, THINKING, SPEAKING, SLEEPING, CHARGING, UPDATING, ERROR
- Validates state transitions — prevents illegal jumps (e.g., BOOT → SPEAKING)
- Notifies registered callbacks when state changes (up to 8 callbacks)
- Override mode: if a transition is technically invalid, it logs a warning but allows it anyway to prevent system lock

**Think of it as:** The traffic controller that knows where Spark is and where it can go next.

---

### `SparkCore/spark_hardware.c`
**What it does:** Abstracts all physical sensors from the rest of the system.
- Spawns a dedicated FreeRTOS task that polls the IMU (QMI8658) every 100ms
- Detects: Shake (`delta > 1.5g²`), Tilt Up (`Y > 0.6g`)
- Fires callbacks to registered listeners (up to 4 callbacks)
- Provides battery voltage/percentage reads via `BAT_Get_Volts()`
- Controls display backlight

**Think of it as:** The sensor translator — raw numbers in, named events out.

---

### `SparkCore/spark_face.c`
**What it does:** The face rendering engine.
- Stores all 22 configured face definitions as a static const array in Flash
- `Spark_Face_Set(face)` transitions the display from any face to any other face:
  1. Hides all mask overlays
  2. Hides all accessory objects (tears, mouths, etc.)
  3. Applies the new eye geometry via animations
  4. Shows the correct accessories for the new face
- Eye base containers are only hidden/shown for special faces (IGNORE, INSECURE, INTEREST, EYES_CLOSED)
- All transitions use `ease_in_out` curves at the face's `default_transition_ms` speed

**Think of it as:** The art director — knows exactly how every face should look and orchestrates the transition.

---

### `SparkCore/spark_animation.c`
**What it does:** The animation engine — a library of reusable motion behaviors.
- `Spark_Anim_Prop()` — animates any LVGL property from a start value to an end value over a duration
- `Spark_Anim_Fade()` — fades any object in or out
- `Spark_Anim_AnimateEyeBase()` — animates all 5 eye properties at once (W, H, angle, tx, ty)
- `Spark_Anim_Play()` — runs named procedural animations (BLINK, BOUNCE, SHAKE, FLOAT, WINK)
- `Spark_Anim_Stop()` — cancels all animations on an object

**Type-safe callbacks:** `Spark_Anim_SetWidthCb`, `SetHeightCb`, `SetTyCb`, `SetTxCb`, `SetAngleCb`, `SetOpaCb` — properly typed wrappers for LVGL animation executor pattern.

**Think of it as:** The motion library — provides named, reusable movement behaviors.

---

### `SparkCore/spark_emotion.c`
**What it does:** The translator between text and face.
- `Spark_Emotion_Set("happy")` → calls `Spark_Face_Set(SPARK_FACE_HAPPY)`
- `Spark_Emotion_ProcessIntent("COMPANION_TELL_JOKE")` → resolves to emotion tag → calls `Spark_Emotion_Set()`
- Currently maps 11 emotion strings to face IDs
- Unknown emotion strings default to NORMAL

**Think of it as:** The interpreter — converts human-readable emotion words into hardware face transitions.

---

### `SparkCore/spark_intent.c`
**What it does:** The voice recording interface.
- Thin wrapper around `MIC_Speech.c`
- `Spark_Intent_StartRecording()` → calls `MIC_StartRecordingManual()`
- `Spark_Intent_StopRecording()` → sets conv state to IDLE
- `Spark_Intent_IsRecording()` → checks if currently in LISTENING state

**Current state:** Minimal implementation. The full wake word detection pipeline (ESP-SR / AFE) lives in `MIC_Speech.c` and is not fully abstracted behind this interface yet.

**Think of it as:** The microphone button — tells the voice system to start or stop listening.

---

### `SparkCore/spark_ui_objects.h`
**What it does:** The global registry of all LVGL UI objects.
- Defines `spark_ui_obj_id_t` enum with IDs for every widget
- `Spark_UI_GetObj(id)` returns the `lv_obj_t*` for any object
- Covers: eyes, aura halos, mask overlays, all mouth shapes, tears, cosmic objects
- No module holds direct object pointers — everything goes through this registry

**Think of it as:** The address book for every pixel element on screen.

---

### `LVGL_UI/deskimon.c`
**What it does:** The LVGL DOM constructor and UI event handler.
- Creates all LVGL objects and registers them with `Spark_UI_GetObj()`
- Handles touch events (swipes, taps) and maps them to Spark_Emotion calls
- Manages the idle look-around animation and blink timer
- After the SparkCore refactor, this file no longer owns any state — it only creates objects and routes events

---

### `MIC_Driver/MIC_Speech.c`
**What it does:** The complete voice capture pipeline.
- Manages the ESP-IDF AFE (Audio Front End) — dual-mic processing
- Runs MultiNet custom wake word spotter
- Captures WAV audio to PSRAM during recording window
- Uploads WAV to `server_daemon.js` via HTTP POST
- Plays back the returned MP3 using the audio driver
- Calls `Spark_Emotion_ProcessIntent()` with the intent returned in response headers

---

### `Cloud/Cloud_Upload.c`
**What it does:** HTTP client for the voice API.
- Constructs the HTTP POST to `server_daemon:3001/api/voice`
- Attaches telemetry headers: `X-Device-Id`, `X-Device-Battery`, `X-Device-Volume`, `X-Device-WiFi-SSID`, `X-Device-WiFi-RSSI`, `X-Device-Boot-Count`
- Streams the MP3 response to the audio playback buffer

---

## Server Modules

### `server_daemon.js`
**What it does:** The entire backend for the device — a single-file HTTP server.
- Listens on port `3001`
- Authenticates with Supabase on startup
- Handles `POST /api/voice`: orchestrates STT → intent matching → Gemini → TTS
- Manages `ConversationManager` (multi-turn context)
- Manages `presetCache` (device personality settings)

---

### `intent_matcher.js`
**What it does:** Local intent matching engine.
- Normalizes input text (lowercase, contractions expanded, punctuation stripped)
- Computes Levenshtein similarity + token Jaccard similarity
- Applies substring boost (up to 0.15)
- Returns matched intent + response text if score ≥ 0.90
- Substitutes `{TIME}`, `{DATE}`, `{BATTERY}`, `{VOLUME}`, etc. into response templates

---

### `spark_personality.js`
**What it does:** Single source of truth for Spark's AI character.
- Exports `SPARK_BASE_IDENTITY` — the core Gemini system prompt
- Exports `PRESET_ADDENDUMS` — personality mode modifiers
- `buildSystemInstruction(preset, customPrompt, memoryContext, memorySnippet)` — assembles the full prompt

---

### `memory_system.js`
**What it does:** Persistent user memory per device.
- Stores facts, goals, projects, exams in `memories.json`
- Tracks relationship level (1–5) and XP (earned 1 per query)
- Retrieves relevant memories to inject into Gemini system prompt
- TTL-based expiry per memory category

---

### `milestone_system.js`
**What it does:** Life event detection and celebration.
- Regex-based detection of achievement events in user speech
- Generates in-character celebration responses
- Prevents duplicate celebrations (tracks milestones per device)

---

### `tts_provider.js`
**What it does:** TTS abstraction layer.
- Supports Microsoft Edge TTS and ElevenLabs
- Selected via `TTS_PROVIDER` environment variable
- Returns MP3 buffer for direct streaming to ESP32
