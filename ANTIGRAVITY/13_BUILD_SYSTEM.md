# 13 — BUILD SYSTEM

## Build Tool

**ESP-IDF v5.3.2** with CMake.

The project uses the standard ESP-IDF build pipeline:
```
idf.py build          ← full build
idf.py flash          ← flash to device (auto-detects serial port)
idf.py monitor        ← serial monitor (115200 baud)
idf.py flash monitor  ← flash + immediately open monitor
```

---

## Project Structure

```
firmware/
├── CMakeLists.txt      ← Top-level: sets project name, includes idf.cmake
├── main/
│   └── CMakeLists.txt  ← Registers ALL source files
├── components/         ← Manually installed third-party components
├── managed_components/ ← IDF Component Manager (idf_component.yml driven)
├── sdkconfig           ← Active configuration (generated, do NOT edit directly)
├── sdkconfig.defaults  ← Default overrides (committed to git)
├── partitions.csv      ← Custom partition table
└── dependencies.lock   ← Locked component versions
```

---

## Component Management

### Third-Party Components (local, in `components/`)
These are vendored — copied into the repo. Updated manually.

```
components/
├── chmorgan__esp-audio-player/   ← MP3 playback to I2S
├── chmorgan__esp-libhelix-mp3/   ← Helix MP3 decoder
├── espressif__esp-dsp/           ← DSP math library
├── espressif__esp-sr/            ← ESP-SR (speech recognition, AFE, models)
└── lvgl__lvgl/                   ← LVGL v8
```

### Managed Components (IDF Component Manager)
Defined in `main/idf_component.yml`. Pulled by IDF during first build.

---

## Key Kconfig Options

Set in `sdkconfig.defaults` (not re-generated on `idf.py menuconfig`):

### Performance & Memory
```
CONFIG_ESP_SPIRAM_SIZE=8388608             ← 8MB PSRAM
CONFIG_SPIRAM_USE_MALLOC=y                ← SPIRAM available to malloc
CONFIG_SPIRAM_MALLOC_ALWAYSINTERNAL=4096  ← objects < 4KB stay internal
CONFIG_ESP_MAIN_TASK_STACK_SIZE=8192
CONFIG_FREERTOS_UNICORE=n                 ← Dual core enabled
```

### Audio
```
CONFIG_I2S_NUM_MASTER=1    ← I2S master configuration
```

### Voice API
```
CONFIG_DESKIMON_VOICE_API_URL=""   ← Set in Kconfig.projbuild
```
Defined in `main/Kconfig.projbuild`:
```kconfig
config DESKIMON_VOICE_API_URL
    string "Direct Voice API URL"
    default ""
    help
        HTTP URL of the voice API server (e.g., http://192.168.1.100:3001).
        Leave empty to use Supabase fallback.
```

### LVGL
```
CONFIG_LV_CONF_INCLUDE_SIMPLE=y
CONFIG_LV_FONT_MONTSERRAT_14=y
CONFIG_LV_COLOR_DEPTH=16           ← RGB565
```

### ESP-SR (Speech Recognition)
```
CONFIG_SR_WN_WN9_HILEXIN=y        ← Wake word model (Hi Lexi)
CONFIG_SR_MN_EN_MULTINET6_QUANT=y ← English MultiNet v6 quantized
```

---

## Compile-Time Feature Flags

Defined as `#define` in `main/main.c`:

| Flag | When 1 | When 0 |
|---|---|---|
| `SPARK_FACE_DEV_MODE` | Face testing only — no WiFi, audio, MIC, cloud | Full production firmware |
| `SPARK_DEVELOPER_PREVIEW_MODE` | LVGL cosmic preview with labels and NEXT button in `Deskimon_Start()` | Normal production Deskimon_Start |
| `HARDWARE_VALIDATION_TEST` | Display driver validation — forces solid color backgrounds (no gradients) | Normal display |

To switch between modes, edit these defines in `main.c` and run `idf.py build flash`.

---

## Partition Table

`firmware/partitions.csv`:
```
# Name,   Type, SubType, Offset,   Size
nvs,      data, nvs,     0x9000,   0x4000    # 16KB NVS
otadata,  data, ota,     0xd000,   0x2000    # 8KB OTA data
phy_init, data, phy,     0xf000,   0x1000    # 4KB PHY calibration
factory,  app,  factory, 0x10000,  0x300000  # 3MB firmware
srmodels, data, ,        0x310000, 0x280000  # 2.5MB speech models
storage,  data, spiffs,  0x590000, 0xa70000  # ~10.4MB file storage
```

**Flash partitions at a glance**:
```
0x000000 ─ Bootloader
0x009000 ─ NVS (16KB)
0x00D000 ─ OTA data (8KB)
0x00F000 ─ PHY init (4KB)
0x010000 ─ Factory app (3MB) ← Firmware lives here
0x310000 ─ SR Models (2.5MB) ← Wake word + MultiNet models
0x590000 ─ SPIFFS storage (10.4MB)
```

---

## Flash & Monitor Commands

```bash
# Build
idf.py build

# Flash full (all partitions)
idf.py flash

# Flash only the app partition (fastest for iteration)
idf.py app-flash

# Flash srmodels separately (only needed when models change)
idf.py -p /dev/cu.usbserial-* write_flash 0x310000 build/srmodels.bin

# Monitor
idf.py monitor

# Flash + monitor
idf.py flash monitor

# Build with verbose output
idf.py -v build

# Clean build
idf.py fullclean
```

Serial port on macOS: `/dev/cu.usbserial-*` or `/dev/cu.SLAB_USBtoUART`

---

## Build Artifacts

```
build/
├── spark.bin               ← Main application binary
├── srmodels.bin            ← Speech model binary
├── bootloader/bootloader.bin
├── partition-table.bin
└── flash_args              ← Arguments for manual esptool.py flash
```

Binary sizes (from previous build):
- `spark.bin`: 1,361,776 bytes (1.3MB)
- `srmodels.bin`: 2,468,364 bytes (2.4MB)

---

## Dependency Lock

`dependencies.lock` pins exact versions of IDF-managed components. Do not delete this file — it ensures reproducible builds across machines.

If adding a new IDF component:
1. Add to `main/idf_component.yml`
2. Run `idf.py update-dependencies`
3. Commit the updated `dependencies.lock`
