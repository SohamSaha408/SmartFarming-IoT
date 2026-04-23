#include <WiFi.h>
#include "config.h"
#include "mqtt_handler.h"
#include "irrigation_controller.h"

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
}
