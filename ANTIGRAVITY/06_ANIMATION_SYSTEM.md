# 06 — ANIMATION SYSTEM

## Architecture Overview

The animation system has **two layers**:

1. **SparkCore/spark_animation.c** — A thin wrapper over LVGL's `lv_anim_t` API. Provides reusable primitives that any module can call. These are the canonical animation functions.

2. **LVGL_UI/deskimon.c** — Contains DUPLICATE private animation functions (`anim_prop`, `animate_eye_base`, `set_width_cb`, etc.) that are functionally identical to the SparkCore ones. This is technical debt.

---

## Core Animation Primitives (SparkCore)

### `Spark_Anim_Prop(obj, cb, start, end, time)`
**File**: `SparkCore/spark_animation.c:18`

The fundamental animation function. Every other animation ultimately calls this.

```c
void Spark_Anim_Prop(lv_obj_t *obj, lv_anim_exec_xcb_t cb, int32_t start, int32_t end, uint32_t time)
```

Behavior:
1. `lv_anim_del(obj, cb)` — cancels any existing animation for this object+property combination
2. If `time == 0`: directly calls `cb(obj, end)` (instant, no animation)
3. Else: creates `lv_anim_t` with `ease_in_out` path, starts it

**All properties use `lv_anim_path_ease_in_out`** — this is hardcoded and cannot be overridden per call.

### `Spark_Anim_Fade(obj, show, time)`
**File**: `SparkCore/spark_animation.c:35`

- Reads current opacity: `lv_obj_get_style_opa(obj, 0)`
- Animates to 255 (show) or 0 (hide)
- Guards: skips if already at target opacity

### `Spark_Anim_FadeAura(obj, show, time)`
**File**: `SparkCore/spark_animation.c:45`

Same as Fade but target is `LV_OPA_20` (~20%) instead of 255. Used for aura glow.

### `Spark_Anim_AnimateEyeBase(eye, w, h, angle, tx, ty, time)`
**File**: `SparkCore/spark_animation.c:55`

Fires 5 simultaneous animations on one eye container:
- Width → `w`
- Height → `h`
- Transform angle → `angle`
- Translate X → `tx`
- Translate Y → `ty`

Each reads its current value as the start point.

### `Spark_Anim_Stop(target)`
**File**: `SparkCore/spark_animation.c:105`

Cancels ALL 6 possible animation types on an object:
- Width, Height, Angle, Tx, Ty, Opacity

### `Spark_Anim_Play(anim, target, duration_ms)`
**File**: `SparkCore/spark_animation.c:64`

High-level named animations:

| Name | Behavior |
|---|---|
| `SPARK_ANIM_BLINK` | Height → h/10 → back to h (half speed each way) |
| `SPARK_ANIM_WINK` | Identical to BLINK (known bug — no differentiation) |
| `SPARK_ANIM_BOUNCE` | Translate Y → ty-15 → back to ty |
| `SPARK_ANIM_SHAKE` | Translate X → tx-10 → tx+10 → back to tx (3 steps) |
| `SPARK_ANIM_FLOAT` | Translate Y → ty+8 → back to ty |
| Others | ESP_LOGW "not procedural yet" |

---

## Duplicate Animation Functions (deskimon.c)

**File**: `LVGL_UI/deskimon.c:200-325`

These are private static functions that are **exact duplicates** of the SparkCore versions:

```c
static void set_width_cb(void * var, int32_t v)   // == Spark_Anim_SetWidthCb
static void set_height_cb(void * var, int32_t v)  // == Spark_Anim_SetHeightCb
static void set_angle_cb(void * var, int32_t v)   // == Spark_Anim_SetAngleCb
static void set_tx_cb(void * var, int32_t v)      // == Spark_Anim_SetTxCb
static void set_ty_cb(void * var, int32_t v)      // == Spark_Anim_SetTyCb
static void anim_prop(...)                         // == Spark_Anim_Prop
static void animate_eye_base(...)                  // == Spark_Anim_AnimateEyeBase
```

**Why this matters**: The two sets of callbacks are NOT the same function pointer. If `deskimon.c` calls `anim_prop(eye, set_width_cb, ...)` and then `SparkCore/spark_face.c` calls `Spark_Anim_Prop(eye, Spark_Anim_SetWidthCb, ...)`, they will NOT cancel each other's animations because `lv_anim_del(obj, cb)` matches by function pointer.

This means **both animations can run simultaneously on the same object property**, creating visual glitches.

---

## Animation Timers

### `logic_timer` (production mode)
- **Type**: LVGL timer (`lv_timer_t`)
- **Period**: 100ms
- **Callback**: `logic_timer_cb()`
- **Created in**: `Deskimon_Start()` (line 1474)
- **Purpose**: Orchestrates all per-state live animations, IMU reactions, idle timeouts

### `dev_mode_timer` (dev mode)
- **Type**: LVGL timer (`lv_timer_t`)
- **Period**: 100ms
- **Callback**: `dev_mode_timer_cb()`
- **Created in**: `Deskimon_FaceDevMode_Start()` (line 2439)
- **Purpose**: Ticks cosmic animations, auto-advances face every 4000ms

---

## Per-State Animation Updates (logic_timer_cb)

These are continuous animations that fire while in a specific state:

### EYES_CLOSED State (rapid eye shake)
```
Every 200ms: random tx ∈ [-8, 8], ty ∈ [-5, 5]
Applied to: eye_closed_l AND eye_closed_r simultaneously
Duration: 100ms (fast, jittery effect)
```

