# 09 — VOICE PIPELINE

## Overview

The voice pipeline converts ambient microphone audio into spoken AI responses. It is entirely asynchronous and runs on Core 1 of the ESP32-S3, separate from the LVGL UI loop on Core 1 (both share Core 1 but use FreeRTOS priorities).

---

## Conversation State Machine

Defined in `MIC_Driver/MIC_Speech.h`:

```
conv_state_t:
  CONV_STATE_IDLE                ← No active conversation, wake word listening enabled
  CONV_STATE_LISTENING           ← Wake word detected, actively buffering PCM
  CONV_STATE_FOLLOWUP_LISTENING  ← Response played, waiting for follow-up (15s window)
  CONV_STATE_PROCESSING          ← PCM recorded, uploading to server
  CONV_STATE_SPEAKING            ← Server MP3 response being played
```

State is stored in `static conv_state_t s_conv_state = CONV_STATE_IDLE`.

`MIC_SetConvState()` updates `s_conv_state` AND calls `Spark_State_TransitionTo()` — the `conv_state_t` and `spark_state_t` enums are kept synchronized manually.

---

## Two FreeRTOS Tasks

### `feed_task` (Core 1, Priority 5)
Drives the AFE (Audio Front End):
- Reads I2S hardware → 32-bit samples
- Converts to 16-bit via `>> 14`
- Discards audio during `CONV_STATE_SPEAKING` (echo prevention)
- During `CONV_STATE_FOLLOWUP_LISTENING`: measures energy, detects speech onset
- During `s_recording_active`: buffers samples to `s_record_buf` in SPIRAM, does VAD silence detection
- Always feeds AFE for noise suppression

### `detect_task` (Core 1, Priority 5)
Drives the wake word model:
- Fetches processed audio from AFE
- Runs ESP-SR MultiNet model
- On wake word detected: sets `self->detected = true`
- State machine polling loop handles: IDLE (wake word), LISTENING (silence→upload), SPEAKING (mute), PROCESSING (wait)

---

## I2S Configuration

```c
I2S port: I2S_NUM_1
Mode: Master, RX only (microphone)
Sample rate: 16,000 Hz
Bit width: 32-bit (I2S hardware), converted to 16-bit in software
Slot: Right channel (I2S_STD_SLOT_RIGHT)
Conversion: feed_buf[i] = (int16_t)(i2s_buff[i] >> 14)
```

Note: The `>> 14` shift (not `>> 16`) is intentional. The I2S MEMS mic outputs valid bits in bits 14–29 of the 32-bit word.

---

## Recording Parameters

| Parameter | Value | Location |
|---|---|---|
| Sample rate | 16,000 Hz | I2S config |
| Max recording duration | 5 seconds | `s_record_max_samples = 16000 * 5` |
| Recording buffer size | 160,000 int16 samples = 320KB | SPIRAM |
| Min recording duration | `MIN_RECORDING_SECONDS` (1s) | Before silence check starts |
| Silence threshold | `SPEECH_ENERGY_THRESHOLD` | Energy per sample |
| Silence duration to stop | `SILENCE_DURATION_SECONDS` (0.4s) | VAD detection |
| Follow-up timeout | 15,000ms | `s_followup_timer` |
| Post-playback settling | `SETTLING_DELAY_MS` (300ms) | Prevents self-hearing |

---

## Wake Word Detection Flow

```
AFE output (noise-suppressed audio)
  ↓
detect_handler → multinet->fetch(afe_data)
  ↓
multinet->detect(model_data, frame)
  ↓
if wake word matches:
  self->detected = true
  disable_wakenet() ← prevents re-triggering
  MIC_SetConvState(CONV_STATE_LISTENING)
  start_recording()
  Cloud_SetListeningState(true)
  Spark_Emotion_Set("listening")  → Spark_Face_Set(SPARK_FACE_INTEREST)
```

---

## VAD (Voice Activity Detection) Flow

```
feed_handler (running while CONV_STATE_LISTENING):
  for each chunk:
    chunk_avg = mean(abs(feed_buf[i]))
    
    if chunk_avg < SPEECH_ENERGY_THRESHOLD:
      consecutive_silence_samples += chunk_size
    else:
      consecutive_silence_samples = 0

    if s_record_index > MIN_SAMPLES:   ← minimum recording met
      if consecutive_silence_samples >= SILENCE_ONSET_SAMPLES:
        → finish_recording_and_upload(s_record_index)
        → s_recording_active = false
```

