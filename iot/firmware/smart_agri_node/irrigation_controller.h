#ifndef IRRIGATION_CONTROLLER_H
#define IRRIGATION_CONTROLLER_H

#include "config.h"

bool isIrrigating = false;
unsigned long irrigationStartTime = 0;

void setupIrrigation() {
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, HIGH); // Assuming LOW triggers relay (Active Low) or High, adjust based on relay module
  // Usually relays are Active LOW. Let's assume Active LOW for ON.
  // Wait, standard modules: LOW = ON, HIGH = OFF.
  // We will define specific functions to avoid confusion.
}

void turnPumpOn() {
  if (!isIrrigating) {
    digitalWrite(PIN_RELAY, LOW); // ON
    isIrrigating = true;
    irrigationStartTime = millis();
    Serial.println("Pump turned ON");
  }
}

void turnPumpOff() {
  if (isIrrigating) {
    digitalWrite(PIN_RELAY, HIGH); // OFF
    isIrrigating = false;
    Serial.println("Pump turned OFF");
  }
}

void checkIrrigationStatus() {
  if (isIrrigating) {
    if (millis() - irrigationStartTime >= IRRIGATION_DURATION) {
      turnPumpOff();
    }
  }
}

#endif
