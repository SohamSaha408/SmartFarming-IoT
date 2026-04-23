// IMPROVED:
// 1. Fixed publishCommand to use dynamic topic (was hardcoded to farm_001/node_a1)
// 2. Added exponential backoff on reconnect instead of flat 1s
// 3. Graceful JSON parse error handling — bad payloads no longer crash the handler
// 4. Device status updates (last_seen) on status topic messages
// 5. Exported getClient() for external health-check usage

import mqtt from 'mqtt';
import { logger } from '../utils/logger';
import { saveSensorData } from '../services/sensor.service';
import { processSensorData } from '../services/automation.service';
import { emitSensorReading, emitDeviceStatus } from '../websocket/socketHandler';
import IoTDevice from '../models/IoTDevice.model';

let client: mqtt.MqttClient;
let reconnectDelay = 1000; // ms — doubles on each failed attempt, max 30s

export const initMQTT = () => {
    const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
    const username  = process.env.MQTT_USERNAME;
    const password  = process.env.MQTT_PASSWORD;

    logger.info(`Connecting to MQTT Broker at ${brokerUrl}...`);

    client = mqtt.connect(brokerUrl, {
        username,
        password,
        clientId: `server_${Math.random().toString(16).substring(2, 8)}`,
        clean: true,
        connectTimeout: 6000,
        reconnectPeriod: 0, // We manage reconnect manually for backoff
    });

    client.on('connect', () => {
        reconnectDelay = 1000; // Reset backoff on successful connect
        logger.info('✅ MQTT Connected');

        client.subscribe('farm/+/sensor/#', (err) => {
            if (!err) logger.info('Subscribed to farm/+/sensor/#');
            else logger.error('Subscribe error (sensor)', err);
        });

        client.subscribe('farm/+/status/#', (err) => {
            if (!err) logger.info('Subscribed to farm/+/status/#');
            else logger.error('Subscribe error (status)', err);
        });
    });

    client.on('message', async (topic, message) => {
        // IMPROVED: Graceful JSON parse — malformed payloads won't crash the server
        let payload: any;
        try {
            payload = JSON.parse(message.toString());
        } catch {
            logger.warn(`Non-JSON MQTT message on topic [${topic}]: ${message.toString().substring(0, 80)}`);
            return;
        }

        logger.debug(`MQTT Message [${topic}]:`, payload);

        try {
            await handleMessage(topic, payload);
        } catch (error) {
            logger.error('Error processing MQTT message', error);
        }
    });

    // IMPROVED: Exponential backoff reconnect (max 30s)
    client.on('close', () => {
        logger.warn(`MQTT Connection Closed. Reconnecting in ${reconnectDelay / 1000}s...`);
        setTimeout(() => {
            reconnectDelay = Math.min(reconnectDelay * 2, 30000);
            client.reconnect();
        }, reconnectDelay);
    });

    client.on('error', (err) => {
        logger.error('MQTT Connection Error', err);
    });

    return client;
};

// Expose client for health checks
export const getClient = (): mqtt.MqttClient | undefined => client;

const handleMessage = async (topic: string, payload: any) => {
    const parts = topic.split('/');

    if (parts.length >= 4 && parts[2] === 'sensor') {
        const farmId = parts[1];
        const nodeId = parts[3];

        await saveSensorData(farmId, nodeId, payload);
        await processSensorData(farmId, nodeId, payload);

        // 🔴 Live push — all browser clients subscribed to this farm get the reading instantly
        emitSensorReading(farmId, nodeId, payload);

        logger.info(`Sensor data processed — Farm: ${farmId}, Node: ${nodeId}`);
    }

    if (parts.length >= 4 && parts[2] === 'status') {
        const deviceId = parts[3];
        const status   = payload?.status || payload?.state;

        if (deviceId && status) {
            const device = await IoTDevice.findOne({ where: { deviceId } });
            if (device) {
                await device.update({ lastSeenAt: new Date(), status });
                // Push device status change live to browser
                emitDeviceStatus(device.farmId, deviceId, status);
                logger.info(`Device status updated: ${deviceId} → ${status}`);
            }
        }
    }
};

// IMPROVED: publishCommand now uses actual dynamic farm/device topic
export const publishCommand = (
    farmId: string,
    deviceId: string,
    command: string,
    payload: any
) => {
    if (!client || !client.connected) {
        logger.error('Cannot publish: MQTT client not connected');
        return;
    }

    // Dynamic topic built from real farmId + deviceId (was hardcoded before)
    const topic   = `farm/${farmId}/device/${deviceId}/command`;
    const message = JSON.stringify({ action: command, ...payload, timestamp: Date.now() });

    client.publish(topic, message, { qos: 1 }, (err) => {
        if (err) logger.error(`Publish error on ${topic}`, err);
        else     logger.info(`Command [${command}] sent to ${topic}`);
    });
};
