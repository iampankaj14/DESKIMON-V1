# 15 — KNOWN ISSUES

## Active Issues (Current Codebase)

These are bugs and design problems observed by static analysis and code review. They have not been fixed (per instructions: analyze and document only).

---

### ISSUE-001 — Cosmic face NULL-pointer risk in dev mode
**Severity**: HIGH  
**File**: `SparkCore/spark_cosmic.c`, `LVGL_UI/deskimon.c:2390`

**Description**: In dev mode, `dev_mode_timer_cb` calls `Spark_Cosmic_Tick()` every 100ms. When `destroy_active_face()` runs during a face transition, all cosmic object pointers are set to NULL (`cosmic_particle[i] = NULL`, etc.). If `Spark_Cosmic_Tick()` fires in the same LVGL timer batch after destroy but before `create_face_elements()`, it accesses NULL pointers through `Spark_UI_GetObj()`.

**Reproduction**: Auto-advance timer fires during a cosmic face → face transitions → crash (or silent miss if cosmic.c does guard checks).

**Verification needed**: Check `spark_cosmic.c` for NULL guard on every `Spark_UI_GetObj()` return value before calling any `lv_*` function.

---

### ISSUE-002 — Duplicate animation callbacks cause race condition
**Severity**: MEDIUM  
**File**: `LVGL_UI/deskimon.c:200-215`, `SparkCore/spark_animation.c:7-12`

**Description**: `deskimon.c` defines private animation callbacks (`set_width_cb`, `set_tx_cb`, etc.) that are duplicates of `Spark_Anim_SetWidthCb`, etc. in `spark_animation.c`. Because they are different function pointers, `lv_anim_del(obj, cb)` cannot cancel animations started by the other module. Both animations can run simultaneously on the same object property.

**Symptom**: Eye container flickers or snaps to wrong size when voice pipeline triggers a face change during the idle look-around animation.

---

### ISSUE-003 — `SPARK_FACES[]` config table incomplete for faces above LAUGH
**Severity**: MEDIUM  
**File**: `SparkCore/spark_face.c:13`

**Description**: The static `SPARK_FACES[]` array has entries for indices 0–18 (BOOT through LAUGH). Cosmic faces (≥ COMET_RUSH = index 19) and faces like WINK, SKEPTICAL, DIZZY, LOVE have zero-initialized entries. `Spark_Face_Set()` does not check for `face >= SPARK_FACE_COMET_RUSH` before reading the config table. If called with a cosmic face directly, it will animate eyes to size 0×0.

**The fix exists only in dev mode**: `dev_mode_load_face()` has the cosmic check. `Spark_Face_Set()` itself does not.

---

### ISSUE-004 — `eye_state_t` and `spark_face_t` coupled by integer values
**Severity**: MEDIUM  
**File**: `LVGL_UI/deskimon.c:330` (`set_eyes_state`)

**Description**: `set_eyes_state(state)` calls `Spark_Face_Set(state)` — an implicit enum cast. This works because `eye_state_t` and `spark_face_t` happen to have the same integer values for the first 18 entries. If either enum is reordered, the wrong face will be set without a compile error.

---

### ISSUE-005 — `Spark_Emotion_Set` and `Deskimon_SetEmotion` are diverged duplicates
**Severity**: LOW-MEDIUM  
**File**: `SparkCore/spark_emotion.c:12`, `LVGL_UI/deskimon.c:1483`

**Description**: Both functions parse the same emotion string → face mapping but are separate implementations. `Deskimon_SetEmotion` is called from the cloud (`parse_supabase_realtime_msg`). `Spark_Emotion_Set` is called from the voice pipeline. If a new emotion is added to one, it must be manually mirrored in the other.

---

### ISSUE-006 — srmodels partition nearly full
**Severity**: LOW (current), HIGH (on next model update)  
**File**: `firmware/partitions.csv`

**Description**: `srmodels.bin` is 2,468,364 bytes, and the partition is 2,621,440 bytes (2.5MB). Only ~150KB free. Upgrading to a newer/larger ESP-SR model may overflow the partition.

---

### ISSUE-007 — WiFi password stored plaintext in NVS
**Severity**: LOW (security concern)  
**File**: `Provisioning/Provisioning.c`

**Description**: NVS flash is not encrypted. Physical access to the device allows dumping NVS and extracting WiFi credentials and Supabase auth token.

---

