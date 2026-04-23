/**
 * ota_update.h — Over-the-Air firmware update for Smart Agri IoT ESP32
 *
 * On every boot (and every OTA_CHECK_INTERVAL ms while running) the device
 * calls GET /api/ota/check/<DEVICE_ID> with its current version in the
 * X-Firmware-Version header.
 *
 * Server response:
 *   304  → already up-to-date, do nothing
 *   200  → new firmware binary in response body, flash it via HTTPUpdate
 *   404  → no firmware uploaded yet for this device, skip silently
 *
 * Include this file in smart_agri_combined_node.ino and call:
 *   checkForOTAUpdate();   // on boot after WiFi connects
 */

#ifndef OTA_UPDATE_H
#define OTA_UPDATE_H

#include <WiFi.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include "config.h"

// ── Configuration ─────────────────────────────────────────────────────────────
// Set OTA_SERVER_URL to your server's local IP address.
// Find it by running: ipconfig (Windows) or ifconfig (Linux/Mac)
// Example: "http://192.168.1.105:3000"
// Leave as empty string "" to disable OTA entirely.
#ifndef OTA_SERVER_URL
  #define OTA_SERVER_URL ""
#endif

// Current firmware version — bump this string after each successful flash
#ifndef FIRMWARE_VERSION
  #define FIRMWARE_VERSION "1.0.0"
#endif

// How often (ms) to poll for updates while the device is running (default: 1h)
#ifndef OTA_CHECK_INTERVAL
  #define OTA_CHECK_INTERVAL (60UL * 60UL * 1000UL)
#endif

static unsigned long _lastOtaCheck = 0;

// ── Callbacks printed to Serial ───────────────────────────────────────────────
void _otaStarted()    { Serial.println("[OTA] Download started..."); }
void _otaFinished()   { Serial.println("[OTA] Download finished. Rebooting..."); }
void _otaProgress(int cur, int total) {
    Serial.printf("[OTA] Progress: %d / %d bytes (%.0f%%)\n",
                  cur, total, (float)cur / total * 100.0f);
}
void _otaError(int err) {
    Serial.printf("[OTA] Error code: %d\n", err);
}

// ── Main OTA check function ───────────────────────────────────────────────────
void checkForOTAUpdate() {
    // Skip entirely if no server URL configured
    if (String(OTA_SERVER_URL).length() == 0) {
        Serial.println("[OTA] No server URL set — skipping update check.");
        return;
    }

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[OTA] WiFi not connected — skipping update check.");
        return;
    }

    String url = String(OTA_SERVER_URL) + "/api/ota/check/" + String(DEVICE_ID);
    Serial.printf("[OTA] Checking for update at %s (current v%s)\n",
                  url.c_str(), FIRMWARE_VERSION);

    HTTPClient http;
    http.begin(url);
    http.setTimeout(5000); // 5 second timeout — fail fast, never block setup()
    http.addHeader("X-Firmware-Version", FIRMWARE_VERSION);
    http.addHeader("X-Device-Id", DEVICE_ID);

    int httpCode = http.GET();

    if (httpCode == 304) {
        Serial.println("[OTA] Firmware is up-to-date.");
        http.end();
        return;
    }

    if (httpCode == 404) {
        Serial.println("[OTA] No firmware uploaded for this device yet.");
        http.end();
        return;
    }

    if (httpCode <= 0) {
        // Negative codes mean connection failed (timeout, refused, DNS fail)
        Serial.printf("[OTA] Server unreachable (err %d) — skipping.\n", httpCode);
        Serial.println("[OTA] Tip: set OTA_SERVER_URL in ota_update.h to your PC's IP.");
        http.end();
        return;
    }

    if (httpCode != 200) {
        Serial.printf("[OTA] Unexpected HTTP %d — skipping.\n", httpCode);
        http.end();
        return;
    }

    // New firmware available — retrieve and flash
    http.end(); // close the HEAD check; HTTPUpdate opens its own connection

    Serial.println("[OTA] New firmware detected — starting flash...");

    // Blink LED rapidly during download to signal update in progress
    pinMode(PIN_LED, OUTPUT);
    for (int i = 0; i < 6; i++) {
        digitalWrite(PIN_LED, HIGH); delay(100);
        digitalWrite(PIN_LED, LOW);  delay(100);
    }

    httpUpdate.onStart(_otaStarted);
    httpUpdate.onEnd(_otaFinished);
    httpUpdate.onProgress(_otaProgress);
    httpUpdate.onError(_otaError);
    httpUpdate.rebootOnUpdate(true); // auto-reboot after successful flash

    WiFiClient client;
    t_httpUpdate_return result = httpUpdate.update(client, url, FIRMWARE_VERSION);

    switch (result) {
        case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] Flash FAILED (%d): %s\n",
                          httpUpdate.getLastError(),
                          httpUpdate.getLastErrorString().c_str());
            break;
        case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] No update needed (server confirmed).");
            break;
        case HTTP_UPDATE_OK:
            Serial.println("[OTA] Flash SUCCESS — rebooting.");
            break;
    }
}

// ── Interval helper — call in loop() ────────────────────────────────────────
// Checks for updates every OTA_CHECK_INTERVAL ms without blocking.
void otaLoop() {
    unsigned long now = millis();
    if (now - _lastOtaCheck >= OTA_CHECK_INTERVAL) {
        _lastOtaCheck = now;
        checkForOTAUpdate();
    }
}

#endif // OTA_UPDATE_H
