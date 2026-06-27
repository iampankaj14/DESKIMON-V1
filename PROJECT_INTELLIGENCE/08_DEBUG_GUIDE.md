# 08 — DEBUG GUIDE

This guide provides troubleshooting starting points, relevant files, log tags, and diagnostic steps for every subsystem in the Deskimon project.

---

## 1. Subsystem: Power & Battery Monitor
* **Symptoms**: Device fails to boot, random resets, battery percentage reported as 0% or stays at 100%, battery voltage readings are static.
* **Where to Start**:
  * [`BAT_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/BAT_Driver/BAT_Driver.c) — Inspect ADC calibration and pin mapping.
  * [`PWR_Key.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/PWR_Key/PWR_Key.c) — Debug power button interrupts.
  * [`Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c) — See `Cloud_ReportDiagnostics()` to verify battery calculation formulas.
* **Log Tag to Filter**: `BAT_Driver`, `PWR_Key`, `Cloud`
* **Diagnostic Steps**:
  1. Measure physical battery voltage using a multimeter across cells.
  2. Confirm NVS partition read checks by debugging `BAT_Init()` configuration returns.
  3. Monitor diagnostic reports: `idf.py monitor | grep -E "(voltage|battery)"`.

---

## 2. Subsystem: Display & Backlight
* **Symptoms**: Screen is completely black, displays static noise, colors are inverted, or backlight level is low/unresponsive.
* **Where to Start**:
  * [`Display_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LCD_Driver/Display_SPD2010.c) — Verify panel initialization sequence.
  * [`LVGL_Driver.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_Driver/LVGL_Driver.c) — Check display flush callback registrations.
* **Log Tag to Filter**: `Display_SPD2010`, `LVGL_Driver`
* **Diagnostic Steps**:
  1. Enable `#define HARDWARE_VALIDATION_TEST 1` in `main.c` to bypass graphics rendering and output solid primary colors to rule out driver issues.
  2. Verify that I2C lines to EXIO TCA9554 are active, as the display power rails are enabled via expander GPIOs.

---

## 3. Subsystem: Capacitive Touch & Gestures
* **Symptoms**: Swipes do not trigger face changes (Blush, WTF, Ooh), taps are ignored, or long presses fail to activate manual recording.
* **Where to Start**:
  * [`Touch_SPD2010.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Touch_Driver/Touch_SPD2010.c) — Inspect touch coordinate retrieval.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See `screen_event_cb()` (line 708) for gesture vector math.
* **Log Tag to Filter**: `Touch_SPD2010`, `Deskimon`
* **Diagnostic Steps**:
  1. Add print logs inside `screen_event_cb()` to log the exact `lv_event_code_t` received.
  2. Log touch coordinates in `Touch_Read()` to check if the touch controller is registering coordinates.

---

## 4. Subsystem: IMU Motion Reactions
* **Symptoms**: Device does not cry when tilted, shakes do not trigger angry faces, or idle timeout sleep is not disrupted by picking it up.
* **Where to Start**:
  * [`QMI8658.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/QMI8658/QMI8658.c) — Confirm accelerometer configuration parameters.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — Check motion thresholds inside `logic_timer_cb()`.
* **Log Tag to Filter**: `QMI8658`, `Deskimon`
* **Diagnostic Steps**:
  1. Verify I2C bus status: confirm the IMU responds during `QMI8658_Init()`.
  2. Monitor raw accelerometer telemetry: `idf.py monitor` outputs `Accel.x`, `Accel.y`, and `Accel.z` values. Validate that `Accel.y > 0.6g` when tilted upwards.

---

## 5. Subsystem: Face Transitions & Rendering
* **Symptoms**: Eyes are missing, mouth is misplaced, animations flicker, or transitions crash in Dev Mode.
* **Where to Start**:
  * [`spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c) — Check the `SPARK_FACES[]` configuration settings.
  * [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) — See `logic_timer_cb()` for sync checks and `set_eyes_state()`.
  * [`spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c) — Inspect animation callbacks.
* **Log Tag to Filter**: `SparkFace`, `Deskimon`, `LVGL`
* **Diagnostic Steps**:
  1. Check for **H2 Duplicate Animation Callbacks** race conditions by monitoring if both `spark_face.c` and `deskimon.c` are attempting to animate the eye container width/height at the same time.
  2. In Dev Mode, if transitions trigger crash loops, check if `Spark_Cosmic_Tick()` is running during the transition window when static handles inside `destroy_active_face()` are set to `NULL` (**H1 Stale Pointer Risk**).

---

## 6. Subsystem: Voice Capture & Wake Word
* **Symptoms**: Wake word ("Hi Lexi") is not recognized, recording does not start, audio cuts off early, or voice recordings are full of static.
* **Where to Start**:
  * [`MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c) — Check `feed_handler()` and `detect_handler()` loops.
  * [`PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c) — Check I2S Master bus configurations.
* **Log Tag to Filter**: `MIC_Speech`, `esp-sr`
* **Diagnostic Steps**:
  1. Verify the `srmodels` partition is successfully flashed and matches the offset `0x310000` inside `partitions.csv`.
  2. Monitor VAD signals: log when VAD transitions to speech status. If VAD thresholds are too sensitive, adjust `SPEECH_ENERGY_THRESHOLD`.
  3. Uncomment `write_wav_file()` (if debugging via SD card) to listen to the captured voice file.

---

## 7. Subsystem: Audio Output (Playback)
* **Symptoms**: Audio is crackling, playback speed is incorrect (sounds high/low pitched), or no sound is emitted.
* **Where to Start**:
  * [`PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c) — Check Helix decoding loop and I2S configuration.
  * [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c) — Confirm MP3 buffer downloads are complete before calling playback.
* **Log Tag to Filter**: `PCM5101`, `CloudUpload`
* **Diagnostic Steps**:
  1. Ensure the amplifier mute line (controlled via I2C EXIO TCA9554) is set to enable playback.
  2. Verify that Helix decoder buffer allocations do not fail due to memory limits.
  3. Check the DAC power rails and I2S clock lines with an oscilloscope.

---

## 8. Subsystem: Cloud WebSocket Sync
* **Symptoms**: Settings changes from the web dashboard (e.g., eye color updates) do not affect the device, WebSocket repeatedly disconnects.
* **Where to Start**:
  * [`Cloud.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud.c) — Inspect `websocket_event_handler()` and JSON parser hooks.
  * [`Provisioning.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/Provisioning.c) — Check database keys and auth credentials.
* **Log Tag to Filter**: `Cloud`, `WEBSOCKET_CLIENT`
* **Diagnostic Steps**:
  1. Monitor logs for WebSocket events: verify that `WEBSOCKET_EVENT_CONNECTED` is logged.
  2. Confirm cJSON parsing: log incoming WebSocket messages to ensure they are valid JSON arrays containing UPDATE events from Supabase Realtime.

---

## 9. Subsystem: Voice Upload & Intent Engine (Backend)
* **Symptoms**: Voice responses are slow (>5 seconds), queries return errors, intent matches are wrong, or generative responses fail.
* **Where to Start**:
  * [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c) — Verify WAV generation on the device.
  * [`server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js) — Check server HTTP routing.
  * [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js) — Inspect matching weights.
* **Log Tag to Filter**: `CloudUpload`, `LATENCY_AUDIT` (Device), Server Console Logs (Backend)
* **Diagnostic Steps**:
  1. Monitor `LATENCY_AUDIT` on the device console to measure `HTTP Upload End` and `First Byte Received` times.
  2. Test backend routes locally using the test scripts: `node webapp/test_all_intents.js` or `node webapp/stress_test.js`.
  3. Inspect `memories.json` on the server to verify session contexts are maintained.
