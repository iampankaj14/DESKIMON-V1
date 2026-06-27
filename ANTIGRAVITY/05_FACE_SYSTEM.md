# 05 — FACE SYSTEM

## Face Architecture

The face system is split across two layers:

**Layer 1: SparkCore (data + logic)**
- `spark_face.h` — defines `spark_face_t` enum (31 faces) and `spark_face_config_t` data struct
- `spark_face.c` — contains the static configuration database `SPARK_FACES[]` and the transition logic `Spark_Face_Set()`

**Layer 2: LVGL_UI (rendering)**
- `deskimon.c` — owns all LVGL objects, polls SparkCore face state, applies color, runs per-state animations

---

## Face Enum (spark_face_t)

Defined in `SparkCore/spark_face.h`:

```
SPARK_FACE_BOOT          = 0   ← Initial state (no visual)
SPARK_FACE_NORMAL             ← Default idle face
SPARK_FACE_BORED              ← Half-lidded eyes drooping down
SPARK_FACE_HAPPY              ← Moon-mask bottom (squint happy eyes)
SPARK_FACE_ANGRY              ← Same geometry as BORED but different context
SPARK_FACE_SLEEP              ← Very thin eyes (height=25)
SPARK_FACE_BLUSH              ← Happy eyes + two arc mouth
SPARK_FACE_BORING             ← Top-masked eyes + yawn mouth
SPARK_FACE_CHILL              ← Same as BORING eyes + arc mouth
SPARK_FACE_CRY                ← Squashed eyes + tears
SPARK_FACE_CRYING_MOUTH       ← Squashed eyes + tears + yawn mouth
SPARK_FACE_EYES_CLOSED        ← > < angular line eyes
SPARK_FACE_HAPPY_CRY          ← Squashed eyes + tears + triangle mouth
SPARK_FACE_IGNORE             ← Flat line eyes + half-circle pupils
SPARK_FACE_INSECURE           ← Large round alternate eyes (tilted cut)
SPARK_FACE_INTEREST           ← Same alternate eyes + arc smile mouth
SPARK_FACE_OOH                ← Wide surprised eyes + expanding circle mouth
SPARK_FACE_WTF                ← Flat narrow eyes + inverted triangle mouth
SPARK_FACE_LAUGH              ← Eyes pushed up, wide capsule mouth with teeth
SPARK_FACE_WINK               ← (defined but NOT in SPARK_FACES static config array)
SPARK_FACE_SKEPTICAL          ← (defined but mouth object exists: skeptical_mouth)
SPARK_FACE_DIZZY              ← (defined but mouth object exists: confused_mouth)
SPARK_FACE_LOVE               ← (defined but mouth object exists: kiss_mouth)

// Cosmic faces (spark_cosmic.c handles these):
SPARK_FACE_COMET_RUSH
SPARK_FACE_ORBIT_MODE
SPARK_FACE_GALAXY_DRIFT
SPARK_FACE_SUPERNOVA
SPARK_FACE_BLACK_HOLE
SPARK_FACE_SPACE_EXPLORER
SPARK_FACE_CHARGING
SPARK_FACE_BATTERY_LOW

SPARK_FACE_MAX               ← sentinel
```

**IMPORTANT**: The static `SPARK_FACES[]` config table in `spark_face.c` only defines entries up to `SPARK_FACE_LAUGH` (enum value 18). Faces `WINK`, `SKEPTICAL`, `DIZZY`, `LOVE`, and all cosmic faces have no entry in the config table. Accessing `SPARK_FACES[SPARK_FACE_WINK]` would return a zero-initialized struct.

---

## Face Configuration Struct

```c
typedef struct {
    const char *name;
    spark_eye_layout_t left_eye;     // width, height, translate_x/y, mask_top_y, mask_moon_y, is_visible
    spark_eye_layout_t right_eye;    // same
    spark_mouth_layout_t mouth;      // width, height, translate_x/y, is_visible, shape_type
    bool tears_visible;
    uint32_t default_transition_ms;
} spark_face_config_t;
```

