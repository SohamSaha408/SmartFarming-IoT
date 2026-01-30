#include <WiFi.h>
#include "config.h"
#include "sensors.h"
#include "mqtt_handler.h"
#include "irrigation_controller.h"

unsigned long lastSensorRead = 0;

// Callback for MQTT commands
void callback(char* topic, byte* payload, unsigned int length) {
  Serial.print("Message arrived [");
  Serial.print(topic);
  Serial.print("] ");
  
  String message = "";
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.println(message);

  StaticJsonDocument<200> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (!error) {
    const char* command = doc["command"];
    if (strcmp(command, "IRRIGATE_ON") == 0) {
      turnPumpOn();
    } else if (strcmp(command, "IRRIGATE_OFF") == 0) {
      turnPumpOff();
    }
  }
}

void setup() {
  Serial.begin(115200);
  
  setupSensors();
  setupIrrigation();
  
  // WiFi Setup
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected");
  
  setupMQTT();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();
  
  checkIrrigationStatus();

  unsigned long now = millis();
  if (now - lastSensorRead > SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    
    SensorData data = readSensors();
    Serial.printf("Moisture: %.1f%%, Temp: %.1fC, Hum: %.1f%%\n", 
                  data.soilMoisture, data.temperature, data.humidity);
                  
    publishSensorData(data.soilMoisture, data.temperature, data.humidity, data.lux);
    
    // Auto Irrigation Logic
    if (data.soilMoisture < MOISTURE_LOW_THRESHOLD && !isIrrigating) {
      Serial.println("Auto-triggering irrigation...");
      turnPumpOn();
      publishAlert("irrigation", "Auto irrigation started");
    }
    
    // Alerts
    if (data.temperature > TEMP_HIGH_THRESHOLD) {
      publishAlert("temperature", "High temperature warning");
    }
  }
}
