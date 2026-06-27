# 06 — FILE OWNERSHIP

This document details the ownership profile, editing risk levels, and compile/runtime links for all major source files in the project.

---

## Safety Classifications
* 🟢 **Safe to Modify**: Self-contained logic, localized scopes, minimal external dependencies.
* 🟡 **High Risk**: Multiple dependencies, complex calculations, or shared variables; changes require testing dependent systems.
* 🔴 **Critical**: Core architecture components, hardware initialization pipelines, or timing-critical loops; modifications are highly likely to break compilation or trigger device boot loops/crashes.

---

## Ownership Matrix

### 1. `main/main.c` (🔴 Critical)
* **Purpose**: Orchestrates hardware startup and dual-core background polling loops.
* **Edit Safety**: **CRITICAL**. Modifying driver initialization orders or stack sizes will lead to hardware crashes or watch-dog resets. Compile-time flags (`SPARK_FACE_DEV_MODE`, etc.) are safe to toggle.
* **Depends On**: `Display_SPD2010.h`, `PCF85063.h`, `QMI8658.h`, `SD_MMC.h`, `Wireless.h`, `TCA9554PWR.h`, `deskimon.h`, `BAT_Driver.h`, `PWR_Key.h`, `PCM5101.h`, `MIC_Speech.h`, `spark_state.h`
* **Used By**: ESP-IDF bootloader.

### 2. `LVGL_UI/deskimon.c` (🔴 Critical)
* **Purpose**: Owns all LVGL graphic allocations, touch events, and the primary 100ms logic timer.
* **Edit Safety**: **CRITICAL**. Extremely large file (~2400 lines) with high internal state coupling. Careless edits will result in memory corruption, stale pointers, and graphic glitches.
* **Depends On**: `deskimon.h`, `spark_face.h`, `spark_animation.h`, `spark_ui_objects.h`, `spark_cosmic.h`, `MIC_Speech.h`, `QMI8658.h`
* **Used By**: `main.c`, `Cloud.c` (via color updates).

### 3. `SparkCore/spark_face.c` (🟡 High Risk)
* **Purpose**: Hosts the static face geometry database table (`SPARK_FACES[]`) and transitions.
* **Edit Safety**: **HIGH RISK**. Modifying existing face configs requires updating the corresponding case blocks. Adding indices beyond `LAUGH` without scaling the config array will cause out-of-bound memory reads.
* **Depends On**: `spark_face.h`, `spark_animation.h`, `spark_ui_objects.h`
* **Used By**: `LVGL_UI/deskimon.c`

### 4. `SparkCore/spark_cosmic.c` (🟡 High Risk)
* **Purpose**: Executes multi-phase particle systems for space effects.
* **Edit Safety**: **HIGH RISK**. Features mathematical calculations for orbits and positions. Edits must be checked for NULL pointer references on objects during Dev Mode face resets.
* **Depends On**: `spark_cosmic.h`, `spark_ui_objects.h`
* **Used By**: `LVGL_UI/deskimon.c` (via timer callbacks).

### 5. `SparkCore/spark_animation.c` (🟢 Safe to Modify)
* **Purpose**: Wraps LVGL's basic animation objects into procedural wrappers.
* **Edit Safety**: **SAFE TO MODIFY**. Well-isolated wrapper functions. Safe to extend with new procedural curves (e.g., sine waves).
* **Depends On**: `spark_animation.h`
* **Used By**: `spark_face.c`, `spark_cosmic.c`, `LVGL_UI/deskimon.c`

### 6. `SparkCore/spark_state.c` (🟢 Safe to Modify)
* **Purpose**: Manages high-level device state changes and notifies listeners.
* **Edit Safety**: **SAFE TO MODIFY**. Basic tracking logic. Safe to register additional state enums or callback links.
* **Depends On**: `spark_state.h`
* **Used By**: `MIC_Speech.c`, `Cloud.c`, `LVGL_UI/deskimon.c`

### 7. `SparkCore/spark_emotion.c` (🟢 Safe to Modify)
* **Purpose**: Maps emotion strings to face configuration enums.
* **Edit Safety**: **SAFE TO MODIFY**. Simple lookup dictionary. Easy to safely extend with new keys. (Must be kept in sync with duplicate in `deskimon.c`).
* **Depends On**: `spark_face.h`
* **Used By**: `MIC_Speech.c`, `Cloud_Upload.c`

### 8. `MIC_Driver/MIC_Speech.c` (🔴 Critical)
* **Purpose**: Operates the dual FreeRTOS recording tasks, AFE filter engine, and wake word model.
* **Edit Safety**: **CRITICAL**. Modifying task priorities, execution intervals, or I2S buffer sizes will disrupt real-time audio feeds, leading to audio stuttering or recognition failure.
* **Depends On**: `MIC_Speech.h`, `Cloud.h`, `spark_emotion.h`, `spark_state.h`, `PCM5101.h`
* **Used By**: `main.c`, `Cloud.c`

### 9. `Cloud/Cloud.c` (🟡 High Risk)
* **Purpose**: Handles the WebSocket sync task and decodes settings changes.
* **Edit Safety**: **HIGH RISK**. Runs on a separate thread; edits to WS buffer operations or cJSON parsers can lead to heap leaks or memory corruption.
* **Depends On**: `Cloud.h`, `MIC_Speech.h`, `spark_face.h`, `spark_emotion.h`, `Provisioning.h`
* **Used By**: `Wireless.c`

### 10. `Cloud/Cloud_Upload.c` (🟡 High Risk)
* **Purpose**: Formats recording headers and performs HTTP POST uploads of voice data.
* **Edit Safety**: **HIGH RISK**. Task executes dynamically. Memory allocated in SPIRAM must be explicitly freed on all exit paths (success or error) to prevent rapid out-of-memory crashes.
* **Depends On**: `Cloud.h`, `Provisioning.h`, `spark_emotion.h`, `BAT_Driver.h`, `PCM5101.h`
* **Used By**: `MIC_Speech.c`

### 11. `Audio_Driver/PCM5101.c` (🔴 Critical)
* **Purpose**: Runs Helix MP3 software decoding and feeds audio DMA buffers.
* **Edit Safety**: **CRITICAL**. Direct hardware configuration file. Altering DMA sizes or interrupt flags will cause hardware faults or buffer underrun crackles.
* **Depends On**: `PCM5101.h`
* **Used By**: `main.c`, `Cloud_Upload.c`, `MIC_Speech.c`

### 12. `Provisioning/Provisioning.c` (🟡 High Risk)
* **Purpose**: Serves setup portals and reads/writes persistent configs in NVS.
* **Edit Safety**: **HIGH RISK**. Writing incorrect configs will corrupt NVS sectors, preventing boots. Captive portal routing must not block the main net interfaces.
* **Depends On**: `Provisioning.h`, `dns_server.h`
* **Used By**: `Wireless.c`, `Cloud.c`

### 13. `webapp/server_daemon.js` (🟡 High Risk)
* **Purpose**: Main API router and AI integration layer for voice queries.
* **Edit Safety**: **HIGH RISK**. Core backend file. Any crash in this file will take down the companion's voice functionality globally.
* **Depends On**: `intent_matcher.js`, `tts_provider.js`, `memory_system.js`
* **Used By**: ESP32 companion clients.

### 14. `webapp/intent_matcher.js` (🟢 Safe to Modify)
* **Purpose**: Checks input similarity against the 50 local intents.
* **Edit Safety**: **SAFE TO MODIFY**. Pure algorithmic matching logic. Safe to optimize, tweak similarity calculations, or add keywords.
* **Depends On**: `intents.json`
* **Used By**: `server_daemon.js`
