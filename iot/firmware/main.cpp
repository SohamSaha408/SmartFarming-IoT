/*
 * Smart Agriculture IoT - ESP32 Firmware
 * 
 * This firmware reads soil sensors and communicates with the server via MQTT.
 * 
 * Hardware Requirements:
 * - ESP32 DevKit V1
 * - Capacitive Soil Moisture Sensor v1.2
 * - DS18B20 Temperature Sensor
 * - RS485 NPK Sensor (optional)
 * - DHT22 Air Temperature/Humidity Sensor
 * - 4-Channel Relay Module (for pump/valve control)
 * - YF-S201 Water Flow Sensor (optional)
 * 
 * Wiring:
 * - Soil Moisture: GPIO 34 (ADC)
 * - DS18B20: GPIO 4 (OneWire)
 * - DHT22: GPIO 5
 * - Relay 1 (Pump): GPIO 16
 * - Relay 2 (Valve): GPIO 17
 * - Water Flow: GPIO 18 (Interrupt)
 * - NPK Sensor: GPIO 25 (RX), GPIO 26 (TX) - RS485
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <DHT.h>
#include <Preferences.h>

// ============== Configuration ==============
// WiFi Configuration
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// MQTT Configuration
const char* MQTT_SERVER = "YOUR_SERVER_IP";
const int MQTT_PORT = 1883;
const char* MQTT_USER = "mqtt_user";
const char* MQTT_PASSWORD = "mqtt_password";

// Device Configuration
// FIXED: FARM_ID added so topics match the server's expected format:
//   farm/{farmId}/sensor/{nodeId}  and  farm/{farmId}/device/{nodeId}/command
// Set FARM_ID to the exact farmId UUID shown in your dashboard URL.
String DEVICE_ID = "";              // Auto-set from MAC address — used as nodeId
const char* FARM_ID       = "YOUR_FARM_ID_UUID"; // ← replace with your farm UUID
const char* DEVICE_TYPE   = "soil_sensor";
const char* FIRMWARE_VERSION = "1.1.0";
const bool  USE_DUMMY_DATA   = true; // Set false when real sensors are wired

// ============== Pin Definitions ==============
#define SOIL_MOISTURE_PIN 34
#define ONEWIRE_PIN 4
#define DHT_PIN 5
#define RELAY_PUMP_PIN 16
#define RELAY_VALVE_PIN 17
#define WATER_FLOW_PIN 18

// Sensor calibration
#define SOIL_MOISTURE_DRY 4095   // ADC value when sensor is dry
#define SOIL_MOISTURE_WET 1500   // ADC value when sensor is wet

// ============== MQTT Topics ==============
// FIXED: Topics now match server's mqttHandler subscription: farm/+/sensor/#
// Server publishes commands to:                              farm/{farmId}/device/{nodeId}/command
String TOPIC_SENSOR_DATA;     // farm/{FARM_ID}/sensor/{DEVICE_ID}
String TOPIC_DEVICE_STATUS;   // farm/{FARM_ID}/status/{DEVICE_ID}
String TOPIC_COMMAND;         // farm/{FARM_ID}/device/{DEVICE_ID}/command
String TOPIC_IRRIGATION_ACK;  // farm/{FARM_ID}/device/{DEVICE_ID}/ack

// ============== Global Objects ==============
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
OneWire oneWire(ONEWIRE_PIN);
DallasTemperature tempSensor(&oneWire);
DHT dht(DHT_PIN, DHT22);
Preferences preferences;

// ============== Global Variables ==============
unsigned long lastSensorRead = 0;
unsigned long lastStatusUpdate = 0;
unsigned long lastReconnectAttempt = 0;

const unsigned long SENSOR_INTERVAL = 60000;      // Read sensors every 60 seconds
const unsigned long STATUS_INTERVAL = 300000;     // Send status every 5 minutes
const unsigned long RECONNECT_INTERVAL = 5000;    // Try reconnect every 5 seconds

bool irrigationActive = false;
unsigned long irrigationStartTime = 0;
unsigned long irrigationDuration = 0;
String currentScheduleId = "";

volatile unsigned long waterPulseCount = 0;
float waterFlowRate = 0;

// ============== Function Prototypes ==============
void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void publishSensorData();
void publishDeviceStatus();
void handleIrrigationCommand(JsonDocument& doc);
void controlPump(bool state);
void controlValve(bool state);
float readSoilMoisture();
float readSoilTemperature();
float readAirTemperature();
float readAirHumidity();
void IRAM_ATTR waterFlowISR();

// ============== Setup ==============
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n=== Smart Agri IoT ESP32 ===");
  Serial.printf("Firmware Version: %s\n", FIRMWARE_VERSION);
  
  // Generate device ID from MAC address
  uint8_t mac[6];
  WiFi.macAddress(mac);
  DEVICE_ID = String(mac[0], HEX) + String(mac[1], HEX) + String(mac[2], HEX) +
              String(mac[3], HEX) + String(mac[4], HEX) + String(mac[5], HEX);
  DEVICE_ID.toUpperCase();
  Serial.printf("Device ID: %s\n", DEVICE_ID.c_str());
  
  // Setup MQTT topics
  // FIXED: Was using "smart-agri/sensors/{id}/data" — server never received it.
  // Now aligned with server subscription: farm/+/sensor/# and farm/+/status/#
  // Command topic matches publishCommand(): farm/{farmId}/device/{nodeId}/command
  TOPIC_SENSOR_DATA    = "farm/" + String(FARM_ID) + "/sensor/" + DEVICE_ID;
  TOPIC_DEVICE_STATUS  = "farm/" + String(FARM_ID) + "/status/" + DEVICE_ID;
  TOPIC_COMMAND        = "farm/" + String(FARM_ID) + "/device/" + DEVICE_ID + "/command";
  TOPIC_IRRIGATION_ACK = "farm/" + String(FARM_ID) + "/device/" + DEVICE_ID + "/ack";
  
  // Initialize pins
  pinMode(RELAY_PUMP_PIN, OUTPUT);
  pinMode(RELAY_VALVE_PIN, OUTPUT);
  pinMode(WATER_FLOW_PIN, INPUT_PULLUP);
  
  // Ensure relays are off at startup
  digitalWrite(RELAY_PUMP_PIN, HIGH);  // Relay module is active LOW
  digitalWrite(RELAY_VALVE_PIN, HIGH);
  
  // Attach water flow interrupt
  attachInterrupt(digitalPinToInterrupt(WATER_FLOW_PIN), waterFlowISR, FALLING);
  
  // Initialize sensors
  tempSensor.begin();
  dht.begin();
  
  // Load saved preferences
  preferences.begin("smart-agri", false);
  
  // Setup WiFi
  setupWiFi();
  
  // Setup MQTT
  setupMQTT();
  
  Serial.println("Setup complete!");
}

// ============== Main Loop ==============
void loop() {
  // Maintain WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, reconnecting...");
    setupWiFi();
  }
  
  // Maintain MQTT connection
  if (!mqtt.connected()) {
    unsigned long now = millis();
    if (now - lastReconnectAttempt > RECONNECT_INTERVAL) {
      lastReconnectAttempt = now;
      reconnectMQTT();
    }
  } else {
    mqtt.loop();
  }
  
  // Read and publish sensor data periodically
  unsigned long now = millis();
  if (now - lastSensorRead >= SENSOR_INTERVAL) {
    lastSensorRead = now;
    publishSensorData();
  }
  
  // Publish device status periodically
  if (now - lastStatusUpdate >= STATUS_INTERVAL) {
    lastStatusUpdate = now;
    publishDeviceStatus();
  }
  
  // Handle active irrigation
  if (irrigationActive && irrigationDuration > 0) {
    if (millis() - irrigationStartTime >= irrigationDuration) {
      // Stop irrigation
      controlPump(false);
      controlValve(false);
      irrigationActive = false;
      
      // Send completion acknowledgment
      StaticJsonDocument<256> doc;
      doc["scheduleId"] = currentScheduleId;
      doc["status"] = "completed";
      doc["actualDuration"] = (millis() - irrigationStartTime) / 1000;
      doc["waterVolume"] = (waterPulseCount / 7.5);  // YF-S201: 7.5 pulses per liter
      
      char buffer[256];
      serializeJson(doc, buffer);
      mqtt.publish(TOPIC_IRRIGATION_ACK.c_str(), buffer);
      
      Serial.println("Irrigation completed");
      waterPulseCount = 0;
    }
  }
  
  delay(100);
}

// ============== WiFi Setup ==============
void setupWiFi() {
  Serial.printf("Connecting to WiFi: %s\n", WIFI_SSID);
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected!");
    Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("Signal Strength: %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\nWiFi connection failed!");
  }
}

// ============== MQTT Setup ==============
void setupMQTT() {
  mqtt.setServer(MQTT_SERVER, MQTT_PORT);
  mqtt.setCallback(mqttCallback);
  mqtt.setBufferSize(512);
}

void reconnectMQTT() {
  Serial.println("Connecting to MQTT...");
  
  String clientId = "ESP32-" + DEVICE_ID;
  
  if (mqtt.connect(clientId.c_str(), MQTT_USER, MQTT_PASSWORD)) {
    Serial.println("MQTT connected!");
    
    // Subscribe to command topic
    mqtt.subscribe(TOPIC_COMMAND.c_str());
    Serial.printf("Subscribed to: %s\n", TOPIC_COMMAND.c_str());
    
    // Publish online status
    publishDeviceStatus();
  } else {
    Serial.printf("MQTT connection failed, rc=%d\n", mqtt.state());
  }
}

// ============== MQTT Callback ==============
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("Message received on topic: %s\n", topic);
  
  // Parse JSON payload
  StaticJsonDocument<512> doc;
  DeserializationError error = deserializeJson(doc, payload, length);
  
  if (error) {
    Serial.printf("JSON parse error: %s\n", error.c_str());
    return;
  }
  
  // Handle irrigation commands
  if (String(topic) == TOPIC_COMMAND) {
    handleIrrigationCommand(doc);
  }
}

// ============== Command Handlers ==============
void handleIrrigationCommand(JsonDocument& doc) {
  String action = doc["action"].as<String>();
  
  if (action == "start") {
    int duration = doc["durationMinutes"].as<int>() * 60 * 1000;  // Convert to ms
    currentScheduleId = doc["scheduleId"].as<String>();
    
    Serial.printf("Starting irrigation for %d minutes\n", duration / 60000);
    
    // Reset water counter
    waterPulseCount = 0;
    
    // Start irrigation
    controlValve(true);
    delay(500);  // Wait for valve to open
    controlPump(true);
    
    irrigationActive = true;
    irrigationStartTime = millis();
    irrigationDuration = duration;
    
  } else if (action == "stop") {
    Serial.println("Stopping irrigation");
    
    controlPump(false);
    controlValve(false);
    irrigationActive = false;
    
    // Send acknowledgment
    StaticJsonDocument<256> doc;
    doc["scheduleId"] = currentScheduleId;
    doc["status"] = "cancelled";
    doc["actualDuration"] = (millis() - irrigationStartTime) / 1000;
    
    char buffer[256];
    serializeJson(doc, buffer);
    mqtt.publish(TOPIC_IRRIGATION_ACK.c_str(), buffer);
  }
}

// ============== Control Functions ==============
void controlPump(bool state) {
  digitalWrite(RELAY_PUMP_PIN, state ? LOW : HIGH);  // Active LOW relay
  Serial.printf("Pump: %s\n", state ? "ON" : "OFF");
}

void controlValve(bool state) {
  digitalWrite(RELAY_VALVE_PIN, state ? LOW : HIGH);  // Active LOW relay
  Serial.printf("Valve: %s\n", state ? "OPEN" : "CLOSED");
}

// ============== Sensor Reading Functions ==============
float readSoilMoisture() {
  int rawValue = analogRead(SOIL_MOISTURE_PIN);
  
  // Convert to percentage (inverted: lower ADC = more moisture)
  float percentage = map(rawValue, SOIL_MOISTURE_DRY, SOIL_MOISTURE_WET, 0, 100);
  percentage = constrain(percentage, 0, 100);
  
  return percentage;
}

float readSoilTemperature() {
  tempSensor.requestTemperatures();
  float temp = tempSensor.getTempCByIndex(0);
  
  if (temp == DEVICE_DISCONNECTED_C) {
    return -999;  // Sensor not connected
  }
  
  return temp;
}

float readAirTemperature() {
  float temp = dht.readTemperature();
  
  if (isnan(temp)) {
    return -999;
  }
  
  return temp;
}

float readAirHumidity() {
  float humidity = dht.readHumidity();
  
  if (isnan(humidity)) {
    return -999;
  }
  
  return humidity;
}

// ============== Data Publishing ==============
void publishSensorData() {
  Serial.println("Reading sensors...");

  float soilMoisture, soilTemp, airTemp, airHumidity;

  if (USE_DUMMY_DATA) {
    // Generate dummy data
    soilMoisture = random(200, 800) / 10.0;  // 20.0% to 80.0%
    soilTemp = random(200, 300) / 10.0;     // 20.0C to 30.0C
    airTemp = random(250, 350) / 10.0;      // 25.0C to 35.0C
    airHumidity = random(400, 700) / 10.0;  // 40.0% to 70.0%
    Serial.println("Using DUMMY DATA");
  } else {
    // Read real sensors
    soilMoisture = readSoilMoisture();
    soilTemp = readSoilTemperature();
    airTemp = readAirTemperature();
    airHumidity = readAirHumidity();
  }
  
  Serial.printf("Soil Moisture: %.1f%%\n", soilMoisture);
  Serial.printf("Soil Temperature: %.1f°C\n", soilTemp);
  Serial.printf("Air Temperature: %.1f°C\n", airTemp);
  Serial.printf("Air Humidity: %.1f%%\n", airHumidity);
  
  // Create JSON payload
  // FIXED: Field names now match server's SensorPayload interface in sensor.service.ts
  // Keys: soilMoisture, soilTemperature, airTemperature, airHumidity (not camelCase variants)
  StaticJsonDocument<512> doc;
  doc["deviceId"]  = DEVICE_ID;
  doc["farmId"]    = FARM_ID;
  doc["timestamp"] = millis();
  
  if (soilMoisture >= 0) {
    doc["soilMoisture"]    = round(soilMoisture * 10) / 10.0;
  }
  if (soilTemp > -900) {
    doc["soilTemperature"] = round(soilTemp * 10) / 10.0;
  }
  if (airTemp > -900) {
    doc["airTemperature"]  = round(airTemp * 10) / 10.0;
  }
  if (airHumidity > -900) {
    doc["airHumidity"]     = round(airHumidity * 10) / 10.0;
  }
  
  char buffer[512];
  serializeJson(doc, buffer);
  
  if (mqtt.publish(TOPIC_SENSOR_DATA.c_str(), buffer)) {
    Serial.println("Sensor data published");
  } else {
    Serial.println("Failed to publish sensor data");
  }
}

void publishDeviceStatus() {
  StaticJsonDocument<256> doc;
  doc["deviceId"] = DEVICE_ID;
  doc["deviceType"] = DEVICE_TYPE;
  doc["status"] = "active";
  doc["firmwareVersion"] = FIRMWARE_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["uptime"] = millis() / 1000;
  doc["freeHeap"] = ESP.getFreeHeap();
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  mqtt.publish(TOPIC_DEVICE_STATUS.c_str(), buffer);
  Serial.println("Device status published");
}

// ============== Interrupt Service Routine ==============
void IRAM_ATTR waterFlowISR() {
  waterPulseCount++;
}
