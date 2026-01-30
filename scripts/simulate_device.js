const mqtt = require('mqtt');

// Configuration
// Using localhost because this script runs on the host machine
const BROKER_URL = 'mqtt://localhost:1883';
const FARM_ID = process.env.FARM_ID || 'default-farm';
const DEVICE_ID = process.env.DEVICE_ID || 'sim-device-01';

console.log(`Connecting to MQTT broker at ${BROKER_URL}...`);

const client = mqtt.connect(BROKER_URL, {
    clientId: 'simulator_' + Math.random().toString(16).substr(2, 8),
});

client.on('connect', () => {
    console.log('✅ Connected to MQTT broker!');
    console.log(`🚀 Simulating device: ${DEVICE_ID} for Farm: ${FARM_ID}`);
    console.log('Press Ctrl+C to stop.');

    // Publish status online
    client.publish(`farm/${FARM_ID}/status/${DEVICE_ID}`, JSON.stringify({ status: 'online' }));

    // Start data loop
    setInterval(publishData, 3000); // Every 3 seconds
});

client.on('error', (err) => {
    console.error('❌ MQTT Connection Error:', err.message);
});

function publishData() {
    // Simulate sensor readings
    const temp = (20 + Math.random() * 10).toFixed(1); // 20-30°C
    const humidity = (40 + Math.random() * 20).toFixed(1); // 40-60%
    const soilMoisture = (30 + Math.random() * 40).toFixed(1); // 30-70%
    const light = Math.floor(200 + Math.random() * 800); // 200-1000 lux

    // Topic structure: farm/{farmId}/sensor/{nodeId}
    const topic = `farm/${FARM_ID}/sensor/${DEVICE_ID}`;

    // Payload matching what the server expects (or general structure)
    // Based on mqttHandler.ts logs: { type: 'soil', value: 30, unit: '%' }
    // Sending a combined payload or individual? Handler logs "payload", implies one object.
    // Let's send a comprehensive object which the server (if updated) or future implementation can handle.
    // Or send individual messages if the server expects specific types. 
    // The handler says: `if (parts[2] === 'sensor') ... logger.info(..., payload)`
    // It doesn't strictly validate structure yet, so a rich object is fine.

    const payload = {
        temperature: parseFloat(temp),
        humidity: parseFloat(humidity),
        soil_moisture: parseFloat(soilMoisture),
        light_level: light,
        timestamp: new Date().toISOString()
    };

    client.publish(topic, JSON.stringify(payload));

    // Also publish specific standard topics if useful for individual components
    // client.publish(`farm/${FARM_ID}/sensor/${DEVICE_ID}/temperature`, JSON.stringify({ value: temp, unit: 'C' }));

    console.log(`[${new Date().toLocaleTimeString()}] Sent data to ${topic}:`, payload);
}
