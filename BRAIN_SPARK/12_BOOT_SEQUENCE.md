# 12 — BOOT SEQUENCE

## Production Boot (SPARK_FACE_DEV_MODE = 0)

The complete step-by-step sequence when the device powers on in production mode.

---

### Step 1: `Driver_Init()` — Hardware Setup (Core 0)

Executed first, synchronously, before any task is spawned:

```
PWR_Init()       → Power key GPIO + wake-from-sleep config
BAT_Init()       → ADC for battery voltage monitoring
I2C_Init()       → Shared I2C bus (400kHz, SCL/SDA pins)
EXIO_Init()      → TCA9554 I/O expander (controls backlight, speaker enable, etc.)
Flash_Searching()→ Reads device configuration from NVS flash (provisioned device ID, Wi-Fi, volume)
PCF85063_Init()  → Real-time clock setup, reads current time
QMI8658_Init()   → IMU: configures 6-axis accelerometer + gyroscope
```

---

### Step 2: `Driver_Loop` Task Spawned (Core 0, Priority 3)

A background task starts but **waits 5 seconds** before its loop begins (allows other systems to settle):

```
vTaskDelay(5000ms)
Then loops forever every 100ms:
  QMI8658_Loop()   → Reads raw accelerometer/gyro, updates Accel struct
  PCF85063_Loop()  → Updates RTC time registers
  BAT_Get_Volts()  → Samples battery ADC, updates voltage
  PWR_Loop()       → Checks power key state, handles hold-to-sleep
```

---

### Step 3: `SD_Init()` — SD Card Mount

Mounts the SD/MMC storage (for local music files, future face pack assets, etc.).

---

### Step 4: `LCD_Init()` — Display Driver

Initializes the SPD2010 round display controller:
- Configures SPI bus and display parameters
- Sets up display framebuffer in PSRAM
- Turns on backlight

---

### Step 5: `LVGL_Init()` — Graphics Engine

Initializes the LVGL 8 rendering engine:
- Allocates display draw buffers
- Registers display flush callback
- Registers touch input callback
- Starts LVGL tick timer

---

### Step 6: `Audio_Init()` + `MIC_Speech_init()`

```
Audio_Init()       → PCM5101 I2S DAC setup (I2S bus, sample rate, volume multiplier = 10x)
MIC_Speech_init()  → AFE (Audio Front End) setup:
                       - Dual microphone I2S setup
                       - MultiNet wake word engine init
                       - Spawns recording task
```

---

### Step 7: SparkCore Manager Init

Each manager initializes in order:

```
Spark_State_Init()    → Sets state to SPARK_STATE_BOOT, clears callbacks
Spark_Hardware_Init() → Spawns spark_hw_task (waits 6s before polling begins)
Spark_Face_Init()     → Sets s_current_face = SPARK_FACE_BOOT (no rendering yet)
Spark_Anim_Init()     → Logs "Animation Registry initialized" (no state to set up)
Spark_Emotion_Init()  → Logs "Emotion Manager initialized" (no state to set up)
Spark_Intent_Init()   → Logs "Intent Manager initialized"
```

---

### Step 8: `Deskimon_Start()`

The main application entry point:
1. Creates all LVGL objects and registers them in `Spark_UI_GetObj()` registry
2. Applies initial BOOT face (or transitions to NORMAL)
3. Starts the idle look-around animation timer
4. Starts the blink timer
5. Registers hardware callbacks (IMU events → emotion reactions)
6. Registers touch event handler
7. Sets state: `Spark_State_TransitionTo(SPARK_STATE_IDLE)`

---

### Step 9: Main Loop (forever)

```c
while (1) {
    vTaskDelay(pdMS_TO_TICKS(10));
    lv_timer_handler();   // LVGL renders frames + fires animation callbacks
}
```

The LVGL timer handler drives all animations, redraws, and UI event processing.

---

## Development Boot (SPARK_FACE_DEV_MODE = 1)

**Currently active.** Abbreviated boot for face validation:

```
Step 1: Driver_Init()         (same as production)
Step 2: Driver_Loop task      (same as production)
Step 3: LCD_Init()            (display only — no SD, no audio, no mic)
Step 4: LVGL_Init()
Step 5: Spark_Face_Init()     (face manager only)
Step 6: Spark_Anim_Init()     (animation manager only)
Step 7: Deskimon_FaceDevMode_Start()
          → Creates LVGL objects
          → Cycles through all face expressions for visual inspection
Step 8: Main loop (lv_timer_handler)
```

**Note:** In dev mode, the following are NOT initialized:
- SD card
- Audio output (PCM5101)
- Microphone (MIC_Speech)
- Spark_State, Spark_Hardware, Spark_Emotion, Spark_Intent managers
- Wi-Fi / Wireless
- No server connection is made

---

## Switching Between Modes

In `firmware/main/main.c`, line 1:
```c
#define SPARK_FACE_DEV_MODE 1   // ← Change to 0 for production
```

After changing, the firmware must be **recompiled and reflashed**.

---

## Critical Timing Notes

- `Driver_Loop` task waits **5 seconds** before starting its polling loop
- `spark_hardware_task` waits **6 seconds** before starting IMU event detection
- This stagger prevents I2C bus contention during the critical boot window when all drivers are initializing simultaneously
- LVGL tick must not be started before `LVGL_Init()` — tick before init causes assertion failures
