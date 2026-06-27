# 19 — GLOSSARY

Project-specific terms, abbreviations, naming conventions, and frequently used identifiers.

---

## Project Names

| Term | Meaning |
|------|---------|
| **Deskimon** | The product brand name — the physical hardware device |
| **Spark** | The AI character/personality living inside Deskimon |
| **SPARK-V1** | The V1 repository — the current refactored firmware and server codebase |
| **SparkCore** | The manager-based firmware architecture layer (`firmware/main/SparkCore/`) |
| **Brain Spark** | This knowledge base — the permanent memory of the project |

---

## Hardware Terms

| Term | Meaning |
|------|---------|
| **ESP32-S3** | The microcontroller chip — dual-core Xtensa LX7, 8MB PSRAM, 16MB Flash |
| **PSRAM** | Pseudo-Static RAM — the 8MB external RAM on the ESP32-S3, used for audio/display buffers |
| **SRAM** | Internal static RAM — ~512KB, critical resource, used for task stacks and drivers |
| **Flash** | 16MB NOR Flash — stores firmware binary, NVS, `.rodata` constants |
| **NVS** | Non-Volatile Storage — ESP-IDF key-value store in Flash for settings persistence |
| **IMU** | Inertial Measurement Unit — QMI8658 6-axis accelerometer/gyroscope |
| **RTC** | Real-Time Clock — PCF85063 I2C chip for date/time |
| **DAC** | Digital-to-Analog Converter — PCM5101 I2S audio output chip |
| **AFE** | Audio Front End — ESP-IDF audio processing layer for microphone noise filtering |
| **EXIO** | External I/O — TCA9554 I2C I/O expander for backlight, speaker enable, etc. |
| **SPD2010** | The round display controller driver |
| **PCM5101** | The I2S audio DAC chip driving the speaker |
| **QMI8658** | The 6-axis IMU chip |
| **PCF85063** | The I2C real-time clock chip |
| **TCA9554** | The I2C I/O expander (referred to as EXIO in code) |

---

## Software / Firmware Terms

| Term | Meaning |
|------|---------|
| **LVGL** | Light and Versatile Graphics Library — the graphics engine used for rendering faces (version 8) |
| **FreeRTOS** | Real-time operating system underneath ESP-IDF |
| **ESP-IDF** | Espressif IoT Development Framework — the SDK for ESP32 |
| **lv_obj_t** | An LVGL object (widget) — the base type for any UI element |
| **lv_anim_t** | An LVGL animation descriptor struct |
| **lv_anim_exec_xcb_t** | The LVGL animation callback function type — must be `void cb(void *var, int32_t v)` |
| **`.rodata`** | Read-only data section in Flash — where `static const` arrays are stored |
| **DMA** | Direct Memory Access — hardware mechanism used by I2S, SPI, LVGL framebuffer transfers |
| **VAD** | Voice Activity Detection — silence detection to stop recording when user stops talking |
| **MultiNet** | ESP-IDF wake word detection engine |

---

## SparkCore Identifiers

| Identifier | File | Meaning |
|-----------|------|---------|
| `spark_state_t` | `spark_state.h` | Enum of device states (BOOT, IDLE, LISTENING, etc.) |
| `spark_face_t` | `spark_face.h` | Enum of all face expressions |
| `spark_anim_t` | `spark_animation.h` | Enum of named animation types |
| `spark_hw_event_t` | `spark_hardware.h` | Enum of hardware events (SHAKE, TILT_UP, etc.) |
| `spark_face_config_t` | `spark_face.h` | Struct describing a face's visual layout |
| `spark_eye_layout_t` | `spark_face.h` | Struct describing one eye's geometry |
| `spark_mouth_layout_t` | `spark_face.h` | Struct describing mouth shape and position |
| `spark_ui_obj_id_t` | `spark_ui_objects.h` | Enum of all LVGL object IDs |
| `SPARK_FACES[]` | `spark_face.c` | Static const array of all face configs (in Flash) |
| `s_current_face` | `spark_face.c` | Private state variable — current active face |
| `s_eye_color_hex` | `spark_face.c` | Private state variable — current eye color |
| `-400` sentinel | `spark_face.c` | Magic value meaning "mask is hidden / off-screen" in mask_y fields |

---

## Server / Backend Terms

| Term | Meaning |
|------|---------|
| **server_daemon** | The `server_daemon.js` Node.js HTTP server on port 3001 |
| **ConversationManager** | In-memory class managing multi-turn context per device, 60s TTL |
| **presetCache** | In-memory Map caching device personality settings, 60s TTL |
| **intent** | A named category of user query (e.g., `GREETING_HELLO`, `UTILITY_TIME`) |
| **intent match** | When the local matcher scores ≥ 0.90 and returns a pre-written response |
| **Gemini fallback** | When no local intent matches, the query goes to Gemini 2.5 Flash |
| **STTProvider** | Abstract interface for speech-to-text — implemented by Groq and Gemini providers |
| **TTSProvider** | Abstract interface for text-to-speech — supports Edge TTS and ElevenLabs |
| **placeholder** | Template variable in intent responses: `{TIME}`, `{DATE}`, `{BATTERY}`, etc. |
| **telemetry headers** | HTTP headers sent by the ESP32 with device state (battery, volume, WiFi, etc.) |
| **session.json** | File storing Supabase auth session tokens |
| **memories.json** | File storing all user memories and relationship data |
| **milestone** | A life/achievement event that Spark detects and celebrates |
| **XP** | Experience points — earned per voice interaction, drives relationship level |
| **relationship level** | 1–5 scale tracking how long Spark has known a user |

---

## Naming Conventions

### C Firmware
- **Files:** `snake_case` (`spark_face.c`, `spark_animation.h`)
- **Types:** `snake_case_t` (`spark_face_t`, `spark_hw_event_t`)
- **Functions:** `PascalCase` with module prefix (`Spark_Face_Set()`, `Spark_Anim_Prop()`)
- **Enums:** `SCREAMING_SNAKE_CASE` (`SPARK_FACE_HAPPY`, `SPARK_STATE_IDLE`)
- **Private static variables:** `s_` prefix (`s_current_face`, `s_callbacks`)
- **Debug tags:** `#define TAG "ModuleName"` used in `ESP_LOGI(TAG, ...)`

### JavaScript Server
- **Files:** `snake_case.js` (`intent_matcher.js`, `memory_system.js`)
- **Classes:** `PascalCase` (`ConversationManager`, `MemorySystem`)
- **Functions:** `camelCase` (`buildSystemInstruction()`, `fetchDevicePreset()`)
- **Constants:** `SCREAMING_SNAKE_CASE` (`SPARK_BASE_IDENTITY`, `PRESET_CACHE_TTL_MS`)

### Intent Names
Format: `CATEGORY_DESCRIPTION`
- `GREETING_HELLO` — Category: Greeting, Action: Hello
- `COMPANION_TELL_JOKE` — Category: Companion, Action: Tell a joke
- `UTILITY_BATTERY` — Category: Utility, Topic: Battery

### Face Names
Format: `SPARK_FACE_STATE`
- `SPARK_FACE_NORMAL`, `SPARK_FACE_HAPPY`, `SPARK_FACE_WTF`

### UI Object Names
Format: `SPARK_UI_OBJECT_SIDE`
- `SPARK_UI_EYE_CONTAINER_L` — left eye container
- `SPARK_UI_MASK_TOP_R` — right top mask
- `SPARK_UI_MOUTH_ARC_L` — left arc mouth element
