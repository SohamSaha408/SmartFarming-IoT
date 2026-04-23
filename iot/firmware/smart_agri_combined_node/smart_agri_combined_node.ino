#include <WiFi.h>
#include "config.h"
#include "sensors.h"
#include "mqtt_handler.h"
#include "irrigation_controller.h"
#include "ota_update.h"

unsigned long lastSensorRead = 0;
unsigned long lastHeartbeat  = 0;

// Callback for MQTT commands
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.println("=== MQTT MESSAGE RECEIVED ===");
  Serial.print("Topic: ");
  Serial.println(topic);
  Serial.print("Payload: ");
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (!error) {
    if (doc.containsKey("action")) {
      const char* command = doc["action"];
      Serial.print("[CMD] action=");
      Serial.println(command);
      if (strcmp(command, "start") == 0) {
        // The backend sends { "action": "start", "durationMinutes": X }
        if (doc.containsKey("durationMinutes")) {
          // Update the global duration variable dynamically (convert min to ms)
          // Wait, IRRIGATION_DURATION is a macro in config.h. We'll use a local override.
          unsigned long dynamicDuration = doc["durationMinutes"].as<unsigned long>() * 60000;
          turnPumpOn(dynamicDuration);
        } else {
          turnPumpOn(IRRIGATION_DURATION); // Fallback to macro if not provided
        }
      } else if (strcmp(command, "stop") == 0) {
        turnPumpOff();
      }
    } else if (doc.containsKey("command")) {
       // Legacy support if someone manually sends IRRIGATE_ON
       const char* command = doc["command"];
       if (strcmp(command, "IRRIGATE_ON") == 0) {
         turnPumpOn(IRRIGATION_DURATION);
       } else if (strcmp(command, "IRRIGATE_OFF") == 0) {
         turnPumpOff();
       }
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n--- FIRMWARE: COMBINED NODE V2 ---");
  
  setupSensors();
  setupIrrigation();
  
  // WiFi Setup
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);
  
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 40) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected");
    Serial.printf("IP: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\nWiFi failed to connect. Ensure your network is 2.4GHz, as ESP32 does not support 5GHz networks.");
  }

  // Check for OTA firmware update on every boot (before sensors start)
  checkForOTAUpdate();

  setupMQTT();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  checkIrrigationStatus();

  // Heartbeat — prints every 30s so you know the loop is alive
  if (millis() - lastHeartbeat > 30000) {
    lastHeartbeat = millis();
    Serial.printf("[HEARTBEAT] Uptime: %lus | MQTT: %s | Irrigating: %s\n",
      millis() / 1000,
      client.connected() ? "OK" : "DISCONNECTED",
      isIrrigating ? "YES" : "no"
    );
  }

  unsigned long now = millis();
  if (now - lastSensorRead > SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    
    SensorData data = readSensors();
    Serial.printf("Moisture: %.1f%%, Temp: %.1fC, Hum: %.1f%%\n", 
                  data.soilMoisture, data.temperature, data.humidity);
                  
    publishSensorData(data.soilMoisture, data.temperature, data.humidity, data.lux);
    
    // Auto Irrigation Logic (Hardware level fallback)
    if (data.soilMoisture < MOISTURE_LOW_THRESHOLD && !isIrrigating) {
      Serial.println("Auto-triggering irrigation (Hardware trigger)...");
      turnPumpOn(IRRIGATION_DURATION);
      publishAlert("irrigation", "Auto irrigation started");
    }
    
    // Alerts
    if (data.temperature > TEMP_HIGH_THRESHOLD) {
      publishAlert("temperature", "High temperature warning");
    }
  }
}
