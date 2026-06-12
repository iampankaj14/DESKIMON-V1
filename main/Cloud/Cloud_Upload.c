#include "Cloud.h"
#include <string.h>
#include <stdio.h>
#include "esp_log.h"
#include "esp_http_client.h"
#include "esp_crt_bundle.h"
#include "esp_heap_caps.h"
#include "Provisioning.h"

static const char *TAG = "CloudUpload";

esp_err_t Cloud_UploadVoiceFile(const char *filepath)
{
    const device_config_t *config = Provisioning_GetConfig();
    if (strlen(config->device_id) == 0) {
        ESP_LOGE(TAG, "Device not provisioned. Cannot upload.");
        return ESP_ERR_INVALID_STATE;
    }

    FILE *f = fopen(filepath, "rb");
    if (!f) {
        ESP_LOGE(TAG, "Failed to open audio file %s for reading", filepath);
        return ESP_FAIL;
    }

    // Get file size
    fseek(f, 0, SEEK_END);
    long fsize = ftell(f);
    fseek(f, 0, SEEK_SET);

    char *file_buf = heap_caps_malloc(fsize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!file_buf) {
        ESP_LOGE(TAG, "Failed to allocate %ld bytes in SPIRAM for file upload", fsize);
        fclose(f);
        return ESP_ERR_NO_MEM;
    }

    size_t read_bytes = fread(file_buf, 1, fsize, f);
    fclose(f);

    if (read_bytes != fsize) {
        ESP_LOGE(TAG, "Failed to read full file. Read %d of %ld bytes", read_bytes, fsize);
        heap_caps_free(file_buf);
        return ESP_FAIL;
    }

    // 1. Build Storage Upload URL:
    // POST /storage/v1/object/audio/queries/<device_id>_query.wav
    char *upload_url = heap_caps_malloc(512, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    char *auth_header = heap_caps_malloc(600, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!upload_url || !auth_header) {
        ESP_LOGE(TAG, "Failed to allocate URL/Auth buffers");
        heap_caps_free(file_buf);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_ERR_NO_MEM;
    }

    snprintf(upload_url, 512, "%s/storage/v1/object/audio/queries/%s_query.wav", 
             config->supabase_url, config->device_id);

    ESP_LOGI(TAG, "Uploading voice file to: %s", upload_url);

    esp_http_client_config_t http_cfg = {
        .url = upload_url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 15000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .buffer_size_tx = 4096,
        .buffer_size = 4096,
        .keep_alive_enable = true
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize upload HTTP client");
        heap_caps_free(file_buf);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "audio/wav");
    esp_http_client_set_header(client, "apikey", config->supabase_anon_key);
    esp_http_client_set_header(client, "x-upsert", "true");

    snprintf(auth_header, 600, "Bearer %s", config->auth_token);
    esp_http_client_set_header(client, "Authorization", auth_header);

    esp_http_client_set_post_field(client, file_buf, fsize);

    esp_err_t err = esp_http_client_perform(client);
    int status_code = 0;
    if (err == ESP_OK) {
        status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "Storage upload response code: %d", status_code);
    } else {
        ESP_LOGE(TAG, "Failed to perform storage upload: %s", esp_err_to_name(err));
    }

    heap_caps_free(file_buf);

    if (err != ESP_OK || (status_code != 200 && status_code != 201)) {
        ESP_LOGE(TAG, "Upload failed with HTTP status: %d", status_code);
        esp_http_client_cleanup(client);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_FAIL;
    }

    // 2. Perform PATCH request to set devices.voice_query_url
    char *patch_url = upload_url; // reuse buffer
    snprintf(patch_url, 512, "%s/rest/v1/devices?id=eq.%s", config->supabase_url, config->device_id);

    char *post_data = heap_caps_malloc(512, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!post_data) {
        ESP_LOGE(TAG, "Failed to allocate PATCH payload buffer");
        esp_http_client_cleanup(client);
        heap_caps_free(patch_url);
        heap_caps_free(auth_header);
        return ESP_ERR_NO_MEM;
    }

    snprintf(post_data, 512, "{\"voice_query_url\":\"%s/storage/v1/object/public/audio/queries/%s_query.wav\"}",
             config->supabase_url, config->device_id);

    ESP_LOGI(TAG, "Patching device table (reusing client): %s", patch_url);

    // Reuse HTTP client for PATCH to avoid duplicate TLS handshake
    esp_http_client_set_url(client, patch_url);
    esp_http_client_set_method(client, HTTP_METHOD_PATCH);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "x-upsert", NULL); // Clear x-upsert header
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "PATCH query URL response status: %d", status_code);
    } else {
        ESP_LOGE(TAG, "Failed to perform PATCH query URL: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    heap_caps_free(patch_url);
    heap_caps_free(auth_header);
    heap_caps_free(post_data);

    return err;
}

typedef struct {
    char riff[4];           // "RIFF"
    uint32_t overall_size;   // file size - 8
    char wave[4];           // "WAVE"
    char fmt_chunk_marker[4]; // "fmt "
    uint32_t length_of_fmt;  // 16
    uint16_t format_type;    // 1 for PCM
    uint16_t channels;       // 1 for mono, 2 for stereo
    uint32_t sample_rate;    // 16000
    uint32_t byterate;       // sample_rate * channels * (bits_per_sample/8)
    uint16_t block_align;    // channels * (bits_per_sample/8)
    uint16_t bits_per_sample;// 16
    char data_chunk_header[4]; // "data"
    uint32_t data_size;      // number of bytes of PCM data
} __attribute__((packed)) wav_header_t;

esp_err_t Cloud_UploadVoiceBuffer(const int16_t *pcm_data, uint32_t num_samples)
{
    const device_config_t *config = Provisioning_GetConfig();
    if (strlen(config->device_id) == 0) {
        ESP_LOGE(TAG, "Device not provisioned. Cannot upload.");
        return ESP_ERR_INVALID_STATE;
    }

    uint32_t data_size = num_samples * sizeof(int16_t);
    uint32_t wav_size = sizeof(wav_header_t) + data_size;

    // Allocate buffer in SPIRAM for WAV file
    char *wav_buf = heap_caps_malloc(wav_size, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!wav_buf) {
        ESP_LOGE(TAG, "Failed to allocate %d bytes in SPIRAM for WAV buffer", (int)wav_size);
        return ESP_ERR_NO_MEM;
    }

    // Construct WAV header
    wav_header_t *header = (wav_header_t *)wav_buf;
    memcpy(header->riff, "RIFF", 4);
    header->overall_size = data_size + 36;
    memcpy(header->wave, "WAVE", 4);
    memcpy(header->fmt_chunk_marker, "fmt ", 4);
    header->length_of_fmt = 16;
    header->format_type = 1; // PCM
    header->channels = 1; // Mono
    header->sample_rate = 16000;
    header->byterate = 16000 * 1 * 2;
    header->block_align = 1 * 2;
    header->bits_per_sample = 16;
    memcpy(header->data_chunk_header, "data", 4);
    header->data_size = data_size;

    // Copy PCM data
    memcpy(wav_buf + sizeof(wav_header_t), pcm_data, data_size);

    char *upload_url = heap_caps_malloc(512, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    char *auth_header = heap_caps_malloc(600, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!upload_url || !auth_header) {
        ESP_LOGE(TAG, "Failed to allocate URL/Auth buffers");
        heap_caps_free(wav_buf);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_ERR_NO_MEM;
    }

    snprintf(upload_url, 512, "%s/storage/v1/object/audio/queries/%s_query.wav", 
             config->supabase_url, config->device_id);

    ESP_LOGI(TAG, "Uploading voice buffer from RAM to: %s", upload_url);

    esp_http_client_config_t http_cfg = {
        .url = upload_url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 15000,
        .crt_bundle_attach = esp_crt_bundle_attach,
        .buffer_size_tx = 4096,
        .buffer_size = 4096,
        .keep_alive_enable = true
    };

    esp_http_client_handle_t client = esp_http_client_init(&http_cfg);
    if (!client) {
        ESP_LOGE(TAG, "Failed to initialize upload HTTP client");
        heap_caps_free(wav_buf);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_FAIL;
    }

    esp_http_client_set_header(client, "Content-Type", "audio/wav");
    esp_http_client_set_header(client, "apikey", config->supabase_anon_key);
    esp_http_client_set_header(client, "x-upsert", "true");

    snprintf(auth_header, 600, "Bearer %s", config->auth_token);
    esp_http_client_set_header(client, "Authorization", auth_header);

    esp_http_client_set_post_field(client, wav_buf, wav_size);

    esp_err_t err = esp_http_client_perform(client);
    int status_code = 0;
    if (err == ESP_OK) {
        status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "Storage upload response code: %d", status_code);
    } else {
        ESP_LOGE(TAG, "Failed to perform storage upload: %s", esp_err_to_name(err));
    }

    heap_caps_free(wav_buf);

    if (err != ESP_OK || (status_code != 200 && status_code != 201)) {
        ESP_LOGE(TAG, "Upload failed with HTTP status: %d", status_code);
        esp_http_client_cleanup(client);
        heap_caps_free(upload_url);
        heap_caps_free(auth_header);
        return ESP_FAIL;
    }

    // 2. Perform PATCH request to set devices.voice_query_url
    char *patch_url = upload_url; // reuse buffer
    snprintf(patch_url, 512, "%s/rest/v1/devices?id=eq.%s", config->supabase_url, config->device_id);

    char *post_data = heap_caps_malloc(512, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!post_data) {
        ESP_LOGE(TAG, "Failed to allocate PATCH payload buffer");
        esp_http_client_cleanup(client);
        heap_caps_free(patch_url);
        heap_caps_free(auth_header);
        return ESP_ERR_NO_MEM;
    }

    snprintf(post_data, 512, "{\"voice_query_url\":\"%s/storage/v1/object/public/audio/queries/%s_query.wav\"}",
             config->supabase_url, config->device_id);

    ESP_LOGI(TAG, "Patching device table (reusing client): %s", patch_url);

    esp_http_client_set_url(client, patch_url);
    esp_http_client_set_method(client, HTTP_METHOD_PATCH);
    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_header(client, "x-upsert", NULL);
    esp_http_client_set_post_field(client, post_data, strlen(post_data));

    err = esp_http_client_perform(client);
    if (err == ESP_OK) {
        status_code = esp_http_client_get_status_code(client);
        ESP_LOGI(TAG, "PATCH query URL response status: %d", status_code);
    } else {
        ESP_LOGE(TAG, "Failed to perform PATCH query URL: %s", esp_err_to_name(err));
    }

    esp_http_client_cleanup(client);
    heap_caps_free(patch_url);
    heap_caps_free(auth_header);
    heap_caps_free(post_data);

    return err;
}
