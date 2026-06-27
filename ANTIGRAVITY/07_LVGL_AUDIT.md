# 07 — LVGL AUDIT

## Audit Summary

This audit was performed by static analysis of the LVGL usage in `deskimon.c`, `spark_face.c`, and `spark_animation.c`. No code was modified.

**Risk Level Legend**:
🔴 HIGH — Likely to cause crash or silent memory corruption  
🟠 MEDIUM — Will cause visual glitches or undefined behavior under specific conditions  
🟡 LOW — Code smell, redundancy, or future risk

---

## 🔴 HIGH RISK Issues

### H1 — Stale Pointer Access After `lv_obj_del` (Dev Mode)

**File**: `deskimon.c:1669` (`destroy_active_face`) and `deskimon.c:2390` (`dev_mode_timer_cb`)

**Problem**: `destroy_active_face()` calls `lv_obj_del(face_root)` which recursively deletes `face_root` and all its children. This immediately frees the LVGL internal structs.

However, `dev_mode_timer_cb` fires every 100ms and calls:
```c
Spark_Cosmic_Tick(face, s_preview_timer);
```

`Spark_Cosmic_Tick` accesses cosmic objects via `Spark_UI_GetObj()`. If a cosmic face was active when `destroy_active_face()` runs, `Spark_Cosmic_Tick` may fire in the same LVGL timer batch, between the deletion and the recreation.

Between `lv_obj_del(face_root)` and `create_face_elements()`, all cosmic pointers are NULL. If `Spark_Cosmic_Tick` is called during this window and does not NULL-check before calling LVGL functions on those pointers, it will dereference NULL → **hard fault**.

**Where to look**: `SparkCore/spark_cosmic.c` — check if every `lv_obj_*` call is guarded by `if (obj == NULL) return`.

---

### H2 — Duplicate Callback Pointer Problem (Animation Race)

**File**: `deskimon.c:200-215` and `SparkCore/spark_animation.c:7-12`

**Problem**: `deskimon.c` defines its own private animation callbacks:
```c
static void set_width_cb(void *var, int32_t v)  { lv_obj_set_width(var, v); }
```

`spark_animation.c` defines identical callbacks:
```c
void Spark_Anim_SetWidthCb(void *var, int32_t v) { lv_obj_set_width(var, v); }
```

These are different function pointers. LVGL's `lv_anim_del(obj, cb)` matches by `(obj, cb)` pair. When `deskimon.c` calls `animate_eye_base(eye, ...)` using its private `set_width_cb`, and then `spark_face.c` calls `Spark_Anim_AnimateEyeBase(eye, ...)` using `Spark_Anim_SetWidthCb`, they **cannot cancel each other's animations**.

Result: Two width animations run simultaneously on the same object. LVGL applies both in the same frame → unpredictable final width, visual flickering.

This is most likely to occur when:
1. `logic_timer_cb` runs an idle look-around animation via `animate_eye_base(eye_container, ...)`
2. Simultaneously, a voice callback triggers `Spark_Face_Set()` via `Spark_Emotion_Set()` via `Spark_Face_Set()` which calls `Spark_Anim_AnimateEyeBase(eye_container, ...)`

---

### H3 — `s_eye_color_hex` Initialized to 0 (Black)

**File**: `deskimon.c:57` (static declaration)

**Problem**: `static uint32_t s_eye_color_hex = 0` — this defaults to black (0x000000).

If `Provisioning_GetConfig()->eye_color` fails to load from NVS (e.g., first boot), `Deskimon_Start()` reads `0x000000` and sets all eye objects to black. The display background is also black. The device appears "dead" on first boot.

**Mitigation that exists**: `Deskimon_Start()` likely reads from `Provisioning_GetConfig()` and calls `Deskimon_SetEyeColor()`. But if the provisioning config default for `eye_color` is also `0x000000`, the problem persists until the user sets a color via the app.

---

## 🟠 MEDIUM RISK Issues

### M1 — Static `lv_point_t` Arrays in Event Callbacks

**File**: `deskimon.c:1034` (in `Deskimon_Start()`):
```c
static lv_point_t l_cover_pts[] = {
    {-105 + 206, -44 + 206}, 
    {-18 + 206, -13 + 206}
};
```
And similar in `create_dev_insecure_eyes()` at `deskimon.c:1889`.

