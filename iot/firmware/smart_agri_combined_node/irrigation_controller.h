#ifndef IRRIGATION_CONTROLLER_H
#define IRRIGATION_CONTROLLER_H

#include "config.h"

// Most ESP32 relay modules are Active LOW (LOW turns relay ON, HIGH turns it OFF)
#define RELAY_ON LOW
#define RELAY_OFF HIGH

bool isIrrigating = false;
unsigned long irrigationStartTime = 0;
unsigned long currentIrrigationDuration = IRRIGATION_DURATION;

void setupIrrigation() {
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, RELAY_OFF); // Ensure pump is OFF on boot
}

void turnPumpOn(unsigned long durationMs = IRRIGATION_DURATION) {
  if (!isIrrigating) {
    digitalWrite(PIN_RELAY, RELAY_ON); // Turn relay ON
    isIrrigating = true;
    irrigationStartTime = millis();
    currentIrrigationDuration = durationMs;
    Serial.print("Pump turned ON for ");
    Serial.print(durationMs / 1000);
    Serial.println(" seconds.");
  }
}

void turnPumpOff() {
  if (isIrrigating) {
    digitalWrite(PIN_RELAY, RELAY_OFF); // Turn relay OFF
    isIrrigating = false;
    Serial.println("Pump turned OFF");
  }
}

void checkIrrigationStatus() {
  if (isIrrigating) {
    if (millis() - irrigationStartTime >= currentIrrigationDuration) {
      Serial.println("Time elapsed. Auto-turning Pump OFF.");
      turnPumpOff();
    }
  }
}

#endif
