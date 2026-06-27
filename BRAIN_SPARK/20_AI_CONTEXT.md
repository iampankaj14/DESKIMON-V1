# 20 — AI CONTEXT

Everything a new AI assistant must know before writing any code for SPARK.

---

## What This Project Is

SPARK (Deskimon) is an **ESP32-S3 embedded firmware + Node.js backend** for a physical desk companion device with a round display. It has a voice pipeline, an animated face, and a character named Spark.

It is not a web app. It is not a mobile app. It is an embedded systems project with a companion server.

---

## The Two Codebases

### 1. Firmware (`SPARK-V1/firmware/`)
- **Language:** C (ESP-IDF framework, FreeRTOS)
- **Build system:** CMake (`idf.py build`)
- **Target:** ESP32-S3 microcontroller
- **Key constraint:** Runs on bare metal — no malloc abuse, no unbounded allocations, no blocking calls on the main LVGL thread

### 2. Server + Web App (`webapp/`)
- **Language:** Node.js (CommonJS) + Next.js
- **Runtime:** Node.js 18+
- **Key files:** `server_daemon.js`, `intent_matcher.js`, `spark_personality.js`, `memory_system.js`
- **Start:** `node server_daemon.js` for the voice backend

---

## Critical Architecture Rules

### Firmware
1. **Face configs live in Flash.** `SPARK_FACES[]` is `static const` — never put mutable state in it.
2. **All LVGL access through `Spark_UI_GetObj()`.** Never hold raw `lv_obj_t*` pointers across module boundaries.
3. **Never cast LVGL style setters as animation callbacks.** Always use the typed wrappers in `spark_animation.c`.
4. **`Spark_Face_Set()` is the ONLY entry point for face changes.** Nothing else should directly manipulate eye objects.
5. **`Spark_Emotion_Set()` → `Spark_Face_Set()`.** Never bypass the emotion layer from voice code.
6. **No blocking calls inside LVGL timer callbacks.** `lv_timer_handler()` runs on the main thread — blocking it freezes the display.
7. **`SPARK_FACE_DEV_MODE 1` is currently active** — the full voice/network/audio pipeline is NOT initialized in the current build.

### Server
1. **`spark_personality.js` is the single source of truth for Spark's character.** Never hardcode personality instructions anywhere else.
2. **Local intent matching happens BEFORE Gemini.** Never skip the matcher and go straight to Gemini.
3. **Intent responses use `{PLACEHOLDER}` syntax** — the matcher substitutes them. Don't change this convention.
4. **`memories.json` is the persistent store.** It's a file, not a database. Write it carefully.
5. **Supabase is NOT in the voice pipeline.** Never add Supabase calls to the critical path of `/api/voice`.

---

## Current Dangerous States to Know

1. **Cosmic faces will crash the firmware** — `SPARK_FACE_COMET_RUSH` and 7 others are defined in the enum but have NO config in `SPARK_FACES[]`. Calling `Spark_Face_Set()` with these values accesses uninitialized array memory.

2. **Dev mode is ON** — `#define SPARK_FACE_DEV_MODE 1` in `main.c`. The production boot path (Wi-Fi, audio, mic) is NOT running. Do not assume the network stack is initialized.

3. **`spark_intent.c` is a stub** — The Intent Manager is mostly a thin wrapper. The real wake word detection lives in `MIC_Speech.c` and is not properly abstracted yet.

4. **Some face enum values have no config entries** — WINK, SKEPTICAL, DIZZY, LOVE are also unconfigured beyond the cosmic faces.

---

## File Map: Where to Find Things

| What you need | Where it lives |
|--------------|---------------|
| All face configurations | `firmware/main/SparkCore/spark_face.c` — `SPARK_FACES[]` array |
| Face enum values | `firmware/main/SparkCore/spark_face.h` |
| All LVGL UI objects | `firmware/main/SparkCore/spark_ui_objects.h` |
| Animation wrappers | `firmware/main/SparkCore/spark_animation.c/h` |
| State machine | `firmware/main/SparkCore/spark_state.c/h` |
| Hardware events | `firmware/main/SparkCore/spark_hardware.c/h` |
| Emotion→face mapping | `firmware/main/SparkCore/spark_emotion.c` |
| Boot entry point | `firmware/main/main.c` |
| Voice pipeline (server) | `webapp/server_daemon.js` |
| Intent database | `webapp/intents.json` |
| Intent matcher algorithm | `webapp/intent_matcher.js` |
| Spark's AI personality | `webapp/spark_personality.js` |
| User memory + XP | `webapp/memory_system.js` |
| Life event detection | `webapp/milestone_system.js` |
| TTS abstraction | `webapp/tts_provider.js` |
| STT providers | `webapp/providers/groq_provider.js`, `webapp/providers/gemini_provider.js` |

---

## ESP-IDF Specifics to Know

- **Logging:** Use `ESP_LOGI(TAG, "message")`, `ESP_LOGW()`, `ESP_LOGE()` — never `printf()`
- **Task creation:** `xTaskCreatePinnedToCore()` — always specify core affinity
- **Delays:** `vTaskDelay(pdMS_TO_TICKS(ms))` — never `sleep()` or `usleep()`
- **Heap allocation in PSRAM:** `heap_caps_malloc(size, MALLOC_CAP_SPIRAM)` for large buffers
- **Flash constant arrays:** `static const` — compiler places in `.rodata`
- **LVGL thread safety:** All LVGL calls must happen on the task running `lv_timer_handler()` (Core 1 main thread)

---

## Performance Constraints

| Metric | Target |
|--------|--------|
| Total voice latency (local intent) | < 1.5 seconds |
| Total voice latency (Gemini fallback) | < 2.5 seconds |
| Face transition animation | 300–800ms |
| LVGL frame rate | 60 FPS |
| IMU polling interval | 100ms |
| Server `ConversationManager` TTL | 60 seconds |

---

## Testing Commands

```bash
# Test intent matching
cd webapp
node test_intents.js

# Test all 50 intents
node test_all_intents.js

# Test STT pipeline
node test_stt.js

# Test TTS
node test_tts.js

# Test memory system
node test_memory.js

# Run live integration test (requires server running)
node run_live_integration_test.js

# Start server
node server_daemon.js
```