Key values in eye layout:
- `mask_top_y = -400` → sentinel meaning "hide this mask" (slide it off-screen)
- `mask_moon_y = -400` → same sentinel
- Actual mask values are positive: `mask_top_y = -40` (drooping eyelid) or `mask_moon_y = 40` (happy squint)

---

## Eye Mask System

Each eye uses TWO internal masking objects (black rectangles as children of the eye container):
1. **Top Mask** (`mask_top`) — Rectangle that slides down from top, cutting off the top of the eye → creates the "drooping eyelid" or "angry" look
2. **Moon Mask** (`mask_moon`) — Rounded rectangle that slides up from bottom, cutting off the bottom of the eye → creates the "happy squint" look

**Normal state**: both masks at y = -400 (off-screen above the eye → invisible)
**Angry/Bored**: `mask_top_y = -40` (top of eye cut by 40px)
**Happy**: `mask_moon_y = 40` (bottom of eye cut, creating upward curve)

---

## Face Lifecycle

### Production Mode (`Deskimon_Start`)

```
Device boots
  │
  ↓
Deskimon_Start() creates ALL objects for ALL faces at once.
Everything starts at opa=0 (invisible).
  │
  ↓
logic_timer_cb() polls Spark_Face_Get() every 100ms.
If face changed → set_eyes_state() → Spark_Face_Set()
  │
  ↓
Spark_Face_Set():
  1. Hide everything
  2. Show/configure elements for new face
  3. LVGL animations play transitions
```

Objects are **never destroyed** in production mode. The same 60+ LVGL objects are reused across all face transitions. Visibility is managed entirely via opacity (0 = hidden, 255 = visible).

### Dev Mode (`Deskimon_FaceDevMode_Start`)

```
dev_mode_load_face(face)
  ├─ destroy_active_face()
  │    ├─ lv_obj_del(face_root)  ← destroys all child objects
  │    └─ NULLs all 50+ static pointers
  └─ create_face_elements(face)
       ├─ face_root = lv_obj_create(lv_scr_act())
       └─ creates ONLY objects needed for this specific face
            → no wasted memory, clean slate per face
```

Dev mode **destroys and recreates** all face objects on each face change. This is the key difference from production mode.

---

## Object Creation in Production Mode

All objects are created as children of `lv_scr_act()` (the root screen):

```
lv_scr_act()
├─ eye_container_l (LV_ALIGN_CENTER, -60, 0)
│   ├─ eye_aura_l       (110x175, opa=38%)
│   ├─ eye_l            (100%, opa=cover)
│   ├─ mask_top_l       (hidden at y=-400)
│   └─ mask_moon_l      (hidden at y=-400)
├─ eye_container_r (LV_ALIGN_CENTER, +60, 0)
│   ├─ eye_aura_r
│   ├─ eye_r
│   ├─ mask_top_r
│   └─ mask_moon_r
├─ insecure_eye_container_l (opa=0 initially)
│   ├─ insecure_eye_aura_l  (with eye_mask_event_cb type=1)
│   └─ insecure_eye_l       (with eye_mask_event_cb type=1)
├─ insecure_eye_container_r (opa=0 initially)
│   ├─ insecure_eye_aura_r  (with eye_mask_event_cb type=2)
│   └─ insecure_eye_r       (with eye_mask_event_cb type=2)
├─ insec_cover_l   (line, opa=0)
├─ insec_cover_r   (line, opa=0)
├─ mouth_arc_l     (arc, opa=0)
├─ mouth_arc_r     (arc, opa=0)
├─ interest_mouth_l (arc, opa=0)
├─ interest_mouth_r (arc, opa=0)
├─ mouth_yawn      (oval, opa=0)
├─ tear_l          (rect height=0, opa=0)
├─ tear_r          (rect height=0, opa=0)
├─ eye_closed_l    (container, opa=0)
│   └─ ec_l        (line, ">" shape)
├─ eye_closed_r    (container, opa=0)
│   └─ ec_r        (line, "<" shape)
├─ mouth_triangle  (rect + happy_mouth_mask_event_cb)
├─ ignore_hemi_l   (circle with black top-half mask child, opa=0)
├─ ignore_line_l   (line, opa=0)
├─ ignore_hemi_r
├─ ignore_line_r
├─ insecure_mouth  (circle, opa=0)
├─ mouth_ooh       (bordered circle, opa=0)
├─ mouth_wtf       (rect + wtf_mouth_mask_event_cb, opa=0)
├─ mouth_wtf_circle (circle, opa=0)
├─ laugh_mouth     (wide capsule + 4 tooth divider children, opa=0)
├─ laugh_hemi_l    (circle with top mask child, opa=0)
├─ laugh_hemi_r    (circle with top mask child, opa=0)
├─ skeptical_mouth (rounded bar, opa=0)  ← created but never shown
├─ confused_mouth  (line zigzag, opa=0)  ← created but never shown
├─ kiss_mouth      (bordered circle, opa=0) ← created but never shown
│
└─ [Cosmic objects — only if SPARK_DEVELOPER_PREVIEW_MODE=1 or SPARK_FACE_DEV_MODE=1]
    ├─ cosmic_particle[0..7]  (8 small circles)
    ├─ cosmic_ring[0..7]      (8 bordered circles)
    ├─ cosmic_core            (shadowed circle)
    ├─ cosmic_trail[0..1]     (2 rounded bars)
    ├─ cosmic_arc[0..1]       (2 bordered circles)
    ├─ cosmic_shadow          (large dark circle)
    ├─ cosmic_line[0..3]      (4 thin bars)
    └─ cosmic_reticle         (bordered circle with pink border)
```

