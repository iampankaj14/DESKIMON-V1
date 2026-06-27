# 11 — STATE MACHINE

## Two Parallel State Machines

SPARK has two state machines that run simultaneously and must stay synchronized:

1. **`spark_state_t`** — High-level device state (SparkCore layer). Used by any module that needs to know what the device is doing.
2. **`conv_state_t`** — Voice conversation state (MIC layer). Granular sub-states within the voice pipeline.

They are kept in sync by `MIC_SetConvState()` which calls `Spark_State_TransitionTo()` whenever the conversation state changes.

---

## spark_state_t (Device State Machine)

**Defined in**: `SparkCore/spark_state.h`

### States

```
SPARK_STATE_BOOT       → Device starting up
SPARK_STATE_IDLE       → Ready, waiting for wake word
SPARK_STATE_LISTENING  → Recording user voice
SPARK_STATE_THINKING   → Uploading + waiting for AI response
SPARK_STATE_SPEAKING   → Playing TTS audio response
SPARK_STATE_SLEEPING   → Low-power idle (extended timeout)
SPARK_STATE_CHARGING   → Charging animation active
SPARK_STATE_UPDATING   → OTA update in progress
SPARK_STATE_ERROR      → System error state
SPARK_STATE_MAX        → Sentinel value
```

### Implementation

**File**: `SparkCore/spark_state.c`

```c
static spark_state_t s_current_state = SPARK_STATE_BOOT;
static spark_state_cb_t s_callbacks[8];  // max 8 registered callbacks
static int s_callback_count = 0;
```

`Spark_State_TransitionTo(next)`:
1. Logs transition: `"State: BOOT -> IDLE"`
2. Calls all registered callbacks with `(old, new)` args
3. Always allows the transition (no guard table — any state can transition to any state)
4. Logs a warning if the transition seems invalid, but does NOT reject it

**Note**: The state machine has no validation matrix. A bad caller could transition from SPEAKING → BOOT without error. This is a design risk.

### Callback Registration

```c
Spark_State_RegisterCallback(callback_fn)
```

Currently registered by:
- `MIC_Speech.c` — registers a callback that transitions `conv_state_t` in sync

---

## conv_state_t (Conversation State Machine)

**Defined in**: `MIC_Driver/MIC_Speech.h`

### States

```
CONV_STATE_IDLE                → Quiet, wake word listening active
CONV_STATE_LISTENING           → Active recording into s_record_buf
CONV_STATE_FOLLOWUP_LISTENING  → Post-response, 15s window for follow-up
CONV_STATE_PROCESSING          → Audio uploaded, waiting for response
CONV_STATE_SPEAKING            → Playing MP3 response
```

### Synchronization to spark_state_t

`MIC_SetConvState()` maps and syncs:
```
CONV_STATE_IDLE                → SPARK_STATE_IDLE
CONV_STATE_LISTENING           → SPARK_STATE_LISTENING
CONV_STATE_FOLLOWUP_LISTENING  → SPARK_STATE_LISTENING  (reuses)
CONV_STATE_PROCESSING          → SPARK_STATE_THINKING
CONV_STATE_SPEAKING            → SPARK_STATE_SPEAKING
```

---

## eye_state_t (UI Face State)

**Defined locally in**: `LVGL_UI/deskimon.c`

This is a THIRD parallel state machine — the face currently being displayed. It is local to `deskimon.c` and not accessible from outside.

```
EYE_STATE_NORMAL
EYE_STATE_BORED
EYE_STATE_HAPPY
EYE_STATE_ANGRY
EYE_STATE_SLEEP
EYE_STATE_BLUSH
EYE_STATE_BORING
EYE_STATE_CHILL
EYE_STATE_CRY
EYE_STATE_CRYING_MOUTH
EYE_STATE_EYES_CLOSED
EYE_STATE_HAPPY_CRY
EYE_STATE_IGNORE
EYE_STATE_INSECURE
EYE_STATE_INTEREST
EYE_STATE_OOH
EYE_STATE_WTF
EYE_STATE_LAUGH
```

`set_eyes_state(new_state)` in `deskimon.c`:
1. Sets `current_state = new_state`
2. Resets `state_time = 0`, `idle_time = 0`
3. Calls `Spark_Face_Set(new_state)` — the eye_state_t and spark_face_t enums happen to have the same integer values for the first 18 states, so direct casting works.

**Risk**: The `eye_state_t` and `spark_face_t` enums are implicitly coupled by value. If either enum is reordered, the implicit cast `Spark_Face_Set(current_state)` will set the wrong face.

---

## State Transition Table (Intended Flow)

### Normal Operation
```
BOOT → IDLE → [wake word] → LISTENING → [silence] → THINKING → [response] → SPEAKING → [done] → IDLE
                                                                   ↓
                                                    FOLLOWUP_LISTENING → [15s] → IDLE
                                                    FOLLOWUP_LISTENING → [speech] → LISTENING
```

### IMU / Touch Reactions (within IDLE)
```
IDLE + touch gesture → face change (no state transition, just face change)
IDLE + IMU tilt      → face change (no state transition)
IDLE + idle timeout  → EYE_STATE_BORING → BORED → SLEEP → EYES_CLOSED
```

### Auto-Return Timeouts (within deskimon.c)
```
HAPPY + 3500ms → NORMAL
BLUSH + 3500ms → NORMAL
CRY + 3500ms → NORMAL
WTF + 2500ms → INTEREST
INTEREST + 2500ms → NORMAL
LAUGH + 2500ms → NORMAL
ANGRY + 5000ms → INSECURE
INSECURE + 2500ms → NORMAL
```

---

## Who Controls What

| State Machine | Controlled By | Set Via |
|---|---|---|
| `spark_state_t` | `MIC_Speech.c` (primary) | `Spark_State_TransitionTo()` |
| `conv_state_t` | `MIC_Speech.c` (exclusive) | `MIC_SetConvState()` |
| `eye_state_t` | `deskimon.c:logic_timer_cb` | `set_eyes_state()` |
| Face display | `spark_face.c` | `Spark_Face_Set()` |
| Emotion string | `spark_emotion.c` | `Spark_Emotion_Set()` |

The emotion system bridges voice → face:
```
MIC pipeline → Spark_Emotion_Set("listening") → Spark_Face_Set(INTEREST)
                                                     ↓
MIC pipeline → Spark_Emotion_Set("normal")   → Spark_Face_Set(NORMAL)
```

But the `logic_timer_cb` in `deskimon.c` ALSO watches `Spark_Face_Get()` every 100ms and syncs `eye_state_t` to match:
```c
if (Spark_Face_Get() != current_state) {
    set_eyes_state(Spark_Face_Get());
}
```

This creates a unidirectional sync: SparkCore face state → UI face state.
The reverse does NOT happen — if `set_eyes_state()` is called directly (e.g., from touch handler), `Spark_Face_Set()` is called, which updates the SparkCore face state, which will be read back by the timer.
