# 14 — ANIMATION SYSTEM

## Overview

The animation system (`spark_animation.c/h`) is a thin, type-safe wrapper layer over LVGL 8's built-in animation engine. Its purpose is to:
1. Provide reusable, named animation behaviors
2. Ensure all animation callbacks are properly typed (preventing the cast-corruption bugs of the old architecture)
3. Give any module a simple API to animate any LVGL object property

---

## The Core Primitive: `Spark_Anim_Prop()`

```c
void Spark_Anim_Prop(lv_obj_t *obj, lv_anim_exec_xcb_t cb,
                     int32_t start, int32_t end, uint32_t time);
```

**How it works:**
1. Cancels any existing animation on `obj` using the same callback `cb`
2. If `time == 0`: sets the value immediately (no animation)
3. Otherwise: creates an LVGL animation from `start` → `end` over `time` milliseconds, using `ease_in_out` easing

This single function is used for every animated property in the face system.

---

## Type-Safe Callback Wrappers

These are the building blocks — each wraps a single LVGL property:

```c
void Spark_Anim_SetWidthCb(void *var, int32_t v)
  → lv_obj_set_width((lv_obj_t *)var, v)

void Spark_Anim_SetHeightCb(void *var, int32_t v)
  → lv_obj_set_height((lv_obj_t *)var, v)

void Spark_Anim_SetAngleCb(void *var, int32_t v)
  → lv_obj_set_style_transform_angle((lv_obj_t *)var, v, 0)

void Spark_Anim_SetTxCb(void *var, int32_t v)
  → lv_obj_set_style_translate_x((lv_obj_t *)var, v, 0)

void Spark_Anim_SetTyCb(void *var, int32_t v)
  → lv_obj_set_style_translate_y((lv_obj_t *)var, v, 0)

void Spark_Anim_SetOpaCb(void *var, int32_t v)
  → lv_obj_set_style_opa((lv_obj_t *)var, v, 0)
```

**Why wrappers?** LVGL's `lv_anim_exec_xcb_t` expects `void cb(void *var, int32_t v)`. Direct style setters like `lv_obj_set_style_translate_y` have a different signature and cannot be cast safely. These wrappers provide the correct signature while calling through to LVGL internally.

---

## High-Level Animation Functions

### `Spark_Anim_Fade(obj, show, time)`
Fades an object in (`show=true` → opacity 255) or out (`show=false` → opacity 0).
- Cancels any existing opacity animation first
- Only animates if the current opacity differs from the target (no-op if already at target)

### `Spark_Anim_FadeAura(obj, show, time)`
Same as `Fade` but targets `LV_OPA_20` (20% opacity) instead of 255 when showing.
Used for the soft glow aura effects around eyes.

### `Spark_Anim_AnimateEyeBase(eye, w, h, angle, tx, ty, time)`
Animates all 5 properties of an eye container simultaneously:
- Width, Height, Transform Angle, Translate X, Translate Y
- Reads current values as start points for smooth transitions
- All 5 animations run in parallel over `time` milliseconds

### `Spark_Anim_Stop(target)`
Cancels all 6 animation types on the target object. Used before a hard state reset.

---

## Named Procedural Animations

`Spark_Anim_Play(anim, target, duration_ms)` dispatches named animation behaviors:

| Animation | Behavior |
|-----------|----------|
| `SPARK_ANIM_BLINK` | Squash height to 10%, restore — over `duration_ms` |
| `SPARK_ANIM_WINK` | Same as BLINK (single eye target intended) |
| `SPARK_ANIM_BOUNCE` | Translate Y: current → current-15 → current |
| `SPARK_ANIM_SHAKE` | Translate X: current → current-10 → current+10 → current |
| `SPARK_ANIM_FLOAT` | Translate Y: current → current+8 → current (slow hover) |

**Note:** ORBIT, SUPERNOVA, IDLE_DRIFT are defined in the enum but not yet implemented in `Spark_Anim_Play()`. They log a warning if triggered.

---

## Animation Patterns Used in Face Transitions

These are the real-world usages seen in `spark_face.c`:

```
Face OOH:
  Eye containers: set size to 70×90, then animate to 105×130
  MOUTH_OOH: set to 10×5, fade in, animate width+height 10→32, 5→32

Face WTF:
  Eye containers: set to 20×16, then animate to 100×16
  MOUTH_WTF_CIRCLE: set to 35×35, fade in, shrink to 0×0, fade out
  MOUTH_WTF: set to 0×0, fade in, grow to 40×30

Face LAUGH:
  LAUGH_MOUTH: set height to 5, fade in, animate height 5→70

Face CRY / HAPPY_CRY / CRYING_MOUTH:
  TEAR_L/R: fade in, then animate height 0→80 and ty 0→40
```

These patterns demonstrate a key design: **animate from a small/zero state into the final state**, creating a sense of organic "growing" or "morphing."

---

## The Easing Function

All animations use `lv_anim_path_ease_in_out`. This produces a smooth S-curve:
- Slow at the start
- Fast in the middle
- Slow at the end

This is what makes Spark's face transitions feel natural and alive rather than mechanical.

---

## Transition Durations (from `SPARK_FACES[]`)

| Face | Duration |
|------|----------|
| ANGRY | 300ms |
| BLUSH | 300ms |
| CRY | 300ms |
| NORMAL | 400ms |
| HAPPY | 400ms |
| CHILL | 400ms |
| LAUGH | 400ms |
| BORING | 500ms |
| BORED | 500ms |
| OOH | 500ms |
| WTF | 500ms |
| SLEEP | 800ms |

---

## Adding a New Animation

1. Add the animation type to `spark_anim_t` enum in `spark_animation.h`
2. Add a `case` in `Spark_Anim_Play()` in `spark_animation.c`
3. Use `Spark_Anim_Prop()` with the appropriate callback and timing values
4. Call it from `Spark_Face_Set()` or wherever the animation is triggered
