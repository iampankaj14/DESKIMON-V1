# 18 — KNOWN RISKS

This document serves as the project's risk log, detailing architectural issues, race conditions, memory concerns, and migration limitations.

---

## 1. NULL Pointer Dereferences in Dev Mode (H1 Risk)
* **Location**: [`SparkCore/spark_cosmic.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.c) and [`deskimon.c:2390`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c#L2390) (`dev_mode_timer_cb`).
* **Description**: In Dev Mode, `destroy_active_face()` deletes the active widget tree and sets static pointers to `NULL`. The 100ms timer runs `Spark_Cosmic_Tick()`, which calls `Spark_UI_GetObj()` to fetch pointers. If the timer fires after deletion but before the new widgets are created, `Spark_Cosmic_Tick` receives `NULL` pointers. If it attempts to run LVGL operations on them without checking for `NULL`, it will crash.
* **Severity**: 🔴 HIGH (will cause device hard faults during transitions).

---

## 2. Duplicate Animation Callbacks & Races (H2 Risk)
* **Location**: [`deskimon.c:200-215`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c#L200-L215) and [`spark_animation.c:7-12`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c#L7-L12).
* **Description**: `deskimon.c` defines its own private animation callbacks (`set_width_cb`, etc.) which are duplicates of the callbacks in `spark_animation.c`. Because they are compiled into different files, they have different function pointers. LVGL's `lv_anim_del(obj, cb)` relies on matching function pointers. If `deskimon.c` starts an animation (e.g., look-around) and then the voice pipeline calls a transition animation, they cannot cancel each other.
* **Symptom**: Both animations run simultaneously on the same object properties, causing visual flickering or eye sizes to snap incorrectly.
* **Severity**: 🟠 MEDIUM (causes graphic glitches).

---

## 3. Configuration Table Boundary Overflow (M1 Risk)
* **Location**: [`spark_face.c:13`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c#L13) (`SPARK_FACES[]`).
* **Description**: The static array `SPARK_FACES[]` only defines entries up to index 18 (`LAUGH`). Cosmic faces and other expressions (wink, love, dizzy) do not have config entries. `Spark_Face_Set()` reads `&SPARK_FACES[face]` directly without checking bounds. Accessing indices above 18 will return zero-initialized values.
* **Symptom**: Tying to set a cosmic face directly in production will set the eye size to 0x0 and hide the eyes.
* **Severity**: 🟠 MEDIUM (corrupts face layouts).

---

## 4. Enum Casting Coupling (M2 Risk)
* **Location**: [`deskimon.c:330`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c#L330) (`set_eyes_state()`).
* **Description**: `set_eyes_state(state)` casts and passes `eye_state_t` values to `Spark_Face_Set(face)`. This relies on both enums having identical integer structures. If either enum is modified or reordered, the wrong face configurations will load.
* **Severity**: 🟠 MEDIUM (fragile code dependency).

---

## 5. Diverged Mapping Duplication (L1 Risk)
* **Location**: [`spark_emotion.c:12`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_emotion.c#L12) and [`deskimon.c:1483`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c#L1483).
* **Description**: Both files contain identical string-to-face lookup functions (`Spark_Emotion_Set` and `Deskimon_SetEmotion`). If you add a new expression or edit a mapping key, you must manually update both files.
* **Severity**: 🟡 LOW (maintenance overhead).

---

## 6. Deprecated LVGL v8 API (L2 Risk)
* **Location**: [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) (custom draw mask callbacks).
* **Description**: The custom draw masks used for clipping (insecure, wtf, and happy cry mouths) rely on the LVGL v8 `lv_draw_mask_*` API. This API was completely removed in LVGL v9.
* **Impact**: Upgrading the graphics library to LVGL v9 will require rewriting these callbacks using LVGL v9 layers.
* **Severity**: 🟡 LOW (blocks easy library upgrades).

---

## 7. Speech Models Partition Allocation (L3 Risk)
* **Location**: [`partitions.csv`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/partitions.csv).
* **Description**: The `srmodels` partition is 2.5MB. The compiled `srmodels.bin` file size is ~2.4MB, leaving only ~150KB of free space. Upgrading to a newer or larger model will exceed the partition boundaries, requiring a partition resize.
* **Severity**: 🟡 LOW (blocks easy model upgrades).

---

## 8. NVS Plaintext Security (L4 Risk)
* **Location**: [`Provisioning.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Provisioning/Provisioning.c).
* **Description**: Config data (SSIDs, Wi-Fi passwords, Supabase authorization keys) is stored in the NVS partition as plaintext. Flash encryption is not enabled. Anyone with physical access to the device can dump the NVS partition and extract Wi-Fi and Supabase credentials.
* **Severity**: 🟡 LOW (security vulnerability).
