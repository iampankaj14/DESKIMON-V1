# 12 — BUILD PIPELINE

This document describes the compilation process, configuration parameters, and build commands for the Deskimon ESP32 firmware.

---

## 1. Build Architecture

The Deskimon firmware is compiled using the Espressif IoT Development Framework (**ESP-IDF v5.3.2**) built on CMake and Ninja.

```
                  ┌──────────────────────┐
                  │ main/CMakeLists.txt  │
                  └──────────┬───────────┘
                             │ (Gathers source files)
                             ▼
  ┌─────────────┐   ┌─────────────────┐   ┌────────────────────┐
  │ sdkconfig   ├──►│ CMake Generator ├──►│ Ninja Build Engine │
  │ (Kconfig)   │   └─────────────────┘   └──────────┬─────────┘
  └─────────────┘                                    │
                                                     ▼
                                          ┌────────────────────┐
                                          │ Build Artifacts    │
                                          │ - spark.bin        │
                                          │ - srmodels.bin     │
                                          │ - bootloader.bin   │
                                          └────────────────────┘
```

---

## 2. Environment Setup

Before executing any build commands, you must configure the ESP-IDF path variables in your shell environment:

```bash
# On Linux/macOS
. ~/esp/esp-idf/export.sh

# On Windows (PowerShell)
.\esp-idf\export.ps1
```

---

## 3. Configuration Profiles (Kconfig)

Build settings are managed in `sdkconfig`, which is generated from the default configurations inside `sdkconfig.defaults`. Do not edit `sdkconfig` directly.

### Key Config Settings
* **SPIRAM Support**:
  * `CONFIG_ESP_SPIRAM_SIZE=8388608` (8MB external PSRAM enabled)
  * `CONFIG_SPIRAM_USE_MALLOC=y` (Dynamic allocation routed to SPIRAM)
  * `CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL=4096` (Buffers smaller than 4KB stay in fast internal SRAM)
* **Processor Configuration**:
  * `CONFIG_FREERTOS_UNICORE=n` (Dual-core execution enabled. Core 0 runs hardware loops; Core 1 runs the graphics engine and voice capturing pipelines).
* **Audio Inputs/Outputs**:
  * `CONFIG_I2S_NUM_MASTER=1` (I2S standard configuration)
* **Speech Models**:
  * `CONFIG_SR_WN_WN9_HILEXIN=y` (Wake word set to "Hi Lexi")
  * `CONFIG_SR_MN_EN_MULTINET6_QUANT=y` (English MultiNet quantized model active)
* **Graphics Settings**:
  * `CONFIG_LV_COLOR_DEPTH=16` (RGB565 16-bit color depth)
  * `CONFIG_LV_FONT_MONTSERRAT_14=y` ( Montserrat Font enabled)

---

## 4. Build Configurations & Flags

Mode settings are set via `#define` statements at the top of [`main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c):

| Feature Flag | Setting | Behavior |
| :--- | :--- | :--- |
| `SPARK_FACE_DEV_MODE` | `1` | **Developer Mode**: Disables Wi-Fi, audio output, mic feeds, and cloud connections. Boots straight to a face preview cycle that auto-advances every 4 seconds. |
| `SPARK_FACE_DEV_MODE` | `0` | **Production Mode**: Full companion execution (captive portal configuration, WebSocket sync, active microphone capturing, real-time voice conversations). |
| `SPARK_DEVELOPER_PREVIEW_MODE` | `1` | **Preview Mode**: Renders NEXT buttons and labels directly on top of the standard production UI. |
| `HARDWARE_VALIDATION_TEST` | `1` | **Validation Mode**: Forces solid primary colors on the display to isolate driver issues. |

> [!IMPORTANT]
> The compiler only rebuilds files that have changed. Modifying flags inside `main.c` does **not** trigger a recompile of `deskimon.c`. After switching modes, you must run a full clean and rebuild:
> ```bash
> idf.py fullclean
> idf.py build
> ```

---

## 5. CMake Project Structure

* **Top-Level CMake** ([`SPARK-V1/firmware/CMakeLists.txt`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/CMakeLists.txt)): Registers the ESP-IDF compiler rules and sets the project binary target to `spark`.
* **Component CMake** ([`SPARK-V1/firmware/main/CMakeLists.txt`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/CMakeLists.txt)): Registers all C source files and directories to be compiled into the single `main` firmware component:
  ```cmake
  idf_component_register(SRCS "main.c"
                              "SparkCore/spark_face.c"
                              "SparkCore/spark_animation.c"
                              "SparkCore/spark_cosmic.c"
                              "SparkCore/spark_state.c"
                              "SparkCore/spark_emotion.c"
                              "SparkCore/spark_intent.c"
                              "SparkCore/spark_hardware.c"
                              "LVGL_UI/deskimon.c"
                              "MIC_Driver/MIC_Speech.c"
                              "Cloud/Cloud.c"
                              "Cloud/Cloud_Upload.c"
                              "Wireless/Wireless.c"
                              "Provisioning/Provisioning.c"
                              "Provisioning/dns_server.c"
                              "Audio_Driver/PCM5101.c"
                              "LCD_Driver/Display_SPD2010.c"
                              "LCD_Driver/esp_lcd_spd2010/esp_lcd_spd2010.c"
                              "LVGL_Driver/LVGL_Driver.c"
                              "Touch_Driver/Touch_SPD2010.c"
                              "I2C_Driver/I2C_Driver.c"
                              "BAT_Driver/BAT_Driver.c"
                              "PWR_Key/PWR_Key.c"
                              "EXIO/TCA9554PWR.c"
                              "QMI8658/QMI8658.c"
                              "PCF85063/PCF85063.c"
                              "SD_Card/SD_MMC.c"
                        INCLUDE_DIRS "."
                                     "SparkCore"
                                     "LVGL_UI"
                                     "MIC_Driver"
                                     "Cloud"
                                     "Wireless"
                                     "Provisioning"
                                     "Audio_Driver"
                                     "LCD_Driver"
                                     "LCD_Driver/esp_lcd_spd2010"
                                     "LVGL_Driver"
                                     "Touch_Driver"
                                     "I2C_Driver"
                                     "BAT_Driver"
                                     "PWR_Key"
                                     "EXIO"
                                     "QMI8658"
                                     "PCF85063"
                                     "SD_Card")
  ```

---

## 6. Build Commands Reference

Run these commands from the `SPARK-V1/firmware` directory:

```bash
# 1. Clean the build directory
idf.py clean

# 2. Complete clean (removes cmake cache and lock files)
idf.py fullclean

# 3. Compile all files and link binaries
idf.py build

# 4. Verbose compilation (useful for debugging compiler warnings)
idf.py -v build
```
