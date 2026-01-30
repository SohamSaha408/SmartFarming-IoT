# 🌱 IoT Smart Agriculture Platform

A production-ready IoT platform for precision agriculture, featuring real-time monitoring, automated irrigation, and intelligent alerts.

![Dashboard Preview](https://placehold.co/800x400?text=Predictive+Agri+Dashboard)

## 🚀 Key Features

- **Real-time Monitoring**: Live data from soil moisture, temperature, humidity, and light sensors.
- **Automated Irrigation**: Smart watering logic based on soil moisture thresholds and time of day.
- **MQTT Integration**: Reliable machine-to-machine communication using Eclipse Mosquitto.
- **Interactive Dashboard**: Modern React + TypeScript frontend with charts and maps.
- **Alert System**: Immediate notifications for critical conditions (e.g., low moisture, high temp).
- **Scalable Architecture**: Dockerized services ready for deployment.

## 📦 Project Structure

```
smart-agri-iot/
├── server/          # Backend API & MQTT Handler (Node.js/TS)
├── client/          # Frontend Dashboard (React/TS)
├── iot/             # ESP32 Firmware (Arduino/C++)
├── mosquitto/       # MQTT Broker Configuration
└── docker-compose.yml
```

## 🛠️ Tech Stack

- **Hardware**: ESP32, Capacitive Soil Moisture Sensor, DHT22, BH1750.
- **Firmware**: Arduino C++, PubSubClient.
- **Backend**: Node.js, Express, TypeScript, Sequelize, PostgreSQL.
- **Frontend**: React, Tailwind CSS, Recharts, Socket.IO.
- **Infrastructure**: Docker, Docker Compose, Mosquitto MQTT.

## 🏁 Quick Start

1. **Clone & Config**:
   ```bash
   cp .env.example .env
   # Edit .env if needed
   ```

2. **Launch Services**:
   ```bash
   docker-compose up -d
   ```

3. **Upload Firmware**:
   - Open `iot/firmware/smart_agri_node/smart_agri_node.ino` in Arduino IDE.
   - configure `config.h`.
   - Upload to ESP32.

4. **Access**:
   - Dashboard: http://localhost
   - API Docs: http://localhost:3000/docs (if enabled)

## 📖 Documentation

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed setup instructions.
