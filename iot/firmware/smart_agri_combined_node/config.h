#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "Galaxy A20sbd1f"
#define WIFI_PASSWORD "nigga6969"

// MQTT Configuration
#define MQTT_SERVER "b27eb4515006479e92387879c5b81538.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USER "Soham"
#define MQTT_PASSWORD "Remy_Lebeau1"

// Device Identity
// IMPORTANT: FARM_ID must match the 'id' column in the farms table in your database.
// DEVICE_ID must match the 'device_id' column in the iot_devices table.
// Run this SQL to find your values:
//   SELECT id, name FROM farms LIMIT 5;
//   SELECT id, device_id, farm_id FROM iot_devices LIMIT 5;
#define FARM_ID   "6811f623-88c4-43f3-b488-8773e3effacb"
#define DEVICE_ID "node_a1"

// Pin Definitions (ESP32 DEVKIT V1)
#define PIN_SOIL_MOISTURE 32  // Analog
#define PIN_RELAY 13          // Digital (Pump Control)
#define PIN_DHT 4             // Digital (DHT Sensor)
#define PIN_SDA 21            // I2C
#define PIN_SCL 22            // I2C
#define PIN_LED 2             // Built-in LED

// Sensor Thresholds
// Set MOISTURE_LOW_THRESHOLD to 0 during testing to disable hardware auto-trigger.
// Change back to 30 when sensor is properly calibrated and connected.
#define MOISTURE_LOW_THRESHOLD       0   // ← was 30, set to 0 to disable auto-trigger
#define MOISTURE_CRITICAL_THRESHOLD  0   // ← was 20
#define TEMP_HIGH_THRESHOLD 35
#define TEMP_CRITICAL_THRESHOLD 40

// Timing (Milliseconds)
#define SENSOR_READ_INTERVAL 300000       // 5 minutes
#define IRRIGATION_DURATION  (30UL*60000) // 30 minutes fallback (server sends durationMinutes)

#endif
