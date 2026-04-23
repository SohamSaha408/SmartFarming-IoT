#include <WiFi.h>
#include "config.h"
#include "sensors.h"
#include "mqtt_handler.h"

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
    // Sensor node doesn't process commands
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n\n--- FIRMWARE: SENSOR NODE V2 ---");
  
  setupSensors();
  
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
  } else {
    Serial.println("\nWiFi failed to connect.");
  }
  
  setupMQTT();
}

void loop() {
  if (!client.connected()) {
    reconnect();
  }
  client.loop();

  unsigned long now = millis();
  if (now - lastSensorRead > SENSOR_READ_INTERVAL) {
    lastSensorRead = now;
    
    SensorData data = readSensors();
    Serial.printf("Moisture: %.1f%%, Temp: %.1fC, Hum: %.1f%%\n", 
                  data.soilMoisture, data.temperature, data.humidity);
                  
    publishSensorData(data.soilMoisture, data.temperature, data.humidity, data.lux);
    
    // Alerts
    if (data.temperature > TEMP_HIGH_THRESHOLD) {
      publishAlert("temperature", "High temperature warning");
    }
  }
}
