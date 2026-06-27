# 16 — OBJECT LIFECYCLE

This document describes the creation, memory allocation, and cleanup lifecycles for all software objects in the Deskimon system.

---

## 1. LVGL Graphics Objects (`lv_obj_t`)

The lifecycle of graphics objects depends on whether the device is running in Production Mode or Developer Mode.

### Production Mode (Static Reuse)
* **Allocation**: Created **once** inside `Deskimon_Start()` during stage 6 of boot. Memory is allocated from the LVGL heap (RAM/SPIRAM).
* **Destruction**: **Never destroyed**. Pointers to the 60+ static objects are held in global scope throughout the program's execution.
* **Visibility**: Managed entirely by updating style opacity (0 = hidden, 255 = visible) and container positions.
* **Benefit**: Eliminates dynamic allocation overhead during active runtime, preventing memory fragmentation.

### Developer Mode (Dynamic Reallocation)
* **Allocation**: When a face is loaded, `create_face_elements()` allocates a new `face_root` object and populates it with only the widgets required for that face.
* **Destruction**: Triggered during face transitions by `destroy_active_face()`:
  1. Calls `lv_obj_del(face_root)`. LVGL recursively frees the parent container and all its children from the heap.
  2. Sets all static widget pointers to `NULL` to prevent dangling references.
* **Risk**: If the 100ms timer task `Spark_Cosmic_Tick()` runs after deletion but before the next creation step, it will read NULL pointers from `Spark_UI_GetObj()`, leading to crashes (**H1 Stale Pointer Risk**).

---

## 2. Face Configuration Objects (`spark_face_config_t`)
* **Allocation**: Declared statically in flash memory inside the `SPARK_FACES[]` configuration table ([`spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c)).
* **Destruction**: **Never destroyed** (persists in read-only memory).
* **Reference**: Referenced using pointers when calling `Spark_Face_GetConfig(face)`.

---

## 3. LVGL Animations (`lv_anim_t`)
* **Allocation**: Instantiated dynamically in RAM when `Spark_Anim_Prop()` (or its private duplicate `anim_prop()`) is called.
* **Lifespan**: Runs for the configured transition duration (e.g., 300ms), applying changes via property callbacks.
* **Cleanup**: Automatically freed by the LVGL engine when the animation completes.
* **Interruption**: If a new transition is requested while an animation is active, `lv_anim_del(obj, cb)` is called to cancel the active animation and free its resources.
* **Conflict**: Because the private callbacks in `deskimon.c` are different function pointers from those in `spark_animation.c`, `lv_anim_del` cannot cancel animations started by the other module, causing them to conflict (**H2 Animation Race**).

---

## 4. Timers (`lv_timer_t` & `xTimerHandle`)

### LVGL Graphics Timers (`logic_timer` & `dev_mode_timer`)
* **Allocation**: Created once on startup in `Deskimon_Start()` (production) or `Deskimon_FaceDevMode_Start()` (developer mode).
* **Destruction**: Runs continuously every 100ms and is **never deleted**.

### FreeRTOS Software Timers (`followup_timer`)
* **Allocation**: Configured once in `MIC_Speech_init()` using `xTimerCreate()`.
* **Behavior**: 
  * Started when voice playback ends (`Audio_Play_MP3_Buffer` complete), opening a 15-second follow-up window.
  * Reset when new speech is detected.
  * Stopped and reset when the 15-second window expires, returning the device to the idle state.

---

## 5. FreeRTOS Tasks

| Task Name | Creator Function | Core | Lifespan | Cleanup Mechanism |
| :--- | :--- | :--- | :--- | :--- |
| **`app_main`** | ESP-IDF Bootloader | Core 1 | Persistent | Runs the main graphics execution loop; never terminates. |
| **`Driver_Loop`** | `Driver_Init()` | Core 0 | Persistent | Polling loop; never terminates. |
| **`feed_task`** | `MIC_Speech_init()` | Core 1 | Persistent | Microphone recording loop; never terminates. |
| **`detect_task`** | `MIC_Speech_init()` | Core 1 | Persistent | Wake word detection loop; never terminates. |
| **`cloud_sync_task`** | `Cloud_Start()` | Core 1 | Persistent | Static loop sending heartbeat packets every 30s; never terminates. |
| **`voice_upload_task`**| `finish_recording_and_upload()`| Core 1 | Transient | Performs HTTP POST upload, receives response MP3, and calls `vTaskDelete(NULL)` to clean itself up. |
| **`audio_download_task`**| `parse_supabase_realtime_msg()` (Legacy)| Core 1 | Transient | Downloads the response MP3, plays it, frees its argument buffer with `free(args)`, and calls `vTaskDelete(NULL)`. |
