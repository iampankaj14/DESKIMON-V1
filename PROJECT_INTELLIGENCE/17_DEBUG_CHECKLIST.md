# 17 — DEBUG CHECKLIST

Use these checklists to diagnose and resolve common system bugs, hardware faults, and runtime crashes.

---

## 1. System Crash Troubleshooting
- [ ] Connect the device via USB and run `idf.py monitor` to capture crash logs.
- [ ] Locate the crash type and backtrace:
  * **Guru Meditation Error: StoreProhibited / LoadProhibited** ──► Indicates a NULL pointer dereference or bad memory address.
  * **Corrupt heap / Double Free** ──► Memory allocation corruption.
- [ ] Copy the backtrace addresses and check if `idf.py monitor` automatically decodes them to source file paths and line numbers.
- [ ] If the crash occurs during a Dev Mode face transition, check [`spark_cosmic.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.c):
  * Confirm that all pointers returned by `Spark_UI_GetObj()` are checked for `NULL` before being accessed.
- [ ] Insert `heap_caps_check_integrity_all(true)` at suspected locations to narrow down memory corruption bugs.

---

## 2. Boot Loop Troubleshooting
- [ ] Read the initialization logs to locate the reset reason:
  * **TG0WDT_SYS_RST / TG1WDT_SYS_RST (Watchdog Reset)** ──► A task is blocking execution on a CPU core. Ensure that loops in `feed_task` or `detect_task` yield execution by calling `vTaskDelay()`.
  * **POWERON_RESET / RTC_WDT_RST** ──► Power rails are unstable. Check the battery voltage or USB power supply.
- [ ] Check NVS partition mount logs:
  * If the mount fails, the NVS partition is likely corrupted. Erase and re-flash the partition:
    ```bash
    idf.py erase-flash
    idf.py flash
    ```
- [ ] Verify that `Driver_Init()` finishes successfully. If the device loops before `app_main` completes, verify that all I2C driver initializations are successful.

---

## 3. Rendering Bug Troubleshooting
- [ ] Toggle `#define HARDWARE_VALIDATION_TEST 1` inside [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c):
  * If the display outputs a solid red, green, or blue screen, the LCD hardware driver works. The bug is in the LVGL application layer.
  * If the screen remains black, check display power rails, control lines (reset, chip select), and backlight pins.
- [ ] Check if the eye widgets are rendered black:
  * **H3 Default Color Bug**: If `s_eye_color_hex` is initialized to `0x000000` (black) and fails to load from NVS, the eyes will be invisible on a black screen. Set a default color (e.g., `0x1AC8DB`) to test.
- [ ] Check the I2C I/O expander: verify that the LCD backlight enable pin on the TCA9554 expander is set to active.

---

## 4. Animation Bug Troubleshooting
- [ ] Check for duplicate callback conflicts (**H2 Animation Race**):
  * Check if both `spark_face.c` (using `Spark_Anim_Prop()`) and `deskimon.c` (using its private `anim_prop()`) are trying to animate the same object properties.
  * Ensure all animations on an object are stopped before starting a new one.
- [ ] Verify the animation ease curves: ensure that transitions do not run in infinite loops unless they are designated ambient loop states (e.g., yawn breathing).

---

## 5. Memory Leak Troubleshooting
- [ ] Monitor the system heap usage: print `xPortGetFreeHeapSize()` and `heap_caps_get_free_size(MALLOC_CAP_SPIRAM)` periodically.
- [ ] Audit transient buffers in [`Cloud_Upload.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Cloud/Cloud_Upload.c):
  * Confirm that WAV buffers allocated in `Cloud_UploadVoiceDirect()` are freed using `heap_caps_free()` on all exit paths.
  * Ensure that the MP3 playback buffers are freed using `heap_caps_free()` immediately after audio playback ends.
- [ ] Verify cJSON parses: ensure that every call to `cJSON_Parse()` has a corresponding `cJSON_Delete()` call.

---

## 6. Duplicate Object Troubleshooting
- [ ] Check if initialization tasks are executing multiple times:
  * Ensure `Deskimon_Start()` is only called once.
  * Check the logs to ensure there are no duplicate tasks spawned for `Driver_Loop` or `feed_task`.
- [ ] In Dev Mode, confirm that `destroy_active_face()` has finished deleting the previous face hierarchy before `create_face_elements()` allocates the new one.

---

## 7. Face Problems Troubleshooting
- [ ] Verify enum alignment: ensure the `eye_state_t` enum in `deskimon.c` matches the `spark_face_t` enum in `spark_face.h` exactly (**H4 Enum Casting coupling**).
- [ ] Verify the static configuration boundaries inside `spark_face.c`:
  * Ensure you do not request face transitions to indices above `LAUGH` (index 18) in production, as the config table `SPARK_FACES[]` does not define geometries for cosmic faces.
- [ ] Ensure that custom draw masks are initialized correctly. Insecure and wtf face masks are sensitive to layout changes.
