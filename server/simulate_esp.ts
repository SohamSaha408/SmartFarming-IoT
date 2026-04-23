
import mqtt from 'mqtt';
import dotenv from 'dotenv';
dotenv.config(); // Use correct .env

const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
const USERNAME = process.env.MQTT_USERNAME;
const PASSWORD = process.env.MQTT_PASSWORD;

// Use a known existing farm and device (or random ones)
// Based on seed_farmers.ts, we need a farm first. 
// But backend might auto-reject if device not found.
// We'll use a random UUID and see if backend logs "unknown device" warning (which verifies it received it)
// OR using the bypass login output, we saw user ID. 

const FARM_ID = '123e4567-e89b-12d3-a456-426614174000'; // Dummy Farm UUID
const NODE_ID = 'TEST_ESP32_NODE'; // This will be the "deviceId" in topic

console.log(`Connecting to ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
    username: USERNAME,
    password: PASSWORD
});

client.on('connect', () => {
    console.log('✅ Connected to MQTT Broker');

    // Topic: farm/{farmId}/sensor/{nodeId}
    const topic = `farm/${FARM_ID}/sensor/${NODE_ID}`;

    // Simulate data every 5 seconds
    setInterval(() => {
        const payload = {
            deviceId: NODE_ID, // Matches hardware ID
            timestamp: Date.now(),
            soilMoisture: parseFloat((Math.random() * (80 - 20) + 20).toFixed(1)),
            soilTemperature: parseFloat((Math.random() * (30 - 20) + 20).toFixed(1)),
            airTemperature: parseFloat((Math.random() * (35 - 25) + 25).toFixed(1)),
            airHumidity: parseFloat((Math.random() * (70 - 40) + 40).toFixed(1))
        };

        console.log(`Publishing to ${topic}:`, payload);
        client.publish(topic, JSON.stringify(payload));

    }, 5000);
});

client.on('error', (err) => {
    console.error('MQTT Error:', err);
});
