#ifndef SENSORS_H
#define SENSORS_H

#include "config.h"
#include <DHT.h>

#define DHTTYPE DHT11 // Change to DHT22 if using DHT22
DHT dht(PIN_DHT, DHTTYPE);

struct SensorData {
  float soilMoisture;
  float temperature;
  float humidity;
  float lux; // Keeping the variables so the rest of the code doesn't break
};

void setupSensors() {
  Serial.println("Initializing Sensors...");
  pinMode(PIN_SOIL_MOISTURE, INPUT);
  dht.begin();
  Serial.println("Sensors setup complete (Light Sensor Disabled, DHT Enabled).");
}

SensorData readSensors() {
  SensorData data;
  
  // Read Soil Moisture (Analog 0-4095 -> 0-100%)
  int rawMoisture = analogRead(PIN_SOIL_MOISTURE);
  
  // Map raw values to percentage
  data.soilMoisture = map(rawMoisture, 3500, 1500, 0, 100);
  data.soilMoisture = constrain(data.soilMoisture, 0, 100);

  // Read exact Temperature and Humidity from DHT
  float t = dht.readTemperature();
  float h = dht.readHumidity();

  // Validate and assign
  data.temperature = isnan(t) ? 0 : t;
  data.humidity = isnan(h) ? 0 : h;
  data.lux = 0; // Still mocked if no light sensor attached
  
  return data;
}

#endif
