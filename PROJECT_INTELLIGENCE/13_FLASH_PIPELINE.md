# 13 — FLASH PIPELINE

This document describes how to flash binary assets to the Deskimon ESP32-S3 hardware partitions.

---

## 1. Partition Map (`partitions.csv`)

The ESP32-S3 flash storage is divided into several partitions. The physical partition boundaries are configured as follows:

| Partition Name | Type | Sub-Type | Offset | Size | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`nvs`** | data | nvs | `0x9000` | `0x4000` (16KB) | Stores persistent preferences (SSID, Wi-Fi passwords, volume, eye colors, Supabase authorization keys). |
| **`otadata`** | data | ota | `0xd000` | `0x2000` (8KB) | Manages OTA boot targets. |
| **`phy_init`** | data | phy | `0xf000` | `0x1000` (4KB) | Physical transceiver calibration settings. |
| **`factory`** | app | factory | `0x10000` | `0x300000` (3MB) | Hosts the primary compiled application code (`spark.bin`). |
| **`srmodels`** | data | custom | `0x310000` | `0x280000` (2.5MB) | Stores the WakeNet and MultiNet voice model files (`srmodels.bin`). |
| **`storage`** | data | spiffs | `0x590000` | Remaining (10.4MB) | SPIFFS local storage partition. |

### Memory Visual Map
```
0x000000 ──► [Bootloader]
0x009000 ──► [NVS Configs] (16KB)
0x00D000 ──► [OTA Data] (8KB)
0x00F000 ──► [PHY Init Calibration] (4KB)
0x010000 ──► [Factory App Partition: spark.bin] (3MB)
0x310000 ──► [SR Models Partition: srmodels.bin] (2.5MB)
0x590000 ──► [SPIFFS Storage: User files] (10.4MB)
```

---

## 2. Flashing Commands Reference

Run these commands from the `SPARK-V1/firmware` directory:

### Flashing the Primary Application Binary
```bash
# Flash all compiled binaries (bootloader, partitions, and app)
idf.py -p /dev/cu.usbserial-* flash

# Flash ONLY the factory app binary (factory partition at 0x10000)
# (Fastest method for code iteration)
idf.py -p /dev/cu.usbserial-* app-flash
```

### Flashing Speech Recognition Models (`srmodels.bin`)
The speech models binary must be flashed separately to the custom partition address `0x310000`:
```bash
# Write the speech models file directly to address 0x310000
esptool.py -p /dev/cu.usbserial-* -b 460800 write_flash 0x310000 build/srmodels.bin
```

---

## 3. Monitoring Output

To capture serial output, run:
```bash
# Start monitor output
idf.py -p /dev/cu.usbserial-* monitor

# Exit monitor window: Use keyboard shortcut Ctrl + ]
```

---

## 4. Troubleshooting Flash Errors

### "Failed to connect to ESP32-S3: No serial data received."
* **Solution**: Put the device into Bootloader mode manually:
  1. Press and **hold** the physical `BOOT` button.
  2. Press and release the physical `RESET` button.
  3. Release the `BOOT` button.
  4. Re-run your `idf.py flash` command.

### Speech recognition fails with model load warnings
* **Solution**: The `srmodels` partition is either unwritten or corrupted. Re-flash `srmodels.bin` to address offset `0x310000` using the `esptool.py` command shown in Section 2.
