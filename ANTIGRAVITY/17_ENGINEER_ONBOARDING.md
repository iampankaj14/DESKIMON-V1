# 17 — ENGINEER ONBOARDING

## What You're Working With

**SPARK** is a production-grade AI desktop companion running on an ESP32-S3. It uses:
- **LVGL v8** for all UI rendering (no native display SDK)
- **FreeRTOS** for task management (not bare-metal, not Linux)
- **ESP-IDF v5.3.2** as the framework (not Arduino)
- **Supabase** as the backend (PostgreSQL + Realtime WebSocket + Storage)
- Custom drivers for QMI8658 IMU, PCF85063 RTC, PCM5101 DAC, SPD2010 display

This is embedded systems + firmware, not a typical web or mobile app.

---

## First-Time Setup

### Prerequisites
```bash
# Install ESP-IDF v5.3.2
# Follow: https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/get-started/

# Activate ESP-IDF environment (run this every shell session)
. ~/esp/esp-idf/export.sh  # Linux/Mac
# or
./esp-idf/export.ps1       # Windows PowerShell
```

### Clone + Build
```bash
cd DESKIMON/SPARK-V1/firmware

# First build (resolves managed components)
idf.py build

# Flash to device (connect via USB)
idf.py -p /dev/cu.usbserial-* flash

# Monitor serial output
idf.py -p /dev/cu.usbserial-* monitor
```

---

## The Two Modes

**Before building**, check `main/main.c` lines 1-10:

```c
#define SPARK_FACE_DEV_MODE 1          // ← Currently active mode
#define SPARK_DEVELOPER_PREVIEW_MODE 0
#define HARDWARE_VALIDATION_TEST 0
```

**`SPARK_FACE_DEV_MODE = 1`** (current):
- Boots straight to face preview
- NEXT button advances through all 26 faces
- Faces auto-cycle every 4 seconds
- No WiFi, no audio, no microphone — fastest iteration mode
- Use this to test and develop face animations

**`SPARK_FACE_DEV_MODE = 0`** (production):
- Full device: WiFi → provisioning → cloud → voice pipeline
- Requires device to be provisioned (captive portal first-time setup)

---

## Where Things Live

| If you want to... | Look at... |
|---|---|
| Change a face's eye shape/size | `SparkCore/spark_face.c` → `SPARK_FACES[]` array |
| Add a new face transition animation | `SparkCore/spark_face.c` → `Spark_Face_Set()` switch case |
| Add a new LVGL widget | `LVGL_UI/deskimon.c` → `Deskimon_Start()` (production) or `create_dev_*` functions (dev mode) |
| Change animation timing | `SparkCore/spark_animation.c` or `LVGL_UI/deskimon.c:logic_timer_cb` |
| Add a new emotion → face mapping | `SparkCore/spark_emotion.c:Spark_Emotion_Set()` AND `LVGL_UI/deskimon.c:Deskimon_SetEmotion()` |
| Modify voice pipeline behavior | `MIC_Driver/MIC_Speech.c` |
| Change cloud/API behavior | `Cloud/Cloud.c` and `Cloud/Cloud_Upload.c` |
| Add NVS config fields | `Provisioning/Provisioning.c` and `Provisioning/Provisioning.h` |
| Change cosmic animations | `SparkCore/spark_cosmic.c` |
| Modify boot sequence | `main/main.c` |

---

## Understanding the Face System in 5 Minutes

1. **Each face is defined by a `spark_face_config_t`** in `SPARK_FACES[]` in `spark_face.c`. Each config says: eye width, height, position, which masks are up/down.

2. **`Spark_Face_Set(face)`** is the single function that changes the displayed face. It:
   - Hides all accessory objects (mouths, tears, etc.)
   - Animates eye containers to the new shape/position
   - Applies the right masks
   - Shows the specific accessories for this face (mouth arc for BLUSH, tears for CRY, etc.)

3. **The eye shape is faked using masks**: The eyes are always filled circles. The "drooping" and "squinting" effects come from black rectangles (`mask_top`, `mask_moon`) positioned inside the eye container, cutting off parts of the circle.

4. **Logic timer runs at 100ms** and handles: idle timeouts, IMU reactions, per-state animations (tear drip, eye shake, mouth breathe), and face sync from SparkCore → UI.

5. **LVGL owns the rendering**. All visual objects are LVGL widgets. Nothing is drawn with raw pixels.

---

## Reading deskimon.c

`deskimon.c` is 2,443 lines. Here's how to navigate it:

| Lines | Content |
|---|---|
| 1–200 | Static variable declarations for all UI objects |
| 200–335 | Private animation helpers (duplicates of SparkCore!) |
| 337–707 | `logic_timer_cb` — the 100ms heartbeat |
| 708–788 | `screen_event_cb` — touch/gesture handler |
| 789–1474 | `Deskimon_Start()` — ALL production LVGL object creation |
| 1477–1511 | `Deskimon_SetEyeColor()`, `Deskimon_SetEmotion()` |
| 1513–1590 | `Spark_UI_GetObj()` — the object registry |
| 1592–2441 | `#if SPARK_FACE_DEV_MODE` — entire dev mode system |

---

## Common Tasks

### Adding a New Face

1. Add enum to `SparkCore/spark_face.h` (`SPARK_FACE_MY_FACE`)
2. Add config entry to `SPARK_FACES[]` in `spark_face.c` with eye dimensions
3. Add case in `Spark_Face_Set()` switch for any accessories
4. Add to `DEV_MODE_FACES[]` in `deskimon.c` for testing
5. Add to `get_face_dev_name()` in `deskimon.c`
6. Add to `Spark_Emotion_Set()` and `Deskimon_SetEmotion()` if it's voice-triggered
7. If it needs new LVGL objects: create them in `Deskimon_Start()` AND in a new `create_dev_*` function, register in `Spark_UI_GetObj()` and `spark_ui_objects.h`

### Adjusting an Existing Face

Edit the entry in `SPARK_FACES[]` in `spark_face.c`.  
Fields:
```c
.left_eye = {
    .width = 100,       // eye container width
    .height = 165,      // eye container height
    .translate_x = -60, // x offset from center
    .translate_y = 0,   // y offset from center
    .mask_top_y = -400, // -400 = hidden, positive = drooping
    .mask_moon_y = -400 // -400 = hidden, positive = squinting
}
```

### Adding a Touch Reaction

Edit `screen_event_cb()` in `deskimon.c` around line 708.

### Adding an IMU Reaction

Edit `logic_timer_cb()` in `deskimon.c` around the `getAccelerometer()` call.

---

## Serial Monitor Tips

The firmware logs heavily. Key log tags:

| Tag | Module | Events logged |
|---|---|---|
| `Deskimon` | deskimon.c | State changes, color updates |
| `SparkFace` | spark_face.c | Face transitions |
| `SparkEmotion` | spark_emotion.c | Emotion → face resolution |
| `SparkState` | spark_state.c | Device state transitions |
| `MIC_Speech` | MIC_Speech.c | Wake word, recording start/stop |
| `LATENCY_AUDIT` | MIC_Speech.c, Cloud_Upload.c | Voice pipeline timing |
| `CloudUpload` | Cloud_Upload.c | HTTP upload status |
| `Cloud` | Cloud.c | WebSocket events |
| `Wireless` | Wireless.c | WiFi connect/provision events |

Filter by tag in monitor:
```bash
idf.py monitor | grep "LATENCY_AUDIT"
```

---

## Gotchas

1. **Never call `Spark_Face_Set()` from an ISR** — LVGL is not ISR-safe. All face changes must happen from the main LVGL task context (inside `logic_timer_cb` or from the LVGL thread).

2. **LVGL is single-threaded** — `lv_timer_handler()` runs in `app_main`. All LVGL widget operations must happen from the same thread. Cloud.c and MIC.c are on different threads — they set flags (`s_eye_state_pending`, `s_eye_color_pending`) and `logic_timer_cb` applies them on the LVGL thread.

3. **`lv_obj_del` is immediate** — After calling `lv_obj_del(obj)`, the pointer is invalid. Any timer or animation callback that references it will crash. Check dev mode face destroy sequence carefully.

4. **SPIRAM is slower** — Operations on SPIRAM-allocated buffers are slower than internal SRAM. Don't allocate real-time audio buffers (I2S feed, AFE) in SPIRAM. Use SPIRAM only for large, less-time-sensitive buffers.

5. **`#define` flags require full rebuild** — Changing `SPARK_FACE_DEV_MODE` only triggers recompilation of `main.c`. It will NOT recompile `deskimon.c`. Always run `idf.py fullclean` after changing compile-time flags.

---

## Useful References

- ESP-IDF docs: https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/
- LVGL v8 docs: https://docs.lvgl.io/8.3/
- ESP-SR (speech): https://github.com/espressif/esp-sr
- LVGL animations: https://docs.lvgl.io/8.3/animation.html
- Supabase Realtime: https://supabase.com/docs/guides/realtime
