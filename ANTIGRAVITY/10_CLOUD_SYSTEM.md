# 10 — CLOUD SYSTEM

## Architecture

The cloud layer has two distinct subsystems:

1. **Supabase Realtime (WebSocket)** — Persistent connection for receiving live preference updates (eye color, volume, etc.)
2. **HTTP API** — Voice upload + diagnostics reporting

These are separated across `Cloud.c` (WebSocket + diagnostics) and `Cloud_Upload.c` (voice HTTP).

---

## Backend Configuration (stored in NVS via Provisioning)

```c
typedef struct {
    char device_id[64];          // UUID assigned during onboarding
    char supabase_url[128];      // e.g., "https://xxxx.supabase.co"
    char supabase_anon_key[512]; // Supabase anon/public API key
    char auth_token[512];        // Supabase JWT for this device
    char wifi_ssid[64];
    char wifi_password[64];
    char eye_color[16];          // Hex string e.g., "1AC8DB"
    uint8_t volume;              // 0-100
    char voice_api_url[128];     // Direct server URL e.g., "http://192.168.x.x:3001"
} device_config_t;
```

---

## Supabase Realtime WebSocket

### Connection Setup (`Cloud_Start`)

```c
// URI format: wss://<supabase_host>/realtime/v1/websocket?apikey=<anon_key>&vsn=1.0.0
Cloud_Start()
  ├─ cJSON_InitHooks with SPIRAM alloc/free
  ├─ Build WSS URI from config->supabase_url + config->supabase_anon_key
  ├─ esp_websocket_client_config_t:
  │    .uri = wss://...
  │    .crt_bundle_attach = esp_crt_bundle_attach  ← TLS CA bundle
  │    .buffer_size = 4096
  │    .task_stack = 8192  (from SPIRAM)
  ├─ esp_websocket_client_init()
  ├─ esp_websocket_register_events(ALL, websocket_event_handler)
  └─ esp_websocket_client_start()
```

### Channel Subscription

On `WEBSOCKET_EVENT_CONNECTED`:
```json
{
  "topic": "realtime:device_prefs_<device_id>",
  "event": "phx_join",
  "payload": {
    "config": {
      "postgres_changes": [{
        "event": "UPDATE",
        "schema": "public",
        "table": "device_preferences",
        "filter": "device_id=eq.<device_id>"
      }]
    }
  },
  "ref": "1"
}
```

This subscribes to ALL UPDATE events on the `device_preferences` table filtered to this device.

### Message Reassembly

WebSocket messages may be fragmented. The handler reassembles them:
```c
case WEBSOCKET_EVENT_DATA:
  if (payload_offset == 0):
    s_ws_rx_buf = heap_caps_malloc(payload_len + 1, SPIRAM)
    s_ws_rx_buf_len = payload_len
  
  memcpy(s_ws_rx_buf + payload_offset, data_ptr, data_len)
  
  if (payload_offset + data_len == s_ws_rx_buf_len):
    s_ws_rx_buf[len] = '\0'
    parse_supabase_realtime_msg(s_ws_rx_buf, len)
    heap_caps_free(s_ws_rx_buf)
```

### Message Parsing (`parse_supabase_realtime_msg`)

The payload follows Supabase Realtime v2 format:
```json
{
  "event": "postgres_changes",
  "payload": {
    "data": {
      "new": {
        "eye_color": "FF6600",
        "volume": 80,
        "voice_api_url": "http://192.168.1.50:3001"
      }
    }
  }
}
```

Fields extracted and applied:
- `eye_color` → `Deskimon_SetEyeColor(strtol(hex, NULL, 16))`
- `volume` → `Volume_adjustment(vol)` + save to NVS
- `voice_api_url` → `Cloud_SetVoiceApiUrl(url)`

### Heartbeat

`cloud_sync_task` sends WebSocket heartbeats every 30 seconds to keep the connection alive:
```json
{"topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": "hb_1"}
```

---

## HTTP: Diagnostics Reporting (`Cloud_ReportDiagnostics`)

HTTP PATCH to `/rest/v1/devices?id=eq.<device_id>`:
```json
{
  "is_online": true,
  "battery_level": 87,
  "wifi_signal_strength": -65,
  "uptime_seconds": 3600,
  "last_seen_at": "2025-06-26T15:30:00Z"
}
```

