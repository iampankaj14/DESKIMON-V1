# 14 — PROVISIONING

## Overview

Provisioning handles the first-time setup flow: connecting the device to WiFi and linking it to a Supabase account. Configuration is persisted in NVS (Non-Volatile Storage) flash.

**File**: `Provisioning/Provisioning.c` (~25KB, 700+ lines)

---

## Device Configuration Struct

```c
typedef struct {
    char device_id[64];          // UUID — assigned at factory or on first link
    char wifi_ssid[64];          // WiFi network name
    char wifi_password[64];      // WiFi password (plaintext in NVS)
    char supabase_url[128];      // e.g., "https://abcxyz.supabase.co"
    char supabase_anon_key[512]; // Supabase public/anon API key
    char auth_token[512];        // JWT auth token for this device's Supabase user
    char eye_color[16];          // Hex color string, e.g., "1AC8DB"
    uint8_t volume;              // Volume 0–100
    char voice_api_url[128];     // Direct voice server URL
} device_config_t;
```

All fields are read from NVS at boot via `Provisioning_Init()`. Fields not yet stored in NVS remain as empty strings / 0.

---

## Provisioning States

```c
typedef enum {
    PROV_STATE_UNPROVISIONED,      // No WiFi credentials in NVS
    PROV_STATE_WIFI_ONLY,          // Has WiFi, but not linked to Supabase account
    PROV_STATE_FULLY_PROVISIONED,  // Has WiFi + auth_token + device_id
} prov_state_t;
```

`Provisioning_GetState()` determines state by checking NVS fields:
- No `wifi_ssid` → UNPROVISIONED
- Has `wifi_ssid` but no `auth_token` → WIFI_ONLY
- Has both → FULLY_PROVISIONED

---

## Captive Portal Flow

Triggered when state is UNPROVISIONED or WiFi connect fails:

```
Provisioning_StartCaptivePortal()
  ├─ Set WiFi to AP+STA mode
  ├─ Start SoftAP: SSID = "Deskimon-Setup" (or similar)
  ├─ esp_http_client_start() → serves portal.html
  └─ dns_server_start()      → redirects all DNS to device IP

User connects phone to "Deskimon-Setup" network
  → Browser shows captive portal form
  → User enters: WiFi SSID, Password, Supabase URL, Supabase Anon Key

HTTP POST handler receives form data
  └─ Provisioning_SaveConfig(ssid, pass, url, anon_key)
       └─ nvs_set_str() for each field
  └─ Provisioning_ConnectWiFi()
       └─ On success: call Cloud_StartLinkingTask()
  └─ Redirect to success page

Portal HTML: Provisioning/portal.html (15KB embedded as C string)
```

---

## WiFi Connection Flow

```c
Provisioning_ConnectWiFi()
  ├─ esp_wifi_set_mode(STA)
  ├─ esp_wifi_set_config(WIFI_IF_STA, {ssid, password})
  ├─ esp_wifi_start()
  └─ esp_wifi_connect()
       ├─ On IP_EVENT_STA_GOT_IP:
       │    NTP time sync (sntp_sync)
       │    return ESP_OK
       └─ On WIFI_EVENT_STA_DISCONNECTED:
            retry up to 3 times → return ESP_FAIL
```

---

## Device Linking (WIFI_ONLY → FULLY_PROVISIONED)

After WiFi connects but device is not yet linked to an account:

```
Cloud_StartLinkingTask()
  └─ FreeRTOS task:
       loop every 5 seconds:
         GET <supabase_url>/rest/v1/devices?select=auth_token&id=eq.<device_id>
         Headers: apikey, Prefer: return=minimal
         If auth_token field is populated:
           Provisioning_SaveAuthToken(token)
           Cloud_Start()  ← WebSocket connected
           break
```

The webapp registers the device to the user account, populating `auth_token` in Supabase. The device polls until it sees the token.

---

## NVS Keys

All values stored under namespace `"spark"`:

| NVS Key | Type | Content |
|---|---|---|
| `"device_id"` | string | UUID |
| `"ssid"` | string | WiFi SSID |
| `"pass"` | string | WiFi password |
| `"supa_url"` | string | Supabase project URL |
| `"anon_key"` | string | Supabase anon key |
| `"auth_token"` | string | JWT for device user |
| `"eye_color"` | string | Hex color |
| `"volume"` | uint8 | 0-100 |
| `"voice_api_url"` | string | Direct server URL |

---

## Security Notes

- WiFi password stored **plaintext** in NVS. NVS has no encryption by default in the current build.
- `auth_token` is a long-lived JWT. It is never refreshed automatically (no refresh token mechanism).
- Supabase anon key is stored in NVS. This key is public by design (row-level security on Supabase prevents unauthorized access), but physical access to the device allows reading it from flash.
- If NVS encryption is needed, enable `CONFIG_NVS_ENCRYPTION=y` in sdkconfig and provision with encrypted flash (requires secure boot setup).

---

## Factory Reset

No software factory reset button is currently implemented. To reset:
1. `idf.py erase-flash` → erases all flash including NVS
2. Or: `idf.py -p <port> erase_region 0x9000 0x4000` → erases only NVS partition

A future improvement would be a long-press + gesture combo to trigger `nvs_erase_all()` and restart.
