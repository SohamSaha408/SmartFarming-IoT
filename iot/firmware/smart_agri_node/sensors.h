#ifndef SENSORS_H
#define SENSORS_H

#include "DHT.h"
#include <Wire.h>
#include <BH1750.h>
#include "config.h"

DHT dht(PIN_DHT, DHT22);
BH1750 lightMeter;

struct SensorData {
  float soilMoisture;
  float temperature;
  float humidity;
  float lux;
};

void setupSensors() {
  dht.begin();
  Wire.begin(PIN_SDA, PIN_SCL);
  
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println(F("BH1750 Initialized"));
  } else {
    Serial.println(F("Error initializing BH1750"));
  }
  
  pinMode(PIN_SOIL_MOISTURE, INPUT);
}

SensorData readSensors() {
  SensorData data;
  
  // Read Soil Moisture (Analog 0-4095 -> 0-100%)
  int rawMoisture = analogRead(PIN_SOIL_MOISTURE);
  // Cap at 0-100 (Inverted: High reading usually means dry for resistive, verify for capacitive)
  // Assuming Capacitive: Dry ~3000, Wet ~1500. Needs calibration.
  // Mapping 3500(Dry) -> 0%, 1500(Wet) -> 100%
  data.soilMoisture = map(rawMoisture, 3500, 1500, 0, 100);
  data.soilMoisture = constrain(data.soilMoisture, 0, 100);

  // Read DHT
  data.temperature = dht.readTemperature();
  data.humidity = dht.readHumidity();

  // Read Light
  data.lux = lightMeter.readLightLevel();
  
  // Validate NaN
  if (isnan(data.temperature)) data.temperature = 0;
  if (isnan(data.humidity)) data.humidity = 0;
  
  return data;
}

#endif
