#pragma once

#include <stdbool.h>
#include "esp_err.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Initialize and start the cloud database sync service.
 * Connects to Supabase via WebSockets and listens to preference changes.
 * Also starts a periodic heartbeat and diagnostics reporter.
 * 
 * @return ESP_OK on success
 */
esp_err_t Cloud_Start(void);

/**
 * @brief Stop the cloud database sync service.
 */
void Cloud_Stop(void);

/**
 * @brief Push current diagnostics to Supabase (Battery, RSSI, Uptime)
 * 
 * @return ESP_OK on success
 */
esp_err_t Cloud_ReportDiagnostics(void);

/**
 * @brief Update the device's listening state in Supabase.
 * 
 * @param is_listening True if wake word is active and device is listening for user voice.
 * @return ESP_OK on success
 */
esp_err_t Cloud_SetListeningState(bool is_listening);
esp_err_t Cloud_UploadVoiceFile(const char *filepath);
esp_err_t Cloud_UploadVoiceBuffer(const int16_t *pcm_data, uint32_t num_samples);

/**
 * @brief Start background task to poll Supabase for device linking/registration
 * 
 * @return ESP_OK on success
 */
esp_err_t Cloud_StartLinkingTask(void);

#ifdef __cplusplus
}
#endif
