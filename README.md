# 🌱 IoT Smart Agriculture Platform

A production-ready, full-stack IoT platform designed for precision agriculture. This system enables real-time monitoring of soil and environmental conditions, automated irrigation control, and intelligent data-driven insights to optimize crop yield and resource usage.

---

## 📋 Table of Contents

- [Introduction](#introduction)
- [Key Features](#-key-features)
- [System Architecture](#-system-architecture)
- [Technology Stack](#-technology-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Environment Configuration](#environment-configuration)
  - [Docker Deployment (Recommended)](#docker-deployment-recommended)
  - [Local Development Setup](#local-development-setup)
- [Hardware Setup](#-hardware-setup)
  - [Wiring Diagram](#wiring-diagram)
  - [Firmware Installation](#firmware-installation)
- [Usage Guide](#-usage-guide)
- [API Endpoints](#-api-endpoints)
- [Troubleshooting](#-troubleshooting)

---

## 📖 Introduction

The IoT Smart Agriculture Platform addresses the challenges of modern farming by providing a centralized dashboard to monitor and control farm operations. By integrating low-cost ESP32 hardware with a robust cloud-native backend, farmers can:
- Reduce water wastage through precision irrigation.
- Monitor critical metrics like Soil Moisture, Temperature, Humidity, and Light Intensity.
- receive instant alerts for adverse conditions.
- Manage multiple farms and crops efficiently.

## 🚀 Key Features

*   **Real-time Monitoring**: Stream live sensor data via MQTT (Soil Moisture, Temperature, Humidity, Light).
*   **Automated Irrigation**: Intelligent control of water pumps based on sensor thresholds or schedules.
*   **Farm & Crop Management**: Organize devices by Farm > Crop for granular tracking.
*   **Interactive Dashboard**: A modern, responsive React UI with dynamic charts, maps, and device status indicators.
*   **Alert System**: Instant notifications for critical events (e.g., "Soil Moisture Low", "High Temperature").
*   **Data Analytics**: Historical data visualization to analyze trends and improve decision-making.
*   **Secure Authentication**: JWT-based user authentication and role-based access control.
*   **Scalable Infrastructure**: Containerized microservices architecture using Docker and Docker Compose.

## 🏗 System Architecture

The system follows a standard IoT architecture:

1.  **Edge Layer (ESP32)**: Collects sensor data and controls actuators (pumps/relays). Communicates via MQTT.
2.  **Broker Layer (Mosquitto)**: Handles message queuing and delivery between devices and the server.
3.  **Application Layer (Node.js/Express)**: Processes data, handles API requests, manages business logic, and persists data.
4.  **Data Layer (PostgreSQL/Redis)**: reliable SQL storage for persistent data and Redis for caching/session management.
5.  **Presentation Layer (React)**: User interface for visualization and control.

## 🛠 Technology Stack

| Category | Technology | Description |
| :--- | :--- | :--- |
| **Hardware** | ESP32 | Low-cost Wi-Fi/Bluetooth microcontroller |
| | Sensors | Capacitive Soil Moisture, DHT22 (Temp/Hum), BH1750 (Light) |
| **Firmware** | C++ / Arduino | Logic running on the ESP32 |
| | PubSubClient | MQTT Client for Arduino |
| **Backend** | Node.js & TypeScript | Server functionality |
| | Express.js | Web framework |
| | Sequelize | ORM for PostgreSQL |
| | MQTT.js | MQTT client for Node.js |
| **Frontend** | React & TypeScript | UI Framework |
| | Tailwind CSS | Utility-first CSS framework |
| | Recharts | Composable charting library |
| | React-Leaflet | Maps integration |
| **Database** | PostgreSQL | Primary relational database |
| | Redis | In-memory data structure store (Caching) |
| **DevOps** | Docker | Containerization |
| | Mosquitto | Open source MQTT broker |

## 📂 Project Structure

```bash
smart-agri-iot/
├── client/                 # Frontend React Application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Application pages
│   │   └── services/       # API integration services
│   └── Dockerfile
├── server/                 # Backend Node.js API
│   ├── src/
│   │   ├── config/         # Database & App config
│   │   ├── models/         # Sequelize Models
│   │   ├── routes/         # API Routes
│   │   ├── controllers/    # Request handlers
│   │   └── services/       # Business logic (MQTT, etc.)
│   └── Dockerfile
├── iot/                    # Hardware Code
│   └── firmware/           # ESP32 Firmware sketches
├── mosquitto/              # MQTT Broker Configuration
├── scripts/                # Utility scripts (Seeding, testing)
└── docker-compose.yml      # Orchestration for all services
```

---

## 🏁 Getting Started

### Prerequisites

*   [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.
*   [Git](https://git-scm.com/) version control.
*   (Optional) [Node.js](https://nodejs.org/) v18+ for local development.

### Environment Configuration

1.  Clone the repository:
    ```bash
    git clone https://github.com/yourusername/smart-agri-iot.git
    cd smart-agri-iot
    ```

2.  Create the `.env` file from the example:
    ```bash
    cp .env.example .env
    ```

3.  **Important**: Update the `.env` file with your specific configuration (Database passwords, Secret keys, etc.).

### Docker Deployment (Recommended)

This is the fastest way to get the full system running.

1.  Build and start the containers:
    ```bash
    docker-compose up -d --build
    ```

2.  Check the logs to ensure everything started correctly:
    ```bash
    docker-compose logs -f
    ```

3.  Access the services:
    *   **Dashboard**: [http://localhost](http://localhost)
    *   **API Server**: [http://localhost:3000](http://localhost:3000)
    *   **PostgreSQL**: Port `5432`
    *   **MQTT Broker**: Port `1883`

### Local Development Setup

If you prefer to run services individually without Docker (except maybe the DB/Broker):

1.  **Install Dependencies**:
    ```bash
    # Root (installs for both client & server if configured in workspaces, else install individually)
    npm install
    
    # Or manually:
    cd server && npm install
    cd ../client && npm install
    ```

2.  **Start Database & MQTT**:
    You can still use Docker for infrastructure dependencies:
    ```bash
    docker-compose up -d postgres redis mosquitto
    ```

3.  **Start Server**:
    ```bash
    cd server
    npm run dev
    ```

4.  **Start Client**:
    ```bash
    cd client
    npm run dev
    ```

---

## 🔌 Hardware Setup

### Wiring Diagram

Connect your sensors to the ESP32 as follows:

| Component | ESP32 Pin | Description |
| :--- | :--- | :--- |
| **Soil Moisture** | GPIO 32 (ADC) | Capacitive analog output |
| **DHT22** | GPIO 4 | Temperature & Humidity Data |
| **BH1750** | GPIO 21 (SDA), 22 (SCL) | I2C Light Sensor |
| **Relay** | GPIO 5 | Controls water pump |
| **Status LED** | GPIO 2 | Built-in LED for connectivity status |

### Firmware Installation

1.  **Install Arduino IDE**: Download from [arduino.cc](https://www.arduino.cc/en/software).
2.  **Install Libraries**: In Arduino Library Manager, install:
    *   `PubSubClient` (for MQTT)
    *   `ArduinoJson`
    *   `DHT sensor library`
    *   `BH1750`
3.  **Open Firmware**: Open `iot/firmware/smart_agri_node/smart_agri_node.ino`.
4.  **Configure**: Edit `config.h` (or the top of the main file) to set:
    *   WiFi SSID & Password
    *   MQTT Broker IP (Your computer's IP address if running locally)
    *   Device ID (Must match a device registered in the dashboard)
5.  **Upload**: Connect ESP32 via USB and click Upload.

---

## 💻 Usage Guide

1.  **Registration**: Open the dashboard and sign up for a new account.
2.  **Create a Farm**: Go to the "Farms" section and add a new farm location.
3.  **Add a Device**:
    *   Go to "Devices".
    *   Click "Add Device".
    *   Enter a unique **Device ID** (e.g., `node_01`). This MUST match the ID in your ESP32 firmware.
    *   Select the Farm and Crop associated with this device.
4.  **Monitor**: View the dashboard to see live data streaming from your active devices.
5.  **Control**: Use the manual toggle in the device view to turn the irrigation pump on/off remotely.

---

## 📡 API Endpoints

The backend provides a RESTful API. Common endpoints include:

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **AUTH** | | |
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | Login and receive JWT |
| **FARMS** | | |
| `GET` | `/api/farms` | Get all farms for user |
| `POST` | `/api/farms` | Create a new farm |
| **DEVICES** | | |
| `GET` | `/api/devices` | Get all devices |
| `POST` | `/api/devices` | Register a new device |
| `GET` | `/api/devices/:id/telemetry` | Get historical sensor data |

---

## 🔧 Troubleshooting

*   **ESP32 not connecting to MQTT**:
    *   Ensure your firewall allows port `1883`.
    *   Check that the ESP32 and Server are on the same network.
    *   Verify the IP address in the firmware matches the PC running the broker.
*   **Database Connection Refused**:
    *   Ensure the Postgres container is running.
    *   Check `.env` credentials match `docker-compose.yml`.
*   **"Route not found" on Frontend**:
    *   Ensure the API URL in `client/.env` points to the correct backend address.

---

## 🤝 Contributing

Contributions are welcome! Please fork the repository and submit a pull request for any features, bug fixes, or documentation improvements.

## 📄 License

This project is licensed under the MIT License.
