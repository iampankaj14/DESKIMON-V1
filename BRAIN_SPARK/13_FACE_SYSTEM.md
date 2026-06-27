# 13 — FACE SYSTEM

## Overview

Spark's face is rendered entirely using procedural LVGL geometry — no images, no bitmaps. Every expression is defined as a data structure that describes the size, position, and mask configuration of the eye and mouth objects.

---

## Face Enum (`spark_face_t`)

Defined in `spark_face.h`. There are 31 values in the enum, but only 22 have actual configurations:

### Active faces (have entries in `SPARK_FACES[]`):
```
SPARK_FACE_BOOT          → Initial sentinel — no rendering
SPARK_FACE_NORMAL        → Resting state
SPARK_FACE_BORED         → Heavy eyelids, eyes shifted down
SPARK_FACE_HAPPY         → Moon mask (squinting upward curve)
SPARK_FACE_ANGRY         → Heavy angled lids (same as bored)
SPARK_FACE_SLEEP         → Very thin horizontal eyes
SPARK_FACE_BLUSH         → Happy eyes + arc corners of mouth
SPARK_FACE_BORING        → Half-lid eyes + yawn mouth
SPARK_FACE_CHILL         → Half-lid eyes + arc mouth
SPARK_FACE_CRY           → Thin eyes + falling tears
SPARK_FACE_CRYING_MOUTH  → Thin eyes + tears + open yawn mouth
SPARK_FACE_EYES_CLOSED   → Base eyes hidden, flat closed lines shown
SPARK_FACE_HAPPY_CRY     → Thin eyes + tears + triangle mouth
SPARK_FACE_IGNORE        → Base eyes hidden, flat lines + semicircles
SPARK_FACE_INSECURE      → Alternative small eyes + small circle mouth
SPARK_FACE_INTEREST      → Alternative small eyes + arc interest mouth
SPARK_FACE_OOH           → Wide eyes + expanding circle mouth
SPARK_FACE_WTF           → Flat wide eyes + expanding triangle mouth
SPARK_FACE_LAUGH         → Eyes pushed high + wide capsule mouth
```

### Defined but NOT configured (⚠️ crash if triggered):
```
SPARK_FACE_WINK          → No config entry
SPARK_FACE_SKEPTICAL     → No config entry
SPARK_FACE_DIZZY         → No config entry
SPARK_FACE_LOVE          → No config entry
SPARK_FACE_COMET_RUSH    → Cosmic — spark_cosmic.c (not integrated)
SPARK_FACE_ORBIT_MODE    → Cosmic — not integrated
SPARK_FACE_GALAXY_DRIFT  → Cosmic — not integrated
SPARK_FACE_SUPERNOVA     → Cosmic — not integrated
SPARK_FACE_BLACK_HOLE    → Cosmic — not integrated
SPARK_FACE_SPACE_EXPLORER→ Cosmic — not integrated
SPARK_FACE_CHARGING      → Not configured
SPARK_FACE_BATTERY_LOW   → Not configured
```

---

## Face Configuration Structure

Each face is described by a `spark_face_config_t`:

```c
typedef struct {
    const char *name;            // Display name (e.g., "HAPPY")
    spark_eye_layout_t left_eye;
    spark_eye_layout_t right_eye;
    spark_mouth_layout_t mouth;
    bool tears_visible;
    uint32_t default_transition_ms;  // Animation duration for this face
} spark_face_config_t;
```

**Eye layout** (`spark_eye_layout_t`):
```c
typedef struct {
    uint16_t width;       // Oval width in pixels
    uint16_t height;      // Oval height in pixels
    int16_t translate_x;  // Horizontal offset
    int16_t translate_y;  // Vertical offset
    int16_t mask_top_y;   // Top eyelid mask Y position (-400 = hidden)
    int16_t mask_moon_y;  // Bottom moon mask Y position (-400 = hidden)
    bool is_visible;
} spark_eye_layout_t;
```

**Mouth layout** (`spark_mouth_layout_t`):
```c
typedef struct {
    uint16_t width;
    uint16_t height;
    int16_t translate_x;
    int16_t translate_y;
    bool is_visible;
    uint8_t shape_type;  // 0=Arc, 1=Circle, 2=Triangle, 3=Capsule, 4=Flat
} spark_mouth_layout_t;
```

> **Note:** `mask_y = -400` is the sentinel value meaning "hide this mask." It's used because -400 is safely off-screen in all display configurations.

---

## The LVGL Object Tree

All face objects are created in `deskimon.c` and registered in the UI object registry:

### Base Eye System (used by most faces)
- `SPARK_UI_EYE_CONTAINER_L/R` — The main oval eye shapes (left and right)
- `SPARK_UI_EYE_L/R` — Inner pupil elements inside containers
- `SPARK_UI_EYE_AURA_L/R` — Soft glow halos around eyes
- `SPARK_UI_MASK_TOP_L/R` — Eyelid masks that slide down to create heavy-lid effect
- `SPARK_UI_MASK_MOON_L/R` — Bottom moon masks that slide up to create squint/happy effect

### Alternative Eye Systems
- `SPARK_UI_INSECURE_EYE_CONTAINER_L/R` — Smaller eye containers for INSECURE/INTEREST faces
- `SPARK_UI_INSECURE_EYE_L/R` — Inner pupils for alternative eyes
- `SPARK_UI_INSEC_COVER_L/R` — Cover elements for the alternative eye system
- `SPARK_UI_EYE_CLOSED_L/R` — Flat horizontal lines for EYES_CLOSED face
- `SPARK_UI_IGNORE_LINE_L/R` — Flat lines for IGNORE face
- `SPARK_UI_IGNORE_HEMI_L/R` — Small semicircles for IGNORE face

### Mouth System
- `SPARK_UI_MOUTH_ARC_L/R` — Corner arcs for smile (BLUSH, CHILL)
- `SPARK_UI_MOUTH_YAWN` — Large open oval for BORING, CRYING_MOUTH
- `SPARK_UI_MOUTH_TRIANGLE` — Triangle for HAPPY_CRY
- `SPARK_UI_MOUTH_OOH` — Circle that expands for OOH
- `SPARK_UI_MOUTH_WTF` — Triangle for WTF (appears after circle shrinks)
- `SPARK_UI_MOUTH_WTF_CIRCLE` — Shrinking circle transition for WTF
- `SPARK_UI_LAUGH_MOUTH` — Wide capsule for LAUGH
- `SPARK_UI_LAUGH_HEMI_L/R` — Side elements of laugh mouth
- `SPARK_UI_INSECURE_MOUTH` — Small element for INSECURE face
- `SPARK_UI_INTEREST_MOUTH_L/R` — Arc elements for INTEREST face

### Tear System
- `SPARK_UI_TEAR_L/R` — Tear drop elements (fade in + animate height for CRY/HAPPY_CRY/CRYING_MOUTH)

### Cosmic Objects (unimplemented)
- `SPARK_UI_COSMIC_PARTICLE_1–8` — Particle emitter objects
- `SPARK_UI_COSMIC_RING_1–8` — Orbit ring objects
- `SPARK_UI_COSMIC_CORE` — Central energy core
- `SPARK_UI_COSMIC_TRAIL_1–2`, `ARC_1–2`, `SHADOW`, `LINE_1–4`, `RETICLE` — Cosmic animation elements

---

## How `Spark_Face_Set()` Works

1. **Guard:** Returns immediately if target face equals current face
2. **Cleanup old face:** If leaving IGNORE, fade in base eye containers
3. **Update state:** `s_current_face = face`
4. **Get config:** `cfg = &SPARK_FACES[face]`
5. **Eye container visibility:** Hide base eyes for INSECURE/INTEREST/IGNORE/EYES_CLOSED, show for all others
6. **Reset all masks:** `hide_all_masks(300)` → slides all 4 mask objects to Y=-400
7. **Reset all accessories:** `hide_all_accessories(300)` → fades all non-base objects to opacity 0
8. **Apply eye geometry:** Call `Spark_Anim_AnimateEyeBase()` for each visible eye
9. **Apply masks:** For any mask_y ≠ -400, animate mask to target Y position
10. **Apply accessories:** Face-specific switch case enables the right accessories

---

## Accessing the Default Eye Color

Default eye color is `0x1AC8DB` (teal-cyan), stored as `s_eye_color_hex` in `spark_face.c`.

To change eye color: `Spark_Face_SetColor(0xRRGGBB)` — this schedules a color refresh on the next logic timer cycle in `deskimon.c`.

---

## Adding a New Face

1. Add enum value to `spark_face_t` in `spark_face.h` (before `SPARK_FACE_MAX`)
2. Add a `spark_face_config_t` struct entry to `SPARK_FACES[]` in `spark_face.c`
3. If the face needs unique accessories: add a `case` in the `switch` inside `Spark_Face_Set()`
4. If the face needs new LVGL objects: add them to `spark_ui_obj_id_t` in `spark_ui_objects.h` and create them in `deskimon.c`
5. Map to an emotion tag in `spark_emotion.c` if needed