---

## Upload Flow

```
finish_recording_and_upload(final_samples)
  ↓
xTaskCreatePinnedToCore(voice_upload_task, core 1, prio 5)
  ↓
voice_upload_task() calls:
  Cloud_UploadVoiceDirect(s_record_buf, num_samples)
    ↓
    Build WAV in SPIRAM (44-byte header + PCM)
    ↓
    HTTP POST to http://<voice_api_url>:3001/api/voice
    Headers:
      Content-Type: audio/wav
      X-Device-Id: <device_uuid>
      X-Device-Battery: <0-100>
      X-Device-Volume: <volume>
      X-Device-Wifi-SSID: <ssid>
      X-Device-Wifi-RSSI: <rssi_dBm>
      X-Device-Boot-Count: <count>
    Body: WAV file (inline, from SPIRAM)
    ↓
    Collect HTTP response body (MP3) via event handler
    ↓
    On response complete:
      MIC_SetConvState(CONV_STATE_SPEAKING)
      Spark_Emotion_Set("normal")
      Audio_Play_MP3_Buffer(mp3_buf, mp3_len)
        ↓
        Helix decode → I2S DMA → PCM5101 DAC → speaker
        ↓
        On playback complete:
          heap_caps_free(mp3_buf)
          MIC_SetConvState(CONV_STATE_FOLLOWUP_LISTENING)
          start_followup_timer(15000ms)
          s_settling_active = true  ← 300ms mic mute
          Cloud_SetListeningState(false)
          Spark_Emotion_Set("normal")
```

---

## Fallback: Supabase Path

If `s_voice_api_url` is NULL or empty, `Cloud_UploadVoiceDirect()` calls `Cloud_UploadVoiceBuffer()`:

```
Cloud_UploadVoiceBuffer(pcm, samples):
  1. Build WAV in SPIRAM
  2. POST to Supabase Storage:
     /storage/v1/object/audio/queries/<device_id>_query.wav
     Headers: apikey, Authorization (Bearer token), x-upsert: true
  3. On success: PATCH /rest/v1/devices?id=eq.<device_id>
     Body: {"voice_query_url": "<public_audio_url>"}
  4. Server polls this URL, processes voice, uploads TTS response
  5. Device receives notification via Supabase Realtime WebSocket
     → triggers audio_download_task → Cloud.c plays the response
```

The Supabase path has ~4-9 second higher latency vs the direct server path.

---

## Follow-Up Conversation

After the response plays:
1. Device enters `CONV_STATE_FOLLOWUP_LISTENING`
2. `start_followup_timer(15000ms)` starts
3. In `feed_handler`, energy monitoring resumes
4. If speech detected (above threshold for `SPEECH_ONSET_SAMPLES` consecutive samples):
   - Cancel timer
   - `MIC_SetConvState(CONV_STATE_LISTENING)`
   - `start_recording()`
   - `Cloud_SetListeningState(true)`
   - `Spark_Emotion_Set("listening")`
5. If 15s expires without speech → `transition_to_idle()`

---

## Manual Recording (Touch Trigger)

A long press on the screen calls `MIC_StartRecordingManual()`:
- Only works if in IDLE state
- Disables wake word detection
- Sets state to `CONV_STATE_LISTENING`
- Calls `start_recording()`
- The rest of the pipeline (VAD → upload) proceeds normally

---

## Audio Echo Prevention

During `CONV_STATE_SPEAKING`:
```c
if (s_conv_state == CONV_STATE_SPEAKING) {
    // Don't feed AFE, don't record. Complete mic mute.
    continue;
}
```

The AFE is completely bypassed while the speaker is active. This prevents the device from hearing its own voice and triggering a second wake word detection.

After playback ends, a `SETTLING_DELAY_MS` (300ms) settling window prevents residual speaker vibration from being detected as speech.

---

## Latency Instrumentation

The code has `LATENCY_AUDIT` log tags at key timestamps:
```
[LATENCY] Recording Start:      when start_recording() called
[LATENCY] Recording End:        when finish_recording_and_upload() called
[LATENCY] HTTP Upload End:      when HTTP headers sent (body upload complete)
[LATENCY] First Byte Received:  when first byte of MP3 arrives
```

These allow measuring each stage of the voice pipeline via serial monitor.
