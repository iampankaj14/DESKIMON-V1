# 12 — HARDWARE INTERFACE

## Core MCU

**ESP32-S3** (dual-core Xtensa LX7 @ 240MHz)
- Core 0: `Driver_Loop` FreeRTOS task (hardware polling, Wireless_Init)
- Core 1: LVGL main loop + voice pipeline tasks (`feed_task`, `detect_task`, `voice_upload_task`)

Flash: 16MB  
PSRAM: 8MB (SPIRAM, external, 80MHz Octal PSPI)

---

## Display

**Controller**: SPD2010 (custom driver)  
**Interface**: QSPI or parallel (configured in `LCD_Driver/`)  
**Shape**: Round, 360x360 pixels (assumption based on center-alignment in code: `lv_pct(100)` = full screen)  
**Backlight**: PWM-controlled via `LCD_Backlight` global variable  
**Init**: `LCD_Init()` called from `app_main`

`LCD_Backlight` and `LCD_Backlight_original` are used by the voice pipeline:
- During listening: backlight may be brightened
- On return to idle: `LCD_Backlight = LCD_Backlight_original` restores original brightness

---

## I2C Bus

**Initialized by**: `I2C_Init()` — two I2C buses

Connected devices (I2C bus 0 or 1, specific addresses in driver headers):
- **QMI8658** — 6-axis IMU (accelerometer + gyroscope)
- **PCF85063** — Real-time clock
- **TCA9554PWR** — 8-bit I/O expander (EXIO)
- **Touch controller** — capacitive touch

---

## IMU: QMI8658

**File**: `QMI8658/QMI8658.c`

Output (via global struct):
```c
struct {
    float x, y, z;  // Acceleration in g
} Accel;
```

Sampled by `QMI8658_Loop()` in `Driver_Loop` (every 100ms).

Used in `logic_timer_cb` for gesture detection:
```c
getAccelerometer();  // updates Accel global
float move_amount = fabsf(Accel.x) + fabsf(Accel.y) + fabsf(Accel.z);
bool tilted_up = (Accel.y > 0.6f);
bool shaking = (move_amount > 1.5f);
bool shaking_x = (fabsf(Accel.x) > fabsf(Accel.y));
```

IMU-triggered face reactions:
- `tilted_up + shaking` → CRYING_MOUTH face
- `tilted_up` → CRY face  
- Movement > 0.05g while SLEEPING → wakes to CHILL
- `shaking + shaking_x` → IGNORE
- `shaking` → ANGRY

---

## RTC: PCF85063

**File**: `PCF85063/PCF85063.c`

Provides time of day. Currently read in `PCF85063_Loop()` via `Driver_Loop`.

Not yet integrated into face behavior (future use: show time on display, SLEEP mode scheduling).

---

## I/O Expander: TCA9554PWR

**File**: `EXIO/TCA9554PWR.c` (assumed naming)

Provides 8 additional GPIO pins via I2C. Used for LED, speaker amp enable, display backlight enable, or other control signals not directly connected to ESP32 GPIOs.

---

## Audio Output: PCM5101

**File**: `Audio_Driver/PCM5101.c`

**Interface**: I2S Master  
**Format**: 16-bit stereo (or mono with duplication)  
**Sample rate**: Matches MP3 decode output (typically 44.1kHz or 22.05kHz)

Functions:
- `Audio_Init()` — configures I2S port 0 for output
- `Audio_Play_MP3_Buffer(buf, len)` — Helix decode + DMA push
- `Volume_adjustment(level)` — software volume scaling applied during playback

---

## Audio Input: I2S MEMS Microphone

**Interface**: I2S port 1 (separate from audio output)  
**Configuration**: `I2S_STD_SLOT_RIGHT`, 32-bit words, 16kHz  
**Conversion**: `>> 14` shift to extract 16-bit audio from 32-bit I2S frame

The AFE (Audio Front End from ESP-SR) processes the 16-bit samples for:
- Acoustic Echo Cancellation (AEC)
- Noise Suppression (NS)
- Voice Activity Detection (VAD)
- Wake word detection ready output

---

## Battery Monitor

**File**: `BAT_Driver/BAT_Driver.c`

Reads battery voltage via ESP32 ADC channel.

`BAT_Get_Volts()` → float (e.g., 3.7V)

Battery percentage calculation (in `Cloud_ReportDiagnostics`):
```c
float volts = BAT_Get_Volts();
int battery = (int)((volts - 3.3f) / (4.2f - 3.3f) * 100.0f);
battery = max(0, min(100, battery));
```

Linear approximation (3.3V = 0%, 4.2V = 100%). LiPo discharge is non-linear so this is approximate.

---

## Power Key

**File**: `PWR_Key/PWR_Key.c`

Physical button handler. GPIO interrupt or polling.

Monitored in `Driver_Loop`. Current behavior not fully documented — likely controls display on/off or sleep mode.

---

## Touch Controller

**File**: `Touch_Driver/`

Capacitive touch on the round display. Provides `LV_EVENT_PRESSED`, `LV_EVENT_GESTURE`, `LV_EVENT_LONG_PRESSED` events to LVGL via the LVGL input driver.

Gesture detection in `screen_event_cb` (deskimon.c):
- `LV_DIR_LEFT/RIGHT` → BLUSH
- `LV_DIR_TOP` → WTF
- `LV_DIR_BOTTOM` → OOH
- Tap count: 3 taps → ANGRY, 2 taps → LAUGH/HAPPY_CRY, 1 tap → HAPPY
- Long press → Manual recording trigger

---

## SD Card

**File**: `SD_Card/`  
**Interface**: SDMMC  
**Mount point**: `/sdcard`

Used in production mode for:
- WAV file storage (legacy, before direct HTTP path was implemented)
- Configuration files

Currently `SD_Init()` is called at startup in production mode but the SD card is not required for voice operation (buffers are in SPIRAM).

---

## GPIO Summary (approximate, inferred from code)

| Signal | Direction | Usage |
|---|---|---|
| I2S_BCK, I2S_WS, I2S_DOUT | Output | PCM5101 DAC |
| I2S_BCK2, I2S_WS2, I2S_DIN | Input | MEMS Microphone |
| I2C_SDA, I2C_SCL | Bidirectional | QMI8658, PCF85063, Touch, EXIO |
| SPI/QSPI pins | Output | SPD2010 Display |
| ADC pin | Input | Battery voltage monitor |
| GPIO (via EXIO) | Mixed | Speaker amp enable, backlight, etc. |
| SDMMC pins | Bidirectional | SD Card |
| PWR_KEY GPIO | Input | Physical power button |

Exact GPIO numbers are defined in the driver header files (not mapped here without reading each driver's `#define PIN_*` values).
