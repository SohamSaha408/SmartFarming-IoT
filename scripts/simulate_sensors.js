
const mqtt = require('mqtt');

// Configuration from your C++ config.h
const MQTT_BROKER = "mqtts://b27eb4515006479e92387879c5b81538.s1.eu.hivemq.cloud:8883";
const MQTT_USER = "Soham";
const MQTT_PASS = "Remy_Lebeau1";
const DEVICE_ID = "node_a1";

// NOTE: We need the FARM_ID you *just* assigned it to. 
// If you don't know it, we will default to 'farm_001' but the server might ignore it 
// if the device belongs to a different farm ID in the DB.
// HOWEVER: The server logic usually cares about the Valid Device ID more than the topic farm ID 
// (depending on implementation). Let's try sending to a generic topic or fetch it.
// 
// Looking at server/src/mqtt/mqttHandler.ts logic would confirm, but usually:
// Topic: farm/{farm_id}/sensor/{device_id}

// Let's assume the user assigned it to a farm. The topic structure requires a Farm ID.
// We will query the DB to get the correct Farm ID for this device causing the data to appear.
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: 'd:/smart-agri-iot/server/.env' });

async function getFarmId() {
    const dbUrl = process.env.DATABASE_URL;
    let sequelize;
    if (dbUrl) {
        sequelize = new Sequelize(dbUrl, {
            dialect: 'postgres',
            logging: false,
            dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
        });
    } else {
        sequelize = new Sequelize(
            process.env.DB_NAME || 'smart_agri',
            process.env.DB_USER || 'postgres',
            process.env.DB_PASSWORD || 'smartagri123',
            {
                host: process.env.DB_HOST || 'localhost',
                dialect: 'postgres',
                logging: false,
            }
        );
    }

    try {
        const [results] = await sequelize.query(`
            SELECT farm_id FROM iot_devices WHERE device_id = '${DEVICE_ID}'
        `);
        await sequelize.close();
        if (results.length > 0) return results[0].farm_id;
        return 'farm_001'; // Fallback
    } catch (e) {
        return 'farm_001';
    }
}

async function startSimulation() {
    console.log('Fetching Farm ID...');
    const farmId = await getFarmId();
    console.log(`Targeting Farm ID: ${farmId}`);

    const client = mqtt.connect(MQTT_BROKER, {
        username: MQTT_USER,
        password: MQTT_PASS,
        rejectUnauthorized: false
    });

    client.on('connect', () => {
        console.log('✅ Connected to MQTT Broker');
        console.log('🚀 Sending simulated sensor data every 5 seconds...');
        console.log('   (Press Ctrl+C to stop)');

        setInterval(() => {
            // Create wild fluctuations for dramatic demonstration
            const data = {
                type: "sensor_reading",
                soilMoisture: (Math.random() * (95 - 10) + 10).toFixed(1), // Widely fluctuate between 10% and 95%
                airTemperature: (Math.random() * (45 - 10) + 10).toFixed(1), // Fluctuate between 10C and 45C
                airHumidity: (Math.random() * (90 - 30) + 30).toFixed(1), // 30-90%
                lightIntensity: (Math.random() * (2000 - 100) + 100).toFixed(0) // 100-2000 lux
            };

            const topic = `farm/${farmId}/sensor/${DEVICE_ID}`;
            client.publish(topic, JSON.stringify(data));

            console.log(`📤 Sent: Moisture=${data.soilMoisture}%, Temp=${data.airTemperature}C to ${topic}`);
        }, 5000);
    });

    client.on('error', (err) => {
        console.error('❌ MQTT Error:', err);
    });
}

startSimulation();