### LAUGH State (mouth breathing)
```
Every 300ms: oscillate laugh_mouth height between 55 and 75
             alternating ty between +4 and -4
Duration: 150ms per step
```

### INSECURE / INTEREST States (eye drift)
```
Every 800ms: random lateral offset ∈ [-15, 15]
Applied to: insecure_eye_container_l/r AND insec_cover_l/r
Duration: 300ms
Also moves: insecure_mouth (INSECURE) or interest_mouth_l/r (INTEREST)
```

### IGNORE State (sighing bob)
```
Every 800ms: random ty ∈ [0, 15] (upward only)
Applied to: ignore_line_l/r AND ignore_hemi_l/r
Duration: 400ms
```

### HAPPY_CRY / CRYING_MOUTH State (tear drop animation)
```
Every 800ms at t%800==0: expand tear height 40→(70-110) and ty 20→(35-55)
Every 800ms at t%800==400: collapse tear height back to 40, ty back to 20
Duration: 400ms per step
```

### NORMAL State (idle look-around)
```
When state_time >= next_look_time:
  Random: tx ∈ [-50, 50], ty ∈ [-30, 30], speed ∈ [200, 600]ms
  Applied to: eye_container_l AND eye_container_r (same values, synchronized)
  next_look_time = state_time + speed + random(0-3000) + 1000
```

### BOOT State
```
After 1000ms: transition to NORMAL
```

---

## Per-Face Transition Animations

These play once when switching to a face (in `Spark_Face_Set`):

### Standard Transitions (all faces)
1. `hide_all_masks(300)` — slide top/moon masks to y=-400 over 300ms
2. `hide_all_accessories(300)` — fade all mouths/tears/etc to opa=0 over 300ms
3. `Spark_Anim_AnimateEyeBase(containers, ...)` — resize + translate eye containers

### Face-Specific Overrides

**BLUSH / CHILL**: Fade in `mouth_arc_l` and `mouth_arc_r` (300ms / 400ms)

**BORING**: Fade in `mouth_yawn` (500ms)

**CRY**: Fade in `tear_l`, `tear_r` (300ms each)

**CRYING_MOUTH**: Fade in tears + animate to height=80, ty=40; Fade in `mouth_yawn`

**EYES_CLOSED**: Fade in `eye_closed_l`, `eye_closed_r` (300ms)

**HAPPY_CRY**: Fade in tears + animate to height=80; Fade in `mouth_triangle`

**IGNORE**: Fade in `ignore_line_l/r` + `ignore_hemi_l/r` (300ms)

**INSECURE**: Fade in `insecure_eye_container_l/r` + `insecure_mouth` + `insec_cover_l/r` (300ms)

**INTEREST**: Fade in `insecure_eye_container_l/r` + `interest_mouth_l/r` + `insec_cover_l/r` (300ms)

**OOH** (complex):
1. `lv_obj_set_size()` eye containers to 70x90 (instant)
2. `Spark_Anim_AnimateEyeBase()` → 105x130, no translate (500ms)
3. `lv_obj_set_size()` mouth_ooh to 10x5 (instant, tiny start)
4. Fade in `mouth_ooh` (300ms)
5. Animate width 10→32, height 5→32 (500ms — growing O mouth)

**WTF** (complex):
1. `lv_obj_set_size()` eye containers to 20x16 (instant)
2. `Spark_Anim_AnimateEyeBase()` → 100x16, ty=-45 (500ms — slit eyes)
3. `lv_obj_set_size()` mouth_wtf_circle to 35x35 (instant)
4. Fade in `mouth_wtf_circle` (instant)
5. Animate wtf_circle shrink to 0x0 (500ms) + fade out (500ms) — circle collapses
6. `lv_obj_set_size()` mouth_wtf to 0x0 (instant)
7. Fade in `mouth_wtf` (500ms delay — appears as circle disappears)
8. Animate mouth_wtf grow 0→40x30 (500ms — triangle appears)

**LAUGH** (complex):
1. `lv_obj_set_size()` laugh_mouth to 140x5 (instant — thin line start)
2. Fade in `laugh_mouth` (300ms)
3. Animate height 5→70 (400ms — mouth opens)

---

## Cosmic Animation System

**File**: `SparkCore/spark_cosmic.c` (88KB, ~2500 lines)

The cosmic system drives multi-phase animations for 5+ cosmic faces. Each face follows a 4-phase pattern:

```
Phase 1: Anticipation (0-500ms)    — objects appear, subtle intro
Phase 2: Action (500-2000ms)       — main animation, peak effect
Phase 3: Recovery (2000-3500ms)    — settling, secondary motions
Phase 4: Idle (3500-6000ms)        — looping ambient motion
```

`Spark_Cosmic_Tick(face, state_time_ms)` is called every 100ms and advances the phase.
`Spark_Cosmic_SetFace(face)` configures initial object positions/sizes.
`Spark_Cosmic_HideAll(fade_ms)` fades all 30+ cosmic objects to transparent.

Objects used:
- `cosmic_particle[0..7]` — small glowing circles orbit around face
- `cosmic_ring[0..7]` — expanding/pulsing bordered circles
- `cosmic_core` — central glowing point
- `cosmic_trail[0..1]` — motion blur bars
- `cosmic_arc[0..1]` — partial ring elements
- `cosmic_shadow` — full-screen darkening circle
- `cosmic_line[0..3]` — speed lines
- `cosmic_reticle` — targeting circle with pink border
