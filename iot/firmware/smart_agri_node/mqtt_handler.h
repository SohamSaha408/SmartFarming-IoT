#ifndef MQTT_HANDLER_H
#define MQTT_HANDLER_H

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

WiFiClient espClient;
PubSubClient client(espClient);

// Forward declaration
void callback(char* topic, byte* payload, unsigned int length);

void setupMQTT() {
  client.setServer(MQTT_SERVER, MQTT_PORT);
  client.setCallback(callback);
}

void reconnect() {
  while (!client.connected()) {
    Serial.print("Attempting MQTT connection...");
    String clientId = "ESP32Client-";
    clientId += String(random(0xffff), HEX);
    
    if (client.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
      Serial.println("connected");
      // Subscribe to command topic
      String cmdTopic = String("farm/") + FARM_ID + "/device/" + DEVICE_ID + "/command";
      client.subscribe(cmdTopic.c_str());
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      Serial.println(" try again in 5 seconds");
      delay(5000);
    }
  }
}

void publishSensorData(float moisture, float temp, float hum, float lux) {
  if (!client.connected()) reconnect();
  
  StaticJsonDocument<200> doc;
  doc["type"] = "sensor_reading";
  doc["soilMoisture"] = moisture;
  doc["airTemperature"] = temp;
  doc["airHumidity"] = hum;
  doc["lightIntensity"] = lux;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  String topic = String("farm/") + FARM_ID + "/sensor/" + DEVICE_ID;
  client.publish(topic.c_str(), buffer);
}

void publishAlert(const char* type, const char* msg) {
  if (!client.connected()) reconnect();
  
  StaticJsonDocument<200> doc;
  doc["type"] = "alert";
  doc["alertType"] = type;
  doc["message"] = msg;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  String topic = String("farm/") + FARM_ID + "/alert/" + DEVICE_ID;
  client.publish(topic.c_str(), buffer);
}

#endif
