# 09 — CRITICAL FILES

This document outlines the codebase files classified as **CRITICAL**. These files govern core hardware parameters, real-time loops, or main memory structures, and should not be modified without a thorough understanding of the system's architecture.

---

## Critical Files Inventory

### 1. [`SPARK-V1/firmware/main/main.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/main.c)
* **Subsystem**: Core Initialization & Thread Dispatcher
* **Architectural Role**: Coordinates the startup order for all drivers and managers. Configures compile-time mode flags and initiates Core 0 and Core 1 task threads.
* **Why it must not be modified carelessly**:
  * Modifying the driver initialization sequence (e.g., initializing EXIO after LCD) will prevent the display from receiving power and fail to boot.
  * Changing FreeRTOS task priorities or Core pinning will result in memory corruption or watchdog timing resets.

### 2. [`SPARK-V1/firmware/main/LVGL_UI/deskimon.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/LVGL_UI/deskimon.c)
* **Subsystem**: Visual Rendering & Face Widget Management
* **Architectural Role**: Constructs all 60+ static and dynamic eye/mouth/tear widgets. Runs the 100ms UI update timer and handles swipe/tap events.
* **Why it must not be modified carelessly**:
  * The file contains ~2400 lines of highly coupled variables. Modifying pointers or state transitions risks creating stale handles or memory corruption.
  * Private animation callbacks duplicate functions in `spark_animation.c`. Modifying one without matching the other will cause visual flicker bugs (**H2 Animation Race**).
  * Direct modifications to draw masks will break compatibility when migrating to newer versions of the graphics library (e.g., LVGL v9).

### 3. [`SPARK-V1/firmware/main/SparkCore/spark_cosmic.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/SparkCore/spark_cosmic.c)
* **Subsystem**: Procedural Graphic Calculations (Cosmic Mode)
* **Architectural Role**: Updates positions, angles, speeds, and opacity parameters for all cosmic elements (comets, trails, speed lines).
* **Why it must not be modified carelessly**:
  * Features complex timing calculations. Careless edits to step parameters will cause graphics to jitter or fail.
  * In Dev Mode, faces are deleted dynamically. If `Spark_Cosmic_Tick()` accesses graphic pointers before they are recreated, it will dereference NULL, causing hard faults (**H1 Stale Pointer Risk**).

### 4. [`SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/MIC_Driver/MIC_Speech.c)
* **Subsystem**: Voice Capture, Noise Filtering & Wake-word Detection
* **Architectural Role**: Accesses raw microphone I2S registers, feeds data to noise filtering (AFE) blocks, processes speech patterns through WakeNet/MultiNet models, and manages conversation state switches.
* **Why it must not be modified carelessly**:
  * Operates real-time, timing-sensitive loops. Changing task intervals or audio chunk parameters will degrade audio quality, block wake-word detection, or lead to voice cutting out.
  * The permanent recording buffer (`s_record_buf`) is allocated statically in SPIRAM. Editing allocation routines will cause out-of-memory errors on startup.

### 5. [`SPARK-V1/firmware/main/Audio_Driver/PCM5101.c`](file:///Users/pankaj/Desktop/DESKIMON/SPARK-V1/firmware/main/Audio_Driver/PCM5101.c)
* **Subsystem**: MP3 Decoding & I2S Digital-to-Analog Output
* **Architectural Role**: Configures the I2S digital audio output bus and manages Helix MP3 software decoding tasks.
* **Why it must not be modified carelessly**:
  * Modifying DMA buffer configurations (chunk sizes, count) will result in audio stuttering or mute.
  * Runs software-level calculations for volume adjustments. Modifying scaling functions can clip the signal or cause speaker distortion.

### 6. [`webapp/server_daemon.js`](file:///Users/pankaj/Desktop/DESKIMON/webapp/server_daemon.js)
* **Subsystem**: Backend Server & AI Route Handler
* **Architectural Role**: The primary gateway for backend processing. Manages STT, Intent classification matches, conversational fallbacks, and Edge TTS generation.
* **Why it must not be modified carelessly**:
  * A crash or failure in this server daemon immediately disables all voice features across all connected Deskimon devices.
  * Changes to the response body format will break parsing logic on the ESP32 firmware side.
