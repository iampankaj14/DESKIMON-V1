# 15 — EVENT FLOW

This document describes the events that drive the Deskimon companion, detailing the behaviors triggered by touch, physical movement, idle timeouts, and voice pipeline transitions.

---

## 1. Touch Gesture Events (`screen_event_cb`)

Located in [`deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c) (line 708). Event filters are hooked to the active screen layer:

```
                  ┌──────────────────────┐
                  │ Screen Touch Event   │
                  └──────────┬───────────┘
                             │
            ┌────────────────┼────────────────┐
            ▼                ▼                ▼
     [Gesture Swipe]      [Screen Tap]   [Long Press]
            │                │                │
 ┌──────────┴──────────┐     │     ┌──────────┴──────────┐
 │ - Left/Right: BLUSH │     │     │ MIC_StartRecording  │
 │ - Up: WTF           │     │     │ Manual()            │
 │ - Down: OOH         │     │     └─────────────────────┘
 └─────────────────────┘     │
            ┌────────────────┼────────────────┐
            ▼ (1 Tap)        ▼ (2 Taps)       ▼ (3+ Taps)
       [HAPPY/CHILL]       [LAUGH/CRY]         [ANGRY]
```

* **Gestures (`LV_EVENT_GESTURE`)**:
  * `LV_DIR_LEFT` / `LV_DIR_RIGHT` ──► Transitions to `EYE_STATE_BLUSH` (blushing eyes + smile).
  * `LV_DIR_TOP` ──► Transitions to `EYE_STATE_WTF` (shocked wide eyes + triangle mouth).
  * `LV_DIR_BOTTOM` ──► Transitions to `EYE_STATE_OOH` (surprised circle mouth + wide eyes).
* **Taps (`LV_EVENT_PRESSED`)**:
  * Monitored in a 600ms tap-counting window.
  * **1 Tap**: Normal click. Triggers `EYE_STATE_HAPPY`, `CHILL`, `LAUGH`, or `WTF` (context dependent).
  * **2 Taps**: Double tap. Triggers `LAUGH` or comfort transition if crying (`HAPPY_CRY`/`INTEREST`).
  * **3+ Taps**: Triple-tap. Triggers `EYE_STATE_ANGRY`.
* **Long Press (`LV_EVENT_LONG_PRESSED`)**:
  * Triggers `MIC_StartRecordingManual()`, forcing the voice pipeline to start recording immediately, bypassing wake word detection.

---

## 2. Physical IMU Motion Events (`logic_timer_cb`)

Runs every 100ms. Calls `getAccelerometer()` to read global `Accel` registers:

```c
float move_amount = fabsf(Accel.x) + fabsf(Accel.y) + fabsf(Accel.z);
bool tilted_up = (Accel.y > 0.6f);
bool shaking = (move_amount > 1.5f);
bool shaking_x = (fabsf(Accel.x) > fabsf(Accel.y));
```

### Action Logic
* **Tilted Upward (`Accel.y > 0.6g`)**:
  * **If Shaking**: Transitions to `EYE_STATE_CRYING_MOUTH` (shaking tears + open mouth).
  * **If Not Shaking**: Transitions to `EYE_STATE_CRY` (resting teardrops).
* **Flat Acceleration / No Tilt**:
  * **If Shaking & X-axis motion dominates (`shaking_x == true`)**: Transitions to `EYE_STATE_IGNORE` (squint lines pan side-to-side).
  * **If Shaking & Y-axis/Z-axis motion dominates**: Transitions to `EYE_STATE_ANGRY`.
* **Subtle Motion (`move_amount > 0.05g`)**:
  * If in `SLEEP` / `EYES_CLOSED`: Wakes up the device and transitions to `EYE_STATE_CHILL`.
  * If in `BORED`: Wakes up the device and transitions to `EYE_STATE_NORMAL`.

---

## 3. Idle Timeout Events (`logic_timer_cb`)

Controls how the face behaves when idle, transitioning to tired or sleeping faces, and returning temporary expressions (like happy or angry) back to normal:

```
[NORMAL] ──► (7s Idle) ──► [BORING] ──► (4.5s) ──► [BORED] ──► (15s Idle) ──► [SLEEP] ──► (10s) ──► [CLOSED]
   ▲                                                                                                  │
   └─────────────────────────── (Any IMU motion / Touch / Voice) ─────────────────────────────────────┘
```

* **Idle Droop Chain**:
  * `NORMAL` + 7 seconds idle ──► `EYE_STATE_BORING` (half-open eyelids).
  * `BORING` + 4.5 seconds state time ──► `EYE_STATE_BORED` (yawns).
  * `BORED` + 15 seconds idle ──► `EYE_STATE_SLEEP` (thin slits).
  * `SLEEP` + 10 seconds state time ──► `EYE_STATE_EYES_CLOSED` (sleeping angular eyes).
* **Auto-Return Face Resets**:
  * `HAPPY`, `BLUSH`, `CRY`, or `IGNORE` + 3.5 seconds state time ──► Resets to `NORMAL`.
  * `HAPPY_CRY` + 3.5 seconds state time ──► Resets to `HAPPY`.
  * `WTF` + 2.5 seconds state time ──► Resets to `INTEREST`.
  * `CHILL`, `INSECURE`, `INTEREST`, `OOH`, or `LAUGH` + 2.5 seconds state time ──► Resets to `NORMAL`.
  * `ANGRY` + 5 seconds state time ──► Resets to `INSECURE`.
  * `CRYING_MOUTH` + 4.5 seconds (and no shaking/tilting) ──► Resets to `NORMAL`.

---

## 4. Voice State Machine Events

Triggered by audio capture interrupts or network responses:

```
                  ┌──────────────────────┐
                  │   CONV_STATE_IDLE    │
                  └──────────┬───────────┘
                             │ (Wake word matched)
                             ▼
                  ┌──────────────────────┐
                  │ CONV_STATE_LISTENING │
                  └──────────┬───────────┘
                             │ (VAD silence detected)
                             ▼
                  ┌──────────────────────┐
                  │ CONV_STATE_PROCESS   │ (Wait for HTTP POST response)
                  └──────────┬───────────┘
                             │ (MP3 stream download)
                             ▼
                  ┌──────────────────────┐
                  │ CONV_STATE_SPEAKING  │ (Play audio to speaker)
                  └──────────┬───────────┘
                             │ (Playback completes)
                             ▼
                  ┌──────────────────────┐
                  │ CONV_STATE_FOLLOWUP  │
                  └─────┬──────────┬─────┘
        (15s timeout)   │          │ (Speech detected)
                        ▼          ▼
                  [Return IDLE]  [Back to LISTENING]
```

* **Wake Word Trigger**: Detects "Hi Lexi" ──► Triggers transition to `CONV_STATE_LISTENING`, enables recording, and sets face to `INTEREST` (eyes-open listening).
* **Silence Trigger (VAD)**: Detects 400ms of silence ──► Stops recording, transitions to `CONV_STATE_PROCESSING`, and sets face to `INTEREST` (thinking).
* **Download Trigger**: Receives the response MP3 stream ──► Starts playback, transitions to `CONV_STATE_SPEAKING`, and sets face to `NORMAL` (or matched emotion).
* **Playback End Trigger**: Audio playback finishes ──► Transitions to `CONV_STATE_FOLLOWUP_LISTENING`, start a 15-second timer, and resets face to `NORMAL`.
* **Follow-up Timeout**: Follow-up timer expires after 15s ──► Resets to `CONV_STATE_IDLE` and re-enables wake word monitoring.
