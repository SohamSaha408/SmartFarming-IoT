import mqtt from 'mqtt';
import { logger } from '../utils/logger';

// TODO: Import services for data storage and alerts
import { saveSensorData } from '../services/sensor.service';
// import { checkAlerts } from '../services/alert.service';

let client: mqtt.MqttClient;

export const initMQTT = () => {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    const username = process.env.MQTT_USERNAME;
    const password = process.env.MQTT_PASSWORD;

    logger.info(`Connecting to MQTT Broker at ${brokerUrl}...`);

    client = mqtt.connect(brokerUrl, {
        username,
        password,
        clientId: `server_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    });

    client.on('connect', () => {
        logger.info('✅ MQTT Connected');

        // Subscribe to all farm sensor topics
        // Topic format: farm/{farmId}/sensor/{nodeId}/{sensorType}
        const topic = 'farm/+/sensor/#';

        client.subscribe(topic, (err) => {
            if (!err) {
                logger.info(`Subscribed to ${topic}`);
            } else {
                logger.error('Failed to subscribe', err);
            }
        });

        // Subscribe to device status
        client.subscribe('farm/+/status/#', (err) => {
            if (!err) logger.info('Subscribed to device status topics');
        });
    });

    client.on('message', async (topic, message) => {
        try {
            const payload = JSON.parse(message.toString());
            logger.debug(`MQTT Message [${topic}]:`, payload);

            // Handle message based on topic structure
            await handleMessage(topic, payload);

        } catch (error) {
            logger.error('Error processing MQTT message', error);
        }
    });

    client.on('error', (err) => {
        logger.error('MQTT Connection Error', err);
    });

    client.on('close', () => {
        logger.warn('MQTT Connection Closed');
    });

    return client;
};

const handleMessage = async (topic: string, payload: any) => {
    const parts = topic.split('/');
    // Expected: farm / {farmId} / sensor / {nodeId}

    if (parts.length >= 4 && parts[2] === 'sensor') {
        const farmId = parts[1];
        const nodeId = parts[3]; // The generic "sensor" topic might just be specific to the node

        // This logic adapts to: farm/{farmId}/sensor/{nodeId}
        // Payload should contain: { type: 'soil', value: 30, unit: '%' } or similar

        // Data persistence
        await saveSensorData(farmId, nodeId, payload);

        // Placeholder for alert checking
        // await checkAlerts(farmId, nodeId, payload);

        logger.info(`Received sensor data from Farm ${farmId}, Node ${nodeId}:`, payload);
    }

    if (parts.length >= 4 && parts[2] === 'status') {
        const farmId = parts[1];
        const deviceId = parts[3];
        logger.info(`Device status update: ${farmId}/${deviceId}`, payload);
        // Update device last_seen
    }
};

export const publishCommand = (farmId: string, deviceId: string, command: string, payload: any) => {
    if (!client || !client.connected) {
        logger.error('Cannot publish: MQTT client not connected');
        return;
    }

    const topic = `farm/${farmId}/device/${deviceId}/command`;
    const message = JSON.stringify({ command, ...payload });

    client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) logger.error('Publish error', err);
        else logger.info(`Command sent to ${topic}: ${command}`);
    });
};
