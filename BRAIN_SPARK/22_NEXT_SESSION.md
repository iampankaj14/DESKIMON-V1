# 22 — NEXT SESSION

If development stopped today (2026-06-26), here is exactly what the next developer must do first.

---

## Current State Summary

- ✅ SparkCore architecture is complete and clean
- ✅ Server pipeline is fully functional (STT → Intent → Gemini → TTS)
- ✅ Personality, memory, and milestone systems are implemented
- ⚠️ Firmware is currently in **Face Dev Mode** (`SPARK_FACE_DEV_MODE 1`)
- ⚠️ Several face enum values have no config and will crash if triggered
- ⚠️ Emotion header (`X-Emotion`) from server to ESP32 is not yet implemented

---

## Immediate Priority: Complete Hardware Validation

### Step 1: Flash current firmware and run Face Dev Mode
The firmware is compiled with `SPARK_FACE_DEV_MODE 1`. Flash it to the device and observe:
- Does the display initialize correctly?
- Do all configured faces render and transition without flickering or crashes?
- Are tear objects, mouth elements, and mask overlays positioned correctly?
- Does the `LAUGH` face show a wide open capsule mouth?
- Does the `WTF` face show flat eyes and a triangle mouth?

**What to expect:** `Deskimon_FaceDevMode_Start()` cycles through faces. Watch the display.

**What to do if a face crashes:** Read `spark_face.c` to verify the config entry for that face. Check if the relevant `SPARK_UI_*` objects are created in `deskimon.c`.

---

### Step 2: Disable Dev Mode and Run Full Production Build

In `firmware/main/main.c`, **line 1**:
```c
#define SPARK_FACE_DEV_MODE 0    ← Change this
```

Recompile: `idf.py build`
Flash: `idf.py -p /dev/cu.usbserial-XXX flash`

---

### Step 3: Run the Production Validation Checklist

Work through this in order:

**Boot:**
- [ ] Device powers on and shows NORMAL face without any error restart

**Voice pipeline:**
- [ ] Server daemon is running: `node server_daemon.js`
- [ ] Say the wake phrase → device shows INTEREST face during listening
- [ ] Say "what time is it" → local match → correct time response + NORMAL face
- [ ] Say "tell me a joke" → local match → joke response + LAUGH face
- [ ] Say a free-form question → Gemini fallback → response + appropriate face

**Gestures:**
- [ ] Swipe left → BLUSH
- [ ] Swipe right → BLUSH
- [ ] Swipe up → WTF
- [ ] Swipe down → OOH
- [ ] Double tap → LAUGH
- [ ] Triple tap → ANGRY

**IMU:**
- [ ] Tilt device forward (screen facing up) → CRYING
- [ ] Shake device → ANGRY

**Cloud sync:**
- [ ] Go to web dashboard, change personality preset → confirm Spark responds differently within 60 seconds

---

## Second Priority: Implement X-Emotion Header

The architecture calls for the server to include an `X-Emotion` header in the `/api/voice` response, so the ESP32 knows which face to show when Spark speaks.

### Server side (`webapp/server_daemon.js`)
In the HTTP response builder, add:
```javascript
response.setHeader('X-Emotion', determinedEmotion);
```
Map the matched intent or Gemini response to an emotion string using the same logic as `spark_emotion.c`.

### ESP32 side (`firmware/main/Cloud/Cloud_Upload.c`)
After receiving the HTTP response, read the `X-Emotion` header:
```c
const char *emotion = esp_http_client_get_header(client, "X-Emotion");
if (emotion) {
    Spark_Emotion_Set(emotion);
}
```

---

## Third Priority: Implement Missing Standard Faces

Four standard faces are defined in the enum but have no config:

| Face | Description |
|------|-------------|
| `SPARK_FACE_WINK` | One eye closed — needs one eye smaller/flat |
| `SPARK_FACE_SKEPTICAL` | One eyebrow raised — probably different mask on left vs right |
| `SPARK_FACE_DIZZY` | Spinning / crossed eyes effect |
| `SPARK_FACE_LOVE` | Heart eyes — may need new LVGL objects |

For each:
1. Add a `spark_face_config_t` entry to `SPARK_FACES[]` in `spark_face.c`
2. Add any needed `case` in `Spark_Face_Set()` switch for special accessories
3. Add any needed new `SPARK_UI_*` objects in `spark_ui_objects.h` and `deskimon.c`
4. Add emotion mapping in `spark_emotion.c`
5. Test in Face Dev Mode

---

## Watch Out For These Known Hazards

1. **Cosmic faces** — Do not call `Spark_Face_Set(SPARK_FACE_COMET_RUSH)` or any other cosmic face. They have no config and will crash. See `04_FEATURE_STATUS.md` for the full list.

2. **OOH / WTF face size reset** — These faces call `lv_obj_set_size()` to reset the eye container before animating. If Spark transitions from OOH → WTF → NORMAL quickly, verify the eye container size resets correctly to the NORMAL dimensions.

3. **LVGL on wrong task** — If you add any LVGL calls to background tasks (hardware polling task, audio task), it will cause rendering corruption. All LVGL must run on the main thread.

4. **Dev mode check** — If you're running any firmware test and the network/audio isn't initializing, check `#define SPARK_FACE_DEV_MODE` in `main.c` first.

---

## Server: Running the Backend

```bash
cd /Users/pankaj/Desktop/DESKIMON/webapp
node server_daemon.js
```

Required: `session.json` must exist (login via the web app first). If expired, run `node login.js`.

---

## Useful Test Commands

```bash
# Test all 50 intents for regressions
node test_all_intents.js

# Test specific intent
node debug_matcher.js "tell me a joke"

# Test TTS output
node test_edge_tts.js

# Test memory system
node test_memory.js

# Test milestones
node test_milestones.js

# Full live test (requires device connected + server running)
node run_live_integration_test.js
```

---

## Questions Left Unanswered

These are open design questions that should be resolved before V2:

1. **Wake word phrase** — What is the official wake phrase? "Hey Spark"? "Hey Deskimon"? Not yet finalized.
2. **Charging face** — `SPARK_FACE_CHARGING` is in the enum but unimplemented. What should it look like? Should it trigger automatically when USB is detected?
3. **Cosmic face integration** — `spark_cosmic.c` exists (88KB) but is not linked into the build. Is it stable? Does it need redesign?
4. **Eye color per face** — Currently one global color `s_eye_color_hex`. Should different faces use different colors (e.g., red pupils when ANGRY)?
5. **Key pool rotation** — Multiple API keys are discovered but not automatically rotated. Add round-robin or failure-based rotation?
