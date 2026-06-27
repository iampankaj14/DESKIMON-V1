# 📜 CLAUDE.md — PERMANENT DEVELOPMENT RULES & WORKFLOWS

This file contains the permanent developer instructions, constraints, workflows, and rules for all AI coding assistants (including Claude Code) working on the **Deskimon** codebase.

---

## 🚫 Critical Constraints & Safety Rules

### 1. Embedded C & LVGL Constraints
* **LVGL is NOT Thread-Safe**: All LVGL widget creation, animation, or rendering calls must run **exclusively** on the FreeRTOS task running `lv_timer_handler()` (Core 1, the main thread in [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c)). Never call LVGL APIs from the hardware polling task (`spark_hw_task`), voice recording task (`MIC_Speech`), or other helper tasks.
* **No `malloc` Abuse**: Embedded memory is finite. Dynamic allocations must be bounded and checked. For large buffers (e.g., audio samples or JSON payloads), explicitly allocate in PSRAM (SPIRAM) using:
  ```c
  heap_caps_malloc(size, MALLOC_CAP_SPIRAM);
  ```
  Ensure all dynamically allocated blocks are freed in all exit branches to prevent leaks.
* **Dev Mode Guard**: The compile-time flag `#define SPARK_FACE_DEV_MODE 1` is currently active in [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c). In Dev Mode, drivers for WiFi, micro SD, PCM5101 Audio, and MIC_Speech are **NOT** initialized. Never call functions from these uninitialized systems when Dev Mode is active.
* **Cosmic & Unconfigured Faces Crash Hazard**: 
  The following face enum values defined in `spark_face.h` **have no config entries** in `SPARK_FACES[]` inside [`spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c):
  * Standard: `SPARK_FACE_WINK`, `SPARK_FACE_SKEPTICAL`, `SPARK_FACE_DIZZY`, `SPARK_FACE_LOVE`, `SPARK_FACE_CHARGING`, `SPARK_FACE_BATTERY_LOW`
  * Cosmic: `SPARK_FACE_COMET_RUSH`, `SPARK_FACE_ORBIT_MODE`, `SPARK_FACE_GALAXY_DRIFT`, `SPARK_FACE_SUPERNOVA`, `SPARK_FACE_BLACK_HOLE`, `SPARK_FACE_SPACE_EXPLORER`
  
  ⚠️ *Calling `Spark_Face_Set()` with any of the above faces reads uninitialized memory and crashes the firmware. Do not trigger them.*

### 2. Backend & Voice Constraints
* **Local Intent Matching Priority**: The local intent matcher must always run first to intercept queries. Generative fallbacks (Gemini) are handled inside [`server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js) only. Never call Gemini directly from [`intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js).
* **Personality & Response Rules**: Spark's verbal responses are constrained to preserve identity (sarcastic, deadpan, concise).
  * Max 1–2 sentences.
  * No exclamation marks or corporate AI cheerfulness.
  * Factual information first, dry wit second.

---

## 🏗️ Layered Architecture Compliance

Do not bypass the architecture layer boundaries. Maintain the strict call flow:

```
[Hardware Event / Gesture] ──► [spark_hardware callback] ──► [spark_emotion] ──► [spark_face]
[Voice Server Intent] ─────────────────────────────────────► [spark_emotion] ──► [spark_face]
```

* **Never** call low-level LVGL geometry manipulation APIs (like `lv_obj_set_width`) directly from driver modules like `MIC_Speech.c` or `main.c`. Use the [`SparkCore/spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c) abstraction.
* **Never** store mutable face states outside of `spark_face.c`.
* **Always** use typed easing wrappers in [`SparkCore/spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c) instead of casting raw style setters as animation callbacks.

---

## 🛠️ Developer Workflow

### 1. Build, Flash & Monitor Commands
All firmware operations use ESP-IDF CMake (`idf.py`). Run these commands from `/Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/`:

```bash
# Clean the build directory
idf.py clean

# Compile the firmware
idf.py build

# Flash firmware to the connected ESP32-S3
idf.py -p <PORT> flash

# Open the serial monitor (Ctrl+] to exit)
idf.py -p <PORT> monitor

# Flash and monitor in one step
idf.py -p <PORT> flash monitor
```

### 2. Webapp Testing Scripts
Run these scripts from `/Users/pankaj/Desktop/DESKIMON/webapp/` to test intent, STT, and TTS subsystems:

```bash
# Start the backend daemon (runs on port 3001)
node server_daemon.js

# Test local intent matcher algorithms
node test_intents.js

# Run the suite of all 50 intents to prevent regressions
node test_all_intents.js

# Verify Speech-to-Text APIs
node test_stt.js

# Verify Microsoft Edge Text-to-Speech generation
node test_tts.js

# Run live E2E pipeline test
node run_live_integration_test.js
```

---

## 🩺 Debugging Workflow

Follow this procedure when diagnosing errors:

1. **System Crash / Guru Meditation**:
   * Connect serial monitor (`idf.py monitor`) and decode stack traces.
   * Check for NULL pointers. Pointers retrieved from `Spark_UI_GetObj()` must be validated.
2. **Watchdog Timer resets (TG0WDT_SYS_RST / TG1WDT_SYS_RST)**:
   * A loop is blocking Core 0/1. Check that background drivers yield control periodically by calling `vTaskDelay(pdMS_TO_TICKS(ms))`.
3. **Display Issues (Black Screen / Backlight Only)**:
   * Verify screen rails are powered on via TCA9554 expander.
   * Enable `#define HARDWARE_VALIDATION_TEST 1` in `main.c` to test raw SPD2010 registers with solid primary colors (bypasses LVGL).
4. **Incorrect Eye Colors**:
   * Verify `s_eye_color_hex` is not set to `0x000000` (renders black eyes on a black screen). Default test color is `0x1AC8DB`.

---

## 📝 Documentation Workflow

Documentation must be kept in sync with the codebase after every task. Updates are **mandatory** before ending your session:

1. **Current State**: Update [03_CURRENT_STATE.md](file:///Users/pankaj/Desktop/DESKIMON/BRAIN_SPARK/03_CURRENT_STATE.md) with what was added, modified, or disabled.
2. **Feature Tracking**: Update [04_FEATURE_STATUS.md](file:///Users/pankaj/Desktop/DESKIMON/BRAIN_SPARK/04_FEATURE_STATUS.md) if a face, driver, or system status changed.
3. **Next Session Handoff**: Update [22_NEXT_SESSION.md](file:///Users/pankaj/Desktop/DESKIMON/BRAIN_SPARK/22_NEXT_SESSION.md) with remaining tasks, test steps, and current priorities.
4. **Decisions & Lessons**:
   * Log architectural decisions in [07_DECISIONS.md](file:///Users/pankaj/Desktop/DESKIMON/BRAIN_SPARK/07_DECISIONS.md).
   * Log pitfalls or mistakes in [08_LESSONS_LEARNED.md](file:///Users/pankaj/Desktop/DESKIMON/BRAIN_SPARK/08_LESSONS_LEARNED.md).
