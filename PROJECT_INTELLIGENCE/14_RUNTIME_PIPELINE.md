# 14 — RUNTIME PIPELINE

This document describes the runtime initialization sequence of the Deskimon companion, detailing the stages from CPU reset to the active graphics loop.

---

## 1. Stage 1: CPU Power-On & Bootloader
1. **Reset Vector**: CPU 0 and CPU 1 boot. The bootloader configures the system clock, registers external PSRAM (8MB SPIRAM), and initializes memory allocations.
2. **FreeRTOS Launch**: The Espressif framework launches FreeRTOS and schedules `app_main` on Core 1.

---

## 2. Stage 2: Synchronous Driver Initialization (`Driver_Init`)
`app_main` starts by running `Driver_Init()`, which configures:
1. **`PWR_Init()`**: Pins power rails and monitors GPIO power key interrupts.
2. **`BAT_Init()`**: Initializes battery analog-to-digital (ADC) conversion channels.
3. **`I2C_Init()`**: Brings up I2C bus ports 0 and 1.
4. **`EXIO_Init()`**: Initializes the TCA9554PWR I2C I/O expander to enable power to peripheral chips (backlight, DAC, speaker amplifier).
5. **`Flash_Searching()`**: Configures NVS system partition structures.
6. **`PCF85063_Init()`**: Sets up the hardware RTC clock interface.
7. **`QMI8658_Init()`**: Sets up the 6-axis IMU accelerometer.
8. **Thread Spawn**: Spawns the `Driver_Loop` task on Core 0 with a priority of 3.

---

## 3. Stage 3: Core 0 Driver Loop Task (`Driver_Loop`)
Runs continuously on Core 0 every 100ms:
1. **Sensor Polling**: Calls `QMI8658_Loop()` (gathers IMU data), `PCF85063_Loop()` (tracks clock parameters), `BAT_Get_Volts()` (reads battery), and `PWR_Loop()`.
2. **Network Launch**: Delays 5 seconds, then starts `Wireless_Init()` asynchronously to handle Wi-Fi setup without blocking.

---

## 4. Stage 4: Asynchronous Network Config (`Wireless_Init`)
1. **Netif Stack**: Initializes the Espressif TCP/IP netif stack and sets up defaults for Wi-Fi STA and AP modes.
2. **`Provisioning_Init()`**: Checks NVS storage keys for previously saved configurations:
   * **If `UNPROVISIONED`**: Starts AP mode and launches the captive portal server (`dns_server` + HTTP server) to host `portal.html` for configuration.
   * **If `PROVISIONED`**: Starts STA mode and connects to the saved SSID and password.
3. **Cloud Init**: On connection:
   * Starts `Cloud_Start()` to open the Supabase Realtime WebSocket client and spawn the periodic diagnostic reporting task `cloud_sync_task`.
   * Sets the target voice URL: `Cloud_SetVoiceApiUrl(CONFIG_DESKIMON_VOICE_API_URL)`.

---

## 5. Stage 5: Graphics Initialization
While Network loops run on Core 0, `app_main` proceeds on Core 1:
1. **`LCD_Init()`**: Registers Display SPI registers and boots the SPD2010 panel.
2. **`LVGL_Init()`**: Allocates graphics buffers and registers display flush callbacks with the LVGL engine.

---

## 6. Stage 6: Mode Check & Execution Handoff

```
                       Mode Handoff Decision
                                │
                 Is SPARK_FACE_DEV_MODE == 1?
                 ┌──────────────┴──────────────┐
                 ▼ (Yes)                       ▼ (No)
           [DEVELOPER MODE]              [PRODUCTION MODE]
         - Spark_Face_Init()           - SD_Init() (Mounts SD card)
         - Deskimon_FaceDevMode_Start  - Audio_Init() (DAC I2S configuration)
           ├─ Creates NEXT buttons     - MIC_Speech_init() (Capturing loops)
           ├─ Loads face NORMAL        - Initialize Managers (State, Face, etc)
           └─ Sets 100ms dev timer     - Deskimon_Start()
                                         ├─ Gathers eye color
                                         ├─ Allocates 60+ static objects
                                         └─ Sets 100ms logic timer
```

---

## 7. Stage 7: Execution Loop
Once handoffs complete, the `app_main` thread enters the primary execution loop:
```c
while (1) {
    vTaskDelay(pdMS_TO_TICKS(10));
    lv_timer_handler();  // Executes scheduled graphic transitions and ticks
}
```
This loop runs on Core 1, executing scheduled graphics calculations, updates, and events.