Called periodically by `cloud_sync_task`. All buffers allocated from SPIRAM.

---

## HTTP: Direct Voice Upload (`Cloud_UploadVoiceDirect`)

**Primary voice path** when `s_voice_api_url` is set.

```
POST http://<voice_api_url>/api/voice
Headers:
  Content-Type: audio/wav
  X-Device-Id: <uuid>
  X-Device-Battery: 87
  X-Device-Volume: 80
  X-Device-Wifi-SSID: MyNetwork
  X-Device-Wifi-RSSI: -65
  X-Device-Boot-Count: 12

Body: WAV file (inline, 5s max ≈ 160KB)

Response:
  Content-Type: audio/mpeg
  Body: MP3 audio (TTS response)
```

The response is collected via `direct_voice_http_event` callback into a SPIRAM buffer. When response complete, the MP3 is played directly from RAM.

---

## HTTP: Legacy Supabase Voice Path (`Cloud_UploadVoiceBuffer`)

Used as fallback when no direct server URL is configured:

1. **Upload WAV to Supabase Storage**:
   ```
   POST /storage/v1/object/audio/queries/<device_id>_query.wav
   Headers: apikey, Authorization, x-upsert: true
   Body: WAV (in-memory, from SPIRAM)
   ```

2. **PATCH device record**:
   ```
   PATCH /rest/v1/devices?id=eq.<device_id>
   Body: {"voice_query_url": "<public_url_to_wav>"}
   ```

3. Server notices `voice_query_url` changed → processes voice → uploads MP3 → updates `response_audio_url`

4. Device receives UPDATE via WebSocket → `parse_supabase_realtime_msg` → `audio_download_task(url)`

5. `audio_download_task` downloads MP3 → `Audio_Play_MP3_Buffer()`

---

## HTTP: Audio Download Task (`audio_download_task`)

```c
audio_download_task(args):
  esp_http_client_init(args->url, GET)
  esp_http_client_set_header("User-Agent", "Mozilla/5.0 ...")
  esp_http_client_open() + esp_http_client_fetch_headers()
  content_length = esp_http_client_get_content_length()
  audio_buf = heap_caps_malloc(content_length, SPIRAM)
  read full body into audio_buf
  esp_http_client_cleanup()
  free(args)
  Audio_Play_MP3_Buffer(audio_buf, content_length)
  heap_caps_free(audio_buf)
  vTaskDelete(NULL)
```

---

## Cloud Provisioning Integration

The `Provisioning` module provides the credentials. `Cloud.c` only reads from `Provisioning_GetConfig()` and never writes to NVS directly.

The one exception: `parse_supabase_realtime_msg` can update `volume` in NVS if the cloud sends a new value (via `Provisioning_SaveVolume()` or similar).

---

## Device Linking Flow (First-Time)

When provisioned with WiFi but not yet linked to an account (`PROV_STATE_WIFI_ONLY`):

```
Wireless.c:
  Cloud_StartLinkingTask()
    ↓
  FreeRTOS task polls:
    GET /rest/v1/devices?id=eq.<device_id>
    Waits for response with auth_token populated
    ↓
  On linked:
    Save auth_token to NVS
    Cloud_Start()  (starts WebSocket)
```

---

## TLS / Security

All HTTPS connections use `esp_crt_bundle_attach` — the ESP-IDF built-in CA bundle supporting major CAs including Let's Encrypt (Supabase uses Let's Encrypt).

The direct voice server (`http://192.168.x.x:3001`) uses HTTP (not HTTPS) — intended for local network use only. Production deployments would need HTTPS.

---

## Error Handling Summary

| Scenario | Behavior |
|---|---|
| HTTP upload fails | `voice_upload_task` calls `transition_to_idle()` |
| Supabase PATCH fails | Logs error, returns `ESP_FAIL`, device stays in PROCESSING |
| WebSocket disconnect | Logs warning, frees reassembly buffer, ESP WS client auto-reconnects |
| MP3 response too large | `direct_voice_http_event` logs "buffer overflow", truncates |
| NVS read fails | `device_config_t` fields remain at default (empty strings / 0) |
| WiFi connect fails | Falls back to Captive Portal |
