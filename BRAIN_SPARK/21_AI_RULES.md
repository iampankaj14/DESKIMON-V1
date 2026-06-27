# 21 — AI RULES

Mandatory rules for every AI assistant working on SPARK. Non-negotiable.

---

## Rule 1: Never Guess

If you don't know the answer, say so. Do not fabricate function names, pin numbers, API behavior, or file contents. Guessing in embedded systems causes firmware crashes. Guessing in the voice pipeline breaks character consistency.

**Before writing code:**
- Read the relevant source file
- Verify the function signature exists before calling it
- Verify the enum value exists before using it
- Check `SPARK_FACES[]` before referencing a face

---

## Rule 2: Never Delete Working Code

Do not remove code unless:
- The user explicitly asks you to delete it
- OR the code is demonstrably unreachable and you have confirmed it

If code looks unused, **report it**. Don't delete it. The original author may have intentionally left it for future use.

---

## Rule 3: Investigate Before Fixing

If something appears broken, **read the code first**. Do not assume the fix. Understand:
- What the code is supposed to do
- What it is actually doing
- Why the discrepancy exists

Only then propose a fix. Fixes based on assumptions cause new bugs.

---

## Rule 4: One Task at a Time

Do not combine multiple changes into a single edit. If a task requires:
1. Adding a face config
2. Updating the emotion mapping
3. Adding a touch gesture binding

Do them **sequentially**, verify each one before moving to the next.

---

## Rule 5: Preserve Architecture

This project uses a layered manager architecture. Do not bypass it:

- ❌ Do NOT call `lv_obj_set_width()` directly from `MIC_Speech.c`
- ❌ Do NOT add face logic to `main.c`
- ❌ Do NOT store face state outside `spark_face.c`
- ❌ Do NOT call `Deskimon_SetEmotion()` (old API, replaced by `Spark_Emotion_Set()`)
- ❌ Do NOT call Gemini from inside `intent_matcher.js` (Gemini is the fallback in `server_daemon.js`)
- ❌ Do NOT add Supabase queries inside the `/api/voice` handler's critical path

The correct call chains are:
```
Hardware event → spark_hardware callback → spark_emotion → spark_face
Voice intent   → spark_emotion → spark_face
Touch gesture  → deskimon.c handler → spark_face (or spark_emotion)
```

---

## Rule 6: Update Documentation After Every Completed Task

After completing any task:
1. Update `03_CURRENT_STATE.md` to reflect what changed
2. Update `04_FEATURE_STATUS.md` if a feature status changed
3. Update `22_NEXT_SESSION.md` to reflect the new starting point
4. If a significant decision was made: add an entry to `07_DECISIONS.md`
5. If a mistake was made and corrected: add an entry to `08_LESSONS_LEARNED.md`

Documentation must stay in sync with the code. Stale documentation is worse than no documentation.

---

## Rule 7: If Documentation and Code Differ, Report the Conflict

If you find a discrepancy between what the documentation says and what the code does:

**Do NOT silently pick one.** Report the conflict:
```
"CONFLICT DETECTED: 
  - 04_FEATURE_STATUS.md says SPARK_FACE_WINK is 'In Progress'
  - spark_face.c has no config entry for SPARK_FACE_WINK in SPARK_FACES[]
  - Triggering SPARK_FACE_WINK will access uninitialized memory
  Action required: either add the config entry, or mark the face as ❌ Incomplete"
```

---

## Rule 8: Never Trigger Cosmic / Incomplete Faces

The following face enum values have **no config in `SPARK_FACES[]`**. Calling `Spark_Face_Set()` with them will read uninitialized memory and likely crash:

```
SPARK_FACE_WINK
SPARK_FACE_SKEPTICAL
SPARK_FACE_DIZZY
SPARK_FACE_LOVE
SPARK_FACE_COMET_RUSH
SPARK_FACE_ORBIT_MODE
SPARK_FACE_GALAXY_DRIFT
SPARK_FACE_SUPERNOVA
SPARK_FACE_BLACK_HOLE
SPARK_FACE_SPACE_EXPLORER
SPARK_FACE_CHARGING
SPARK_FACE_BATTERY_LOW
```

Do not add any of these to gesture mappings, emotion mappings, or test sequences until their configs are implemented.

---

## Rule 9: Respect the Dev Mode Flag

Currently `#define SPARK_FACE_DEV_MODE 1` in `main.c`.

This means:
- Wi-Fi is NOT initialized
- Audio (PCM5101) is NOT initialized
- Microphone (MIC_Speech) is NOT initialized
- `spark_state`, `spark_hardware`, `spark_emotion`, `spark_intent` managers are NOT initialized

Do not write code that calls `Spark_State_TransitionTo()`, `Spark_Intent_StartRecording()`, or any audio/network function while in dev mode. They will crash because the subsystems are not running.

---

## Rule 10: LVGL is NOT Thread-Safe

All LVGL calls must happen on the **same task** that runs `lv_timer_handler()`. This is the main thread in `app_main()`.

Do not call any LVGL function from:
- `spark_hardware_task`
- `MIC_Speech` recording task
- Any FreeRTOS task other than the main thread

If you need to trigger a face change from a background task, use a queue or flag that the main thread reads during `lv_timer_handler()`.

---

## Rule 11: Preserve Spark's Character

When writing or modifying anything in `spark_personality.js`, `intents.json`, or milestone responses:

- Maximum 1–2 sentences
- No exclamation marks
- No bullet points
- Factual answers first, personality second
- Dry wit only — never forced, never slapstick
- No corporate AI phrasing
- Cosmic references only when natural

Refer to `05_PERSONALITY.md` and `spark_personality.js` `SPARK_BASE_IDENTITY` before modifying any personality text.

---

## Rule 12: Test Before Declaring Done

For server changes: run `node test_all_intents.js` and `node run_live_integration_test.js`.
For firmware changes: build with `idf.py build` and verify zero warnings/errors before declaring done.
For face changes: verify in Face Dev Mode on physical hardware or describe what visual result is expected.
