#ifndef CONFIG_H
#define CONFIG_H

// WiFi Configuration
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// MQTT Configuration
#define MQTT_SERVER "b27eb4515006479e92387879c5b81538.s1.eu.hivemq.cloud"
#define MQTT_PORT 8883
#define MQTT_USER "Soham"
#define MQTT_PASSWORD "Remy_Lebeau1"

// Device Identity
#define FARM_ID "farm_001"
#define DEVICE_ID "node_a1"

// Pin Definitions (ESP32 DEVKIT V1)
#define PIN_SOIL_MOISTURE 32  // Analog
#define PIN_DHT 4             // Digital
#define PIN_RELAY 5           // Digital
#define PIN_SDA 21            // I2C
#define PIN_SCL 22            // I2C
#define PIN_LED 2             // Built-in LED

// Sensor Thresholds
#define MOISTURE_LOW_THRESHOLD 30
#define MOISTURE_CRITICAL_THRESHOLD 20
#define TEMP_HIGH_THRESHOLD 35
#define TEMP_CRITICAL_THRESHOLD 40

// Timing (Milliseconds)
#define SENSOR_READ_INTERVAL 300000 // 5 minutes
#define IRRIGATION_DURATION 10000   // 10 seconds (demo) / 30 mins (prod)

#endif