---

## Animation Ownership

### Who owns which object's animations?

| Object | Animated by | Where |
|---|---|---|
| eye_container_l/r | `Spark_Anim_AnimateEyeBase()` | Called from `spark_face.c` + `deskimon.c` |
| mask_top_l/r | `Spark_Anim_Prop(SetTyCb)` | `spark_face.c:hide_all_masks()` and per-face switch |
| mask_moon_l/r | `Spark_Anim_Prop(SetTyCb)` | Same |
| mouth_arc_l/r | `Spark_Anim_Fade()` | `spark_face.c:hide_all_accessories()` and BLUSH/CHILL case |
| tear_l/r | `Spark_Anim_Fade() + Spark_Anim_Prop(height/ty)` | `spark_face.c` + `deskimon.c:logic_timer_cb()` |
| eye_closed_l/r | `anim_prop(set_tx/ty_cb)` | `deskimon.c:logic_timer_cb()` (EYES_CLOSED state) |
| laugh_mouth | `anim_prop(set_height_cb, set_ty_cb)` | `deskimon.c:logic_timer_cb()` (LAUGH state) |
| insecure containers | `anim_prop(set_tx_cb)` | `deskimon.c:logic_timer_cb()` (INSECURE state) |
| cosmic objects | `Spark_Anim_Prop()` | `spark_cosmic.c:Spark_Cosmic_Tick()` |

### Ownership conflicts

- `eye_container_l/r` position is controlled by BOTH `spark_face.c` (via `Spark_Anim_AnimateEyeBase`) AND `deskimon.c` (via `animate_eye_base` and `logic_timer_cb` for NORMAL idle look-around).
- This creates a **race condition risk**: if a face transition fires at the same time as the idle look-around timer, both will call `lv_anim_del(obj, cb)` on each other's animations.

---

## Face Destruction

### Production Mode
Objects are **never destroyed**. `Spark_Face_Set()` only changes visibility and position.

### Dev Mode
`destroy_active_face()` calls `lv_obj_del(face_root)` which recursively deletes all children. Then all 50+ static pointers are set to NULL.

**Risk**: If any LVGL timer or animation callback fires after `lv_obj_del(face_root)` but before the new `face_root` is created, it will access NULL or dangling pointers. The 100ms dev timer fires `Spark_Cosmic_Tick()` which accesses cosmic objects through `Spark_UI_GetObj()`. If cosmic objects are NULL (just destroyed), `Spark_Cosmic_Tick` must handle NULL gracefully.
