# 10 — SAFE EDIT GUIDE

This guide lists the files that are safe for automatic AI modifications and developers to edit, along with instructions and code patterns to prevent breaking core features.

---

## Safe Editing Inventory

The following files contain isolated, declarative, or algorithmic logic with minimal external side effects. They are safe to modify for extensions, configuration tuning, or text adjustments.

### 1. [`SPARK-V1/firmware/main/SparkCore/spark_face.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_face.c)
* **What is safe**: Modifying eye or mouth geometries in the static `SPARK_FACES[]` configuration table.
* **Rules & Precautions**:
  * You must ensure the config array indexes remain aligned with the enums in `spark_face.h`.
  * Ensure the top and bottom eyelids sentinel value (`mask_top_y`, `mask_moon_y`) is set to `-400` when they are supposed to be hidden (sliding off-screen).
  * **Code Template** for updating a face layout:
    ```c
    [SPARK_FACE_NORMAL] = {
        .name = "NORMAL",
        .left_eye = { .width = 100, .height = 165, .translate_x = -60, .translate_y = 0, .mask_top_y = -400, .mask_moon_y = -400, .is_visible = true },
        .right_eye = { .width = 100, .height = 165, .translate_x = 60, .translate_y = 0, .mask_top_y = -400, .mask_moon_y = -400, .is_visible = true },
        .mouth = { .width = 0, .height = 0, .translate_x = 0, .translate_y = 0, .is_visible = false, .shape_type = MOUTH_SHAPE_NONE },
        .tears_visible = false,
        .default_transition_ms = 300
    }
    ```

### 2. [`SPARK-V1/firmware/main/SparkCore/spark_emotion.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_emotion.c)
* **What is safe**: Adding new emotion strings or changing string mapping targets to configure how incoming server requests map to face enums.
* **Rules & Precautions**:
  * Ensure every new string mapping is also added to the duplicate lookup routine `Deskimon_SetEmotion()` in `deskimon.c` (line 1483).

### 3. [`SPARK-V1/firmware/main/SparkCore/spark_animation.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_animation.c)
* **What is safe**: Adding custom procedural easing profiles or new animation sequences (similar to `SPARK_ANIM_SHAKE` or `SPARK_ANIM_BOUNCE`).
* **Rules & Precautions**:
  * Only call standard property callbacks (`Spark_Anim_SetWidthCb`, etc.) and do not instantiate duplicate callback symbols.

### 4. [`webapp/intents.json`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intents.json)
* **What is safe**: Adding new training phrases, changing intent categories, or adding/modifying text responses.
* **Rules & Precautions**:
  * Ensure any new placeholder tag matches the list of supported device telemetry variables `{TIME}`, `{DATE}`, `{BATTERY}`, `{VOLUME}`, `{WIFI_SSID}`, `{WIFI_RSSI}`, and `{BOOT_COUNT}`.

### 5. [`webapp/intent_matcher.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/intent_matcher.js)
* **What is safe**: Refining text normalization (e.g., handling slang or contractions), editing similarity scores, or adjusting keyword boosts.
* **Rules & Precautions**:
  * Test updates using `node webapp/test_all_intents.js` to ensure the exact matching thresholds aren't broken.

### 6. [`webapp/spark_personality.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/spark_personality.js)
* **What is safe**: Editing the generative LLM prompt instruction context to alter the tone, vocabulary, or humor level of fallback responses.
* **Rules & Precautions**:
  * Ensure the prompt formatting does not alter the output structure expected by the server daemon.

---

## 🚫 AI Editing Restrictions (Never Modify Automatically)
1. **Never alter driver hardware settings** (I2C pin addresses, DMA buffer counts, I2S channels) in `LCD_Driver/`, `Touch_Driver/`, `Audio_Driver/`, or `MIC_Driver/`.
2. **Never change variables inside main.c** unless you are toggling compile-time flag switches.
3. **Never attempt to rewrite large sections of `deskimon.c`**. Due to the size of the file (~2400 lines) and the coupling of its variables, automatic edits are highly likely to break code links or introduce memory leaks.
