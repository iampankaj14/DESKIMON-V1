# 08 — MEMORY MAP

## SRAM vs SPIRAM Allocation Strategy

The ESP32-S3 has:
- **~512KB internal SRAM** — fast, needed for ISR/DMA/stack. Limited.
- **8MB PSRAM (SPIRAM)** — slower, accessible via cache. Used for large buffers.

The firmware's strategy: **keep stacks + DMA + code in SRAM, everything large in SPIRAM**.

---

## Static Allocations

| Buffer | Size | Memory | Location |
|---|---|---|---|
| `s_record_buf` (audio recording) | 160,000 bytes (5s × 16kHz × int16) | SPIRAM | `MIC_Speech.c` |
| LVGL frame buffer(s) | display-dependent (~128KB typical) | SRAM or SPIRAM | `LVGL_Driver/` |
| `SPARK_FACES[]` config table | ~19 × 128 bytes ≈ 2.4KB | SRAM (static) | `spark_face.c` |
| FreeRTOS task stacks | 4KB–16KB per task | SRAM (from pool) | Various |

---

## Dynamic Allocations (SPIRAM, per-operation)

### Voice upload (every voice interaction)
```
WAV buffer: 44 + (samples × 2) bytes
Example (5s recording): 44 + 160,000 = 160,044 bytes ≈ 156KB

MP3 response buffer: sized for expected TTS response
Typical TTS: 5-10s @ 128kbps ≈ 80–160KB

Peak SPIRAM used during voice cycle:
  s_record_buf (permanent):     ~156KB
  WAV build buffer:             ~156KB  ← allocated then freed
  MP3 response buffer:          ~100KB  ← allocated during download
  Peak total:                   ~412KB during upload phase
```

### WebSocket message reassembly
```
Per Supabase Realtime message: heap_caps_malloc(payload_len + 1, SPIRAM)
Typical Supabase UPDATE event: ~400-800 bytes
Freed immediately after parse_supabase_realtime_msg()
```

### Cloud diagnostics (periodic)
```
url:         256 bytes SPIRAM
post_data:   256 bytes SPIRAM
auth_header: 600 bytes SPIRAM
Total:       ~1.1KB  ← all freed after HTTP response
```

### cJSON parsing
```
cJSON uses SPIRAM hooks (set in Cloud_Start via cJSON_InitHooks)
Temporary allocation per parsed message
Freed via cJSON_Delete() after parsing
```

---

## FreeRTOS Task Stack Sizes

| Task | Stack | Core | Priority |
|---|---|---|---|
| `app_main` (main loop) | default (8KB) | 1 | 1 |
| `Driver_Loop` | 4096 | 0 | 3 |
| `feed_task` (MIC AFE feed) | 8192+ | 1 | 5 |
| `detect_task` (wake word) | 8192+ | 1 | 5 |
| `voice_upload_task` (transient) | 8192 | 1 | 5 |
| `cloud_sync_task` (static) | 8192 from SPIRAM | 1 | 3 |
| `audio_download_task` (transient) | 8192 | — | — |

---

## LVGL Object Memory

All LVGL objects are allocated from LVGL's internal heap (internal SRAM or SPIRAM depending on LVGL config).

Approximate sizes:
- `lv_obj_t`: ~200 bytes base
- Style descriptor: ~32 bytes per applied style
- Animation: ~80 bytes per active animation

Production mode creates **60+ static objects** at `Deskimon_Start()`:
```
60 objects × 200 bytes = ~12KB for object structs alone
+ styles, animations, event callbacks
Estimated total LVGL heap: ~25–40KB
```

Dev mode creates 15–35 objects per face. They are deleted on face change.

---

## Known Memory Risks

### 1. SPIRAM Fragmentation
Every voice interaction allocates ~156KB for WAV + ~100KB for MP3, then frees them. After many interactions, SPIRAM can become fragmented. The firmware does not call `heap_caps_check_integrity_all()` or any defragmentation routine.

### 2. WebSocket Buffer Leak on Disconnect
In `websocket_event_handler`, on `WEBSOCKET_EVENT_DISCONNECTED`:
```c
if (s_ws_rx_buf) {
    heap_caps_free(s_ws_rx_buf);
    s_ws_rx_buf = NULL;
    s_ws_rx_buf_len = 0;
}
```
This is correctly guarded. ✅

However, if the WebSocket disconnects **mid-message** (partial assembly), `s_ws_rx_buf` holds a partial payload. On disconnect, it is freed. On reconnect, the firmware subscribes fresh. This is handled correctly.

### 3. `i2s_buff` and `feed_buf` in feed_handler
These are allocated once per `feed_handler` invocation (task start) and never freed until the task is killed. Since the task runs forever, they are permanent allocations from the regular heap (~512+256 = ~768 bytes). Fine.

### 4. Audio Download Args Leak
In `audio_download_task`:
```c
audio_download_args_t *args = (audio_download_args_t *)pvParameters;
// ...
free(args);
vTaskDelete(NULL);
```
`args` is freed before task deletion. ✅ However, `args` is allocated with `malloc()` (non-SPIRAM) in `parse_supabase_realtime_msg`. For a 512-byte struct, this is fine.

---

## Partition Table

From `firmware/partitions.csv`:

| Name | Type | SubType | Offset | Size |
|---|---|---|---|---|
| nvs | data | nvs | 0x9000 | 0x4000 (16KB) |
| otadata | data | ota | 0xd000 | 0x2000 (8KB) |
| phy_init | data | phy | 0xf000 | 0x1000 (4KB) |
| factory | app | factory | 0x10000 | 0x300000 (3MB) |
| srmodels | data | — | 0x310000 | 0x280000 (2.5MB) |
| storage | data | spiffs | 0x590000 | remaining |

Binary sizes:
- Firmware: `1,361,776 bytes` → 44% of 3MB factory partition
- srmodels: `2,468,364 bytes` → 96% of 2.5MB srmodels partition

**Warning**: srmodels partition is nearly full. If a newer/larger ESP-SR model is used, the partition table must be resized.
