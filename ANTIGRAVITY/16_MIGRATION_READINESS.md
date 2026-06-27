# 16 — MIGRATION READINESS

## What "Migration" Means for SPARK

SPARK V2 / DESKIMON V2 would involve one or more of:
1. **LVGL v9 upgrade** — breaking changes in draw masks, rendering pipeline
2. **Platform expansion** — running face animations on a simulator (web/desktop) in addition to ESP32-S3
3. **Architecture refactor** — separating the monolithic `deskimon.c` into proper components
4. **New hardware** — different display controller, different MCU generation

This document assesses readiness for each.

---

## Migration Area 1: LVGL v9 Upgrade

### What breaks

| Feature | v8 API | v9 Status |
|---|---|---|
| Draw masks | `lv_draw_mask_line_points_init`, `lv_draw_mask_add` | ❌ Removed entirely |
| Color type | `lv_color_t`, `lv_color_hex()` | ⚠️ Changed internals |
| `lv_obj_set_style_*` | Stable | ✅ Still works |
| `lv_anim_t` | Stable | ✅ Still works |
| `lv_timer_t` | Stable | ✅ Still works |
| `LV_EVENT_*` | Minor additions | ✅ Mostly compatible |
| `lv_obj_create(parent)` | Stable | ✅ Still works |

**Affected files**:
- `deskimon.c` — `eye_mask_event_cb`, `happy_mouth_mask_event_cb`, `wtf_mouth_mask_event_cb`
- These 3 callbacks handle the diagonal mask cuts on the insecure/interest eyes, the triangle mouth mask, and the WTF inverted mouth mask.

**Effort**: Medium. The 3 masks need to be reimplemented using v9's layer/vector approach. The visual result (diagonal line cuts on circles) is achievable in v9 using `lv_draw_vector` or clip regions.

### What is already portable

- All `lv_anim_*` usage
- All `lv_obj_set_style_*` calls  
- All `lv_timer_*` usage
- All `lv_obj_set_size`, `lv_obj_align`, `lv_obj_set_style_opa`
- LVGL event system

---

## Migration Area 2: Platform Expansion (Simulator)

### Current coupling to ESP hardware

| Code | ESP-Specific Dependency |
|---|---|
| `heap_caps_malloc(SPIRAM)` | ESP-IDF SPIRAM API |
| `xTaskCreatePinnedToCore` | FreeRTOS on ESP |
| `i2s_*` APIs | ESP-IDF I2S |
| `esp_afe_sr_*` | ESP-SR library |
| `esp_http_client_*` | ESP-IDF HTTP |
| `esp_websocket_client_*` | ESP-IDF WebSocket |
| `nvs_*` | ESP-IDF NVS |
| `QMI8658`, `PCF85063`, `PCM5101` | Hardware-specific drivers |

### SparkCore portability

`SparkCore/spark_face.c`, `spark_animation.c`, `spark_emotion.c`, `spark_state.c` have **zero** ESP-specific dependencies. They only depend on:
- `LVGL` (cross-platform)
- `<string.h>`, `<stdio.h>`, `<stdbool.h>` (standard C)
- `esp_log.h` — this is the only ESP dependency (logging)

**The SparkCore layer is already 95% portable.** Replacing `esp_log.h` with a platform-agnostic logging macro would make it fully portable.

### Minimum viable simulator portability

To run `deskimon.c` on a desktop/web simulator:
1. Replace `esp_log.h` with `stdio.h` printf shims
2. Replace `heap_caps_malloc(size, SPIRAM)` with `malloc(size)`
3. Replace `QMI8658.h` (IMU) with mock returning `Accel = {0,0,1}` (stationary)
4. Replace `MIC_Speech.h` with no-op stubs
5. Provide LVGL with an SDL2 or web (Emscripten) display backend

The face rendering code in `deskimon.c` is pure LVGL and would render identically on any platform.

---

## Migration Area 3: Architecture Refactor

### Current monolith problem

`deskimon.c` (2,443 lines, 107KB) does:
- Object creation for ALL faces (could be split into `faces/normal.c`, `faces/cosmic.c`, etc.)
- Event handling (could be `deskimon_events.c`)
- Color management (could be `deskimon_color.c`)
- Animation update loop (could be `deskimon_anim.c`)
- Dev mode (could be `deskimon_dev.c` — already `#if SPARK_FACE_DEV_MODE`)

### Refactor path

Phase 1 (Low Risk):
- Extract dev mode to `deskimon_dev.c` — the `#if SPARK_FACE_DEV_MODE` blocks already provide a clean separation point
- Extract `Spark_UI_GetObj()` and the object pointer declarations to `spark_ui_objects.c` (they are logically SparkCore, not LVGL_UI)

Phase 2 (Medium Risk):
- Merge `Spark_Anim_SetWidthCb` and `set_width_cb` etc. — eliminate duplicates
- Move color application logic out of `logic_timer_cb` into a dedicated `deskimon_color_apply()` function

Phase 3 (High Risk):
- Split `Deskimon_Start()` object creation into per-face factory functions called on demand — matching the dev mode approach

---

## Migration Area 4: New Hardware

### Display controller change

The display driver (`LCD_Driver/Display_SPD2010.c`) is a hardware-specific component behind the `LCD_Init()` abstraction. Replacing the display would require only rewriting `LCD_Driver/` — no changes to LVGL or SparkCore.

LVGL's flush callback in `LVGL_Driver/` would also need updating to match the new display's DMA/pixel format.

### MCU change (e.g., ESP32-S3 → RP2350 or STM32)

**Blockers**:
- All `esp_*` APIs throughout `MIC_Speech.c`, `Cloud.c`, `Wireless.c`
- ESP-SR library is ESP32-specific
- FreeRTOS is portable but task creation APIs differ
- I2S hardware API is different on every platform

**Not blockers** (already portable):
- LVGL rendering
- SparkCore state/face/animation logic
- cJSON (standard C)

---

## Readiness Scorecard

| Migration | Effort | Risk | Current Blockers |
|---|---|---|---|
| LVGL v9 upgrade | Medium | Medium | 3 draw mask callbacks |
| Desktop simulator | Low | Low | `esp_log.h` + `heap_caps_malloc` shims |
| Architecture refactor | Medium | Medium | Enum coupling, duplicate callbacks |
| New display hardware | Low | Low | Just `LCD_Driver/` rewrite |
| New MCU/Platform | High | High | All ESP-IDF APIs throughout |

---

## Pre-Migration Checklist

Before starting any migration work, the following should be verified/fixed:

- [ ] **ISSUE-001**: Verify `spark_cosmic.c` guards all `Spark_UI_GetObj()` returns with NULL checks
- [ ] **ISSUE-002**: Merge duplicate animation callbacks (pick one canonical set)
- [ ] **ISSUE-003**: Add cosmic face guard to `Spark_Face_Set()` before config table lookup
- [ ] **ISSUE-004**: Add explicit mapping table from `eye_state_t` to `spark_face_t` instead of implicit cast
- [ ] **ISSUE-006**: Resize srmodels partition if planning to update ESP-SR models
- [ ] Clean up debug artifact files in `SparkCore/`
- [ ] Ensure `SPARK_FACE_DEV_MODE=0` builds and runs correctly before any refactor
