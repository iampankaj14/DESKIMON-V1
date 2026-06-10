#pragma once

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
 * @brief Start background task to poll Supabase for device linking/registration
 * 
 * @return ESP_OK on success
 */
esp_err_t Cloud_StartLinkingTask(void);

#ifdef __cplusplus
}
#endif
