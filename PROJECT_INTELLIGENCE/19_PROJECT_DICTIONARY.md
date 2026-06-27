# 19 — PROJECT DICTIONARY

This glossary defines terms, abbreviations, enums, and constant values used in the Deskimon project.

---

## 1. Abbreviations & Terminology

* **AFE (Audio Front End)**: The Espressif DSP speech-capturing framework. It handles Acoustic Echo Cancellation (AEC), Noise Suppression (NS), and feeds processed frames to the wake word detection engine.
* **AP / SoftAP (Access Point)**: A Wi-Fi mode where the device creates its own local hotspot network. Used during initial setup to host the captive configuration portal.
* **Captive Portal**: A setup webpage served by the device in SoftAP mode. Users connect to configure local Wi-Fi credentials and API keys.
* **DAC (Digital to Analog Converter)**: The PCM5101 chip that converts digital I2S audio signals into analog outputs for the speaker.
* **Helix**: A lightweight software MP3 decoder library optimized for microcontrollers.
* **LVGL (Light and Versatile Graphics Library)**: The graphics library used to render all UI screens, eyes, mouth arcs, and animations.
* **MultiNet**: The Espressif speech library used to recognize local command phrases.
* **NVS (Non-Volatile Storage)**: A flash storage partition used to store key-value pairs (Wi-Fi credentials, volume levels, eye colors) that persist across reboots.
* **STA (Station Mode)**: A Wi-Fi mode where the device connects to an external router to access the internet.
* **WakeNet**: The Espressif speech library used for wake-word detection ("Hi Lexi").
* **WAV Header**: A 44-byte metadata block appended to the front of raw PCM recording buffers to create valid WAV files before upload.

---

## 2. Enums Reference

### `spark_state_t` (High-level Device State)
* **`SPARK_STATE_BOOT`**: The device is starting up.
* **`SPARK_STATE_IDLE`**: Ready and waiting for the wake word.
* **`SPARK_STATE_LISTENING`**: Recording user voice.
* **`SPARK_STATE_THINKING`**: Uploading audio and waiting for backend response.
* **`SPARK_STATE_SPEAKING`**: Playing the audio response.
* **`SPARK_STATE_SLEEPING`**: Low-power standby state.
* **`SPARK_STATE_CHARGING`**: Renders charging graphics.
* **`SPARK_STATE_UPDATING`**: OTA update in progress (unused stub).
* **`SPARK_STATE_ERROR`**: System failure state.

### `conv_state_t` (Conversational State)
* **`CONV_STATE_IDLE`**: Wake word detection is active.
* **`CONV_STATE_LISTENING`**: Actively saving audio to the recording buffer.
* **`CONV_STATE_FOLLOWUP_LISTENING`**: The 15-second follow-up window is active, listening for responses.
* **`CONV_STATE_PROCESSING`**: Uploading audio to the server.
* **`CONV_STATE_SPEAKING`**: Actively playing the response audio.

### `spark_face_t` / `eye_state_t` (Face Expressions)
* **`SPARK_FACE_BOOT`**: Starting state (no eyes visible).
* **`SPARK_FACE_NORMAL`**: Default idle face (neutral expression).
* **`SPARK_FACE_BORED`**: Half-closed eyelids.
* **`SPARK_FACE_HAPPY`**: Squinting happy eyes.
* **`SPARK_FACE_ANGRY`**: Top eyelid masks angled downwards.
* **`SPARK_FACE_SLEEP`**: Eyelids closed to thin slits.
* **`SPARK_FACE_BLUSH`**: Curved eyes with a dual-arc mouth.
* **`SPARK_FACE_BORING`**: Drooping eyes with a yawning mouth.
* **`SPARK_FACE_CHILL`**: Drooping eyes with a smiling mouth.
* **`SPARK_FACE_CRY`**: Eyelids squashed downwards with resting teardrops.
* **`SPARK_FACE_CRYING_MOUTH`**: Eyelids squashed downwards with moving tears and yawning mouth.
* **`SPARK_FACE_EYES_CLOSED`**: Closed eyes resembling `> <` shapes.
* **`SPARK_FACE_HAPPY_CRY`**: Happy eyes with tears and a smiling mouth.
* **`SPARK_FACE_IGNORE`**: Sidelong glance with pupils offset.
* **`SPARK_FACE_INSECURE`**: Curved cut alternate eye shape.
* **`SPARK_FACE_INTEREST`**: Alternate eyes with a smile.
* **`SPARK_FACE_OOH`**: Rounded open eyes with a circular mouth.
* **`SPARK_FACE_WTF`**: Squinting eyes with an upside-down triangle mouth.
* **`SPARK_FACE_LAUGH`**: Eyes pushed upwards with an open capsule mouth.

---

## 3. Important Constant Values

* **`SPARK_FACE_DEV_MODE`**: Compile-time flag in `main.c`. Set to `1` to run face preview iterations, and `0` for production mode.
* **`SPEECH_ENERGY_THRESHOLD`**: The audio amplitude threshold used by the VAD engine to detect speech onset and offsets.
* **`15000ms` (Follow-up Window)**: The duration the device remains in `FOLLOWUP_LISTENING` mode before returning to idle.
* **`0x1AC8DB` (Signature Cyan)**: The default cyan color hex value used to render Deskimon's eyes.
