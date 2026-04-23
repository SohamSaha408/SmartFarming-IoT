# System Architecture Block Diagram

Below is a complete representation of your Smart Agriculture IoT application architecture, spanning from the hardware edge to the external cloud services.

```mermaid
graph TD
    %% Define Styles
    classDef hardware fill:#f9d0c4,stroke:#333,stroke-width:2px;
    classDef cloud fill:#d4e5ff,stroke:#333,stroke-width:2px;
    classDef backend fill:#e1d5e7,stroke:#333,stroke-width:2px;
    classDef external fill:#d5e8d4,stroke:#333,stroke-width:2px;
    classDef frontend fill:#ffe6cc,stroke:#333,stroke-width:2px;

    %% IoT Hardware Layer
    subgraph Edge["1. Edge Hardware (Farm Field)"]
        direction LR
        Sensors["Sensor Node<br/>ESP32 + Moisture/DHT22"]:::hardware
        Actuators["Actuator Node<br/>ESP32 + Relays/Pumps"]:::hardware
    end

    %% Communication
    MQTTBroker(("2. MQTT Broker<br/>(Mosquitto / HiveMQ)")):::cloud

    %% Link IoT to Broker
    Sensors --"Telemetry Data<br/>(JSON)"--> MQTTBroker
    MQTTBroker --"Actuation Commands<br/>(START/STOP)"--> Actuators

    %% Backend Services
    subgraph Backend["3. Central Cloud Backend (Node.js/Express)"]
        API["Core API Controllers"]:::backend
        
        subgraph Microservices ["Business Logic Services"]
            Auth["🔒 Auth/JWT Service"]:::backend
            Auto["⚙️ Automation Service<br/>(Dynamic Thresholds)"]:::backend
            SatService["🛰️ Satellite Service"]:::backend
            Notif["📧 Notification Service"]:::backend
        end
        
        API --- Auth
        API --- Auto
        API --- SatService
        API --- Notif
    end

    %% Link Broker to Backend
    MQTTBroker --"Triggers Processing"--> Auto
    Sensors -.-> Auto

    %% Databases
    subgraph Data["4. Data Persistence Storage"]
        PG[("PostgreSQL<br/>(NeonDB Relational)")]:::cloud
        Redis[("Redis / Cache<br/>(Session/Rate Limits)")]:::cloud
    end

    %% Link Backend to DB
    API --> PG
    API --> Redis
    Auto --> PG

    %% External Services
    subgraph External["5. External Cloud APIs"]
        Agro["Agromonitoring API<br/>(Live NDVI Tiles)"]:::external
        Weather["OpenMeteo API<br/>(Weather Forecasting)"]:::external
        Twilio["Twilio<br/>(SMS Alert System)"]:::external
        SendGrid["SendGrid<br/>(Email Alert Delivery)"]:::external
    end

    %% Link Backend to External
    SatService --"Requests Satellite Imagery"--> Agro
    SatService --"Requests Weather"--> Weather
    Notif --"Triggers SMS"--> Twilio
    Notif --"Triggers Emails"--> SendGrid

    %% Presentation Layer
    subgraph Client["6. Presentation Layer"]
        ReactUI["React Web Dashboard<br/>(Browser GUI)"]:::frontend
    end

    %% Link Frontend to Backend
    ReactUI --"HTTPS REST API Calls"--> API
    ReactUI --"Receives UI Updates"-.-> Notif

```

### How to use this for your PowerPoint
Because this is written in "Mermaid" syntax, it will automatically render into a beautiful, colorful visual flowchart right inside this interface.
You can take a screenshot of the rendered diagram directly below, or if your presentation software supports it, you can simply paste the diagram image!
