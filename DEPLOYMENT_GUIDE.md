# IoT Smart Agriculture Platform - Deployment Guide

This guide will walk you through setting up the complete IoT Smart Agriculture Platform, including the server, database, MQTT broker, and ESP32 hardware.

## Prerequisites

- **Docker & Docker Compose**: For running the server services.
- **Node.js 18+ & npm**: For local development (optional).
- **Arduino IDE**: For flashing the ESP32 firmware.
- **Hardware**: ESP32, Sensors (DHT22, Soil Moisture, etc.).

## 1. Environment Setup

Copy the example environment file and configure your secrets:

```bash
cp .env.example .env
```

Open `.env` and configure the following:

- `DB_PASSWORD`: Password for PostgreSQL database.
- `JWT_SECRET`: Secret key for authentication tokens.
- `MQTT_USERNAME` / `MQTT_PASSWORD`: Credentials for MQTT devices.
- `IOT_FARM_ID`: Unique ID for your farm.

## 2. Server Deployment (Docker)

The easiest way to run the platform is using Docker Compose.

```bash
# Build and start all services
docker-compose up -d --build
```

This will start:
- **Client**: http://localhost (Frontend Dashboard)
- **Server**: http://localhost:3000 (API)
- **Mosquitto**: Port 1883 (MQTT), 9001 (WebSockets)
- **PostgreSQL**: Port 5432 (Database)
- **Redis**: Port 6379 (Caching)

Check logs:
```bash
docker-compose logs -f
```

## 3. Hardware Setup (ESP32)

### Wiring Diagram

| ESP32 Pin | Component | Description |
|-----------|-----------|-------------|
| 3V3       | VCC       | Power for sensors |
| GND       | GND       | Ground |
| D32       | AOUT      | Capacitive Soil Moisture Sensor |
| D4        | DAT       | DHT22 / DHT11 Data |
| D21       | SDA       | BH1750 SDA (I2C) |
| D22       | SCL       | BH1750 SCL (I2C) |
| D5        | IN        | Relay Module (Pump) |
| D2        | LED       | Built-in LED (Status) |

### Firmware Upload

1. Open `iot/firmware/smart_agri_node/smart_agri_node.ino` in Arduino IDE.
2. Install required libraries via Library Manager:
   - `PubSubClient` by Nick O'Leary
   - `ArduinoJson` by Benoit Blanchon
   - `DHT sensor library` by Adafruit
   - `BH1750` by Christopher Laws
3. Update `iot/firmware/smart_agri_node/config.h` with your WiFi and MQTT settings.
4. Select your board (e.g., "DOIT ESP32 DEVKIT V1") and port.
5. Click **Upload**.

## 4. Verification

1. Monitor the Serial Output (115200 baud) on the ESP32. It should connect to WiFi and MQTT.
2. Open the Dashboard at http://localhost.
3. Login (Default: `admin@smartagri.com` / `admin123` - *You may need to seed the DB first*).
4. Verify that sensor data is streaming in real-time.

## Troubleshooting

- **MQTT Connection Failed**: Check if Mosquitto is running and port 1883 is accessible. Ensure credentials match.
- **Database Connection Error**: Ensure PostgreSQL container is healthy (`docker-compose ps`).
- **No Data**: Check wiring and ensure ESP32 is publishing to `farm/{farm_id}/sensor`.

## 5. Daily Usage (Start/Stop)

### How to Stop
To shut down the entire platform (server, database, dashboard):
```bash
docker-compose down
```

### How to Restart
To start everything up again:
```bash
docker-compose up -d
```
The data (farms, users, devices) is persisted in the database volume, so it will be there when you restart.