**Problem**: `static` local arrays in a function that can be called multiple times (dev mode). On the second call to `create_dev_insecure_eyes()`, `lv_line_set_points()` points the new line object to the **same static array**. This is technically correct (the array lives for the program duration and the values don't change), but in dev mode when the line object is deleted and a new one created, the new object will share the same point buffer — which is fine but fragile. If anyone ever makes the points non-static, they become dangling pointers when the stack frame exits.

Additionally, `deskimon.c:1130`:
```c
static lv_point_t l_pts[] = {{0,0}, {80,50}, {0,100}};
```
Inside `Deskimon_Start()` — static here is correct (production mode, function called once). But in `create_dev_closed_eyes()` at `deskimon.c:1993`:
```c
static lv_point_t l_pts[] = {{0,0}, {80,50}, {0,100}};
```
Both functions define `static lv_point_t l_pts[]` in their local scope. These are technically two different static arrays (different compilation units/scopes) and do not conflict — **but** this relies on the C compiler giving them distinct addresses. This works correctly in practice.

---

### M2 — `ig_mask_l`, `ig_mask_r`, `lh_mask_l`, `lh_mask_r` — Anonymous Children

**File**: `deskimon.c:1171` and `deskimon.c:1291`

```c
lv_obj_t * ig_mask_l = lv_obj_create(ignore_hemi_l);
// [setup...]
// ig_mask_l is never stored in a static variable
```

**Problem**: These masking objects (`ig_mask_l`, `ig_mask_r` — black rectangles that cut off the top half of the semicircle) and the laugh mouth teeth (`tg` objects in the loop at `deskimon.c:1271`) are created as children but **no pointer is retained**. If the parent object needs to be accessed or the child needs to be hidden independently, there is no way to reach it.

This is only a medium risk because:
- In production mode, these parents are never deleted (opacity is used instead)
- In dev mode, parents are deleted via `lv_obj_del(face_root)` which recursively frees children

However, if a future requirement needed to change a child's color independently (e.g., change tooth color), there would be no handle to it.

---

### M3 — `eye_mask_event_cb` with Raw int Cast

**File**: `deskimon.c:1001`, `1028`:
```c
lv_obj_add_event_cb(insecure_eye_l, eye_mask_event_cb, LV_EVENT_ALL, (void*)1);
lv_obj_add_event_cb(insecure_eye_r, eye_mask_event_cb, LV_EVENT_ALL, (void*)2);
```

**Problem**: Casting integer literals to `void*` is technically undefined behavior in C (pointer size vs int size on 64-bit systems). On ESP32-S3 (32-bit), `sizeof(void*) == sizeof(int) == 4` so it works, but it's non-portable.

More critically: `eye_mask_event_cb` must cast this back: `int side = (int)(lv_event_get_user_data(e))`. If anything ever corrupts the user_data (e.g., LVGL internally moves event callbacks), the side identifier would be wrong, causing the mask to be drawn on the wrong side.

---

### M4 — `lv_draw_mask_line_points_init` API (LVGL v8 deprecated path)

**File**: `deskimon.c:eye_mask_event_cb` (line ~278)

The insecure/interest face uses `lv_draw_mask_*` API which is the v8 custom draw mask system. In LVGL v9, this API was completely replaced with the `lv_draw_layer` and vector drawing system.

**If migrating to LVGL v9**, the entire `eye_mask_event_cb` and `happy_mouth_mask_event_cb` and `wtf_mouth_mask_event_cb` will need to be **completely rewritten**.

---

### M5 — `lv_obj_set_size` to Instant-Change State Before Animation

**File**: `deskimon.c` — OOH and WTF face cases in `Spark_Face_Set`:
```c
lv_obj_set_size(eye_container_l, 70, 90);  // instant
Spark_Anim_AnimateEyeBase(EYE_CONTAINER_L, 105, 130, ...);  // then animate
```

**Problem**: `Spark_Anim_AnimateEyeBase` reads the CURRENT size of the container as the animation start point:
```c
int32_t current_w = lv_obj_get_width(obj);
```
If `lv_obj_set_size` just ran, `lv_obj_get_width` should return the new size — BUT LVGL may defer the layout recalculation. The start value could be the OLD size, causing the animation to start from the wrong point.

This works empirically on the current LVGL version, but is fragile.

---

## 🟡 LOW RISK Issues

### L1 — Double `lv_obj_set_style_opa` Call

**File**: `deskimon.c:1158-1159`:
```c
lv_obj_set_style_opa(mouth_triangle, 0, 0);
lv_obj_set_style_opa(mouth_triangle, 0, 0);
```
Benign duplicate. No functional impact.

---

### L2 — `preview_btn_event_cb` Defined Without `SPARK_DEVELOPER_PREVIEW_MODE` Guard

**File**: `deskimon.c:172`

The `preview_btn_event_cb` function is defined globally. If `SPARK_DEVELOPER_PREVIEW_MODE` is 0, the button that calls it is never created, so this is dead code. But it causes an unused function warning.

---

### L3 — `SPARK_FACES[]` Array Partially Initialized

**File**: `SparkCore/spark_face.c:13`

`SPARK_FACES[]` is a static array indexed by `spark_face_t`. Entries above `SPARK_FACE_LAUGH` (index 18) are **zero-initialized**. `Spark_Face_Set()` calls `Spark_Face_GetConfig(face)` which returns `&SPARK_FACES[face]`. If called with a cosmic face (>= `SPARK_FACE_COMET_RUSH`), the config struct will have all zeros: width=0, height=0, translate=0, visible=false.

`Spark_Face_Set()` will then:
- Animate eye containers to size 0x0
- Hide everything

The cosmic faces are supposed to be handled by checking `face >= SPARK_FACE_COMET_RUSH` and calling `Spark_Cosmic_SetFace()` instead — but this check only exists in `dev_mode_load_face()`, not in `Spark_Face_Set()` itself. If `Spark_Face_Set(SPARK_FACE_COMET_RUSH)` is called directly, it will corrupt the face state.

---

### L4 — `Spark_Emotion_Set` and `Deskimon_SetEmotion` Are Duplicates

**File**: `spark_emotion.c` and `deskimon.c:1483`

Both functions parse identical emotion string tables and call `Spark_Face_Set()`. Code diverged. If a new emotion is added to one, it must be manually added to the other.

---

### L5 — `mouth_ooh` Size Set to `10x5` Then Animated

**File**: `deskimon.c` (OOH face case in `Spark_Face_Set`):
```c
lv_obj_set_size(mouth_ooh, 10, 5);
Spark_Anim_Fade(Spark_UI_GetObj(SPARK_UI_MOUTH_OOH), true, 300);
// then...
Spark_Anim_Prop(Spark_UI_GetObj(SPARK_UI_MOUTH_OOH), Spark_Anim_SetWidthCb, 
    lv_obj_get_width(mouth_ooh), 32, 500);
```

This is fine as written, but uses `Spark_UI_GetObj` in one place and direct `mouth_ooh` reference in another — inconsistent access pattern.

---

## Null Pointer Summary

Objects that could be NULL and are accessed without null checks:

| Object | When NULL | Called where |
|---|---|---|
| `cosmic_particle[i]` through `cosmic_reticle` | After `destroy_active_face()` in dev mode, before `create_face_elements()` | `Spark_Cosmic_Tick()` via `Spark_UI_GetObj()` |
| All face objects | After `destroy_active_face()` | Any `logic_timer_cb` animation if it fires between destroy and create |
| `dev_label_name`, `dev_label_num` | Before `Deskimon_FaceDevMode_Start()` | `dev_mode_load_face()` checks: `if (dev_label_name)` — ✅ guarded |
| `s_record_buf` | If SPIRAM alloc fails | `feed_handler` checks `if (s_record_buf)` — ✅ guarded |
| `s_ws_rx_buf` | Before WS message received | `websocket_event_handler` checks `if (s_ws_rx_buf)` — ✅ guarded |

---

## LVGL Object Lifetime Summary

| Object | Lifetime | Owner |
|---|---|---|
| All production face objects | Created at `Deskimon_Start()`, never deleted | `deskimon.c` static variables |
| Dev mode `face_root` + children | Created per face, deleted on face change | `deskimon.c` dev mode section |
| Dev mode UI chrome (labels, btn) | Created at `Deskimon_FaceDevMode_Start()`, never deleted | `deskimon.c` dev mode section |
| LVGL timers (`logic_timer`, `dev_mode_timer`) | Created once, never paused or deleted | LVGL timer queue |
| `lv_anim_t` | Deleted automatically when complete, or via `lv_anim_del()` | LVGL animation queue |
| Anonymous children (ig_mask, tg teeth) | Lifetime of parent | Parent's LVGL children list |