### ISSUE-008 — LVGL draw masks will break on LVGL v9 migration
**Severity**: HIGH (on v9 migration, LOW currently)  
**File**: `LVGL_UI/deskimon.c:eye_mask_event_cb`, `happy_mouth_mask_event_cb`, `wtf_mouth_mask_event_cb`

**Description**: The insecure/interest/happy_cry/wtf faces use `lv_draw_mask_line_points_init()` from the LVGL v8 mask API. LVGL v9 completely removed this API and replaced it with a new layer-based approach. Any LVGL v9 migration requires rewriting these three event callbacks entirely.

---

### ISSUE-009 — Follow-up timer 15s window may feel too long
**Severity**: UX only (not a bug)  
**File**: `MIC_Driver/MIC_Speech.c`

**Description**: After a response plays, the device waits 15 seconds for a follow-up question before returning to wake-word-only mode. During this window, any loud ambient sound above `SPEECH_ENERGY_THRESHOLD` could accidentally trigger recording.

---

### ISSUE-010 — No OTA update mechanism implemented
**Severity**: MEDIUM (operational risk)  
**File**: N/A

**Description**: The partition table has `otadata` and a `factory` partition, but no OTA partition (`ota_0`/`ota_1`). The `SPARK_STATE_UPDATING` state exists in the state machine but is never used. Firmware can only be updated via USB cable.

---

### ISSUE-011 — `mouth_triangle` `lv_obj_set_style_opa` called twice
**Severity**: LOW  
**File**: `deskimon.c:1158-1159`

**Description**: Double call to `lv_obj_set_style_opa(mouth_triangle, 0, 0)`. Benign but indicates copy-paste.

---

### ISSUE-012 — `ignore_hemi_r` positioned inconsistently
**Severity**: MEDIUM (visual bug)  
**File**: `deskimon.c:1196` (production) and `deskimon.c:2058` (dev mode)

Production: `lv_obj_align(ignore_hemi_r, LV_ALIGN_CENTER, 50, -10);` ← 50px right  
Dev mode: `lv_obj_align(ignore_hemi_r, LV_ALIGN_CENTER, 50, -10);` ← same ✅

Compare with left: production is `(-110, -10)`, dev is `(-110, -10)` ✅  
These match — this is actually consistent. No visual bug. Removing from issue list.

---

### ISSUE-013 — `s_eye_color_hex` defaults to 0 (black)
**Severity**: MEDIUM  
**File**: `LVGL_UI/deskimon.c:57`

**Description**: On first boot with a fresh device, if provisioning fails to load eye color from NVS, the eye color defaults to `0x000000` (black on black display → invisible). The device appears "dead" or broken.

**Mitigation**: `Deskimon_Start()` likely reads provisioning config. Default NVS eye color should be set to `0x1AC8DB` (Deskimon's signature cyan) during provisioning initialization.

---

## Leftover Debug Files in `SparkCore/`

The `SparkCore/` directory contains several non-source files that appear to be debugging artifacts:

```
SparkCore/
├── missing_block.txt
├── spark_cosmic_all_steps.txt
├── spark_cosmic.c.extracted
├── spark_cosmic.c.extracted2
├── spark_cosmic.c.extracted3
├── spark_cosmic.c.reconstructed
├── spark_cosmic.c.recovered
├── spark_cosmic.c.step2230
└── transcript_matches.txt
```

These should be cleaned up before any production release or repository handoff.

---

## Dead Code

| Code | File | Status |
|---|---|---|
| `WINK` face case | `spark_face.c switch` | Listed in enum, no config entry, no case in face switch |
| `SKEPTICAL`, `DIZZY`, `LOVE` faces | Same | Objects created (skeptical_mouth, confused_mouth, kiss_mouth) but never shown |
| `Cloud_UploadVoiceFile(filepath)` | `Cloud_Upload.c:30` | Reads WAV from SD card — legacy path, superseded by direct + buffer paths |
| `write_wav_file()` in `MIC_Speech.c` | `MIC_Speech.c:193` | Marked `__attribute__((unused))`, was for SD write debugging |
| `BLE_Init`, `BLE_Scan` in `Wireless.c` | `Wireless.c:181` | Behind `#ifdef CONFIG_BT_ENABLED`, never called in current flow |
| `Spark_Anim_Play(ORBIT, SUPERNOVA, SHAKE, WINK, FLOAT)` | `spark_animation.c` | ORBIT, SUPERNOVA, IDLE_DRIFT log "not procedural yet" |
