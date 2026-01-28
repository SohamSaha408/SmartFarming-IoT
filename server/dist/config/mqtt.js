"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOPICS = exports.getMQTTClient = exports.sendIrrigationCommand = exports.publishMessage = exports.initMQTT = void 0;
const mqtt_1 = __importDefault(require("mqtt"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
let client = null;
const TOPICS = {
    SENSOR_DATA: 'smart-agri/sensors/+/data',
    DEVICE_STATUS: 'smart-agri/devices/+/status',
    IRRIGATION_COMMAND: 'smart-agri/irrigation/+/command',
    IRRIGATION_ACK: 'smart-agri/irrigation/+/ack',
    DEVICE_REGISTER: 'smart-agri/devices/register'
};
exports.TOPICS = TOPICS;
const initMQTT = () => {
    const options = {
        clientId: `smart-agri-server-${Date.now()}`,
        clean: true,
        connectTimeout: 4000,
        reconnectPeriod: 1000,
    };
    if (process.env.MQTT_USERNAME && process.env.MQTT_PASSWORD) {
        options.username = process.env.MQTT_USERNAME;
        options.password = process.env.MQTT_PASSWORD;
    }
    const rawBrokerUrl = process.env.MQTT_BROKER_URL;
    const fallbackUrl = 'mqtt://localhost:1883';
    // In production, treat MQTT as optional unless explicitly configured.
    // This prevents hosted deployments from crashing if MQTT isn't set up yet.
    if (process.env.NODE_ENV === 'production' && (!rawBrokerUrl || rawBrokerUrl.trim() === '')) {
        console.warn('MQTT_BROKER_URL not set. Skipping MQTT initialization in production.');
        return null;
    }
    let brokerUrl = (rawBrokerUrl && rawBrokerUrl.trim().length > 0 ? rawBrokerUrl.trim() : fallbackUrl);
    // Render/hosted dashboards often provide host:port without protocol.
    // mqtt.connect requires a protocol like mqtt:// or mqtts://
    if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(brokerUrl)) {
        brokerUrl = `mqtt://${brokerUrl}`;
    }
    try {
        client = mqtt_1.default.connect(brokerUrl, options);
    }
    catch (err) {
        console.error('MQTT initialization failed:', err);
        // Don't crash the whole server for MQTT config issues
        return null;
    }
    client.on('connect', () => {
        console.log('MQTT Connected to broker');
        // Subscribe to topics
        Object.values(TOPICS).forEach(topic => {
            client?.subscribe(topic, (err) => {
                if (err) {
                    console.error(`Failed to subscribe to ${topic}:`, err);
                }
                else {
                    console.log(`Subscribed to ${topic}`);
                }
            });
        });
    });
    client.on('error', (err) => {
        console.error('MQTT Error:', err);
    });
    client.on('reconnect', () => {
        console.log('MQTT Reconnecting...');
    });
    client.on('message', (topic, message) => {
        handleMessage(topic, message.toString());
    });
    return client;
};
exports.initMQTT = initMQTT;
const handleMessage = async (topic, message) => {
    try {
        const data = JSON.parse(message);
        if (topic.includes('/sensors/') && topic.includes('/data')) {
            await handleSensorData(topic, data);
        }
        else if (topic.includes('/devices/') && topic.includes('/status')) {
            await handleDeviceStatus(topic, data);
        }
        else if (topic.includes('/irrigation/') && topic.includes('/ack')) {
            await handleIrrigationAck(topic, data);
        }
        else if (topic === TOPICS.DEVICE_REGISTER) {
            await handleDeviceRegistration(data);
        }
    }
    catch (error) {
        console.error('Error processing MQTT message:', error);
    }
};
const handleSensorData = async (topic, data) => {
    // Extract device ID from topic: smart-agri/sensors/{deviceId}/data
    const parts = topic.split('/');
    const deviceId = parts[2];
    console.log(`Received sensor data from device ${deviceId}:`, data);
    // Import and use the IoT service to store sensor data
    const { storeSensorReading } = await Promise.resolve().then(() => __importStar(require('../services/iot/iot.service')));
    await storeSensorReading(deviceId, data);
};
const handleDeviceStatus = async (topic, data) => {
    const parts = topic.split('/');
    const deviceId = parts[2];
    console.log(`Device ${deviceId} status:`, data);
    const { updateDeviceStatus } = await Promise.resolve().then(() => __importStar(require('../services/iot/iot.service')));
    await updateDeviceStatus(deviceId, data.status);
};
const handleIrrigationAck = async (topic, data) => {
    const parts = topic.split('/');
    const deviceId = parts[2];
    console.log(`Irrigation acknowledgment from ${deviceId}:`, data);
    const { updateIrrigationStatus } = await Promise.resolve().then(() => __importStar(require('../services/irrigation/irrigation.service')));
    await updateIrrigationStatus(data.scheduleId, data.status);
};
const handleDeviceRegistration = async (data) => {
    console.log('New device registration request:', data);
    // Handle device registration logic
};
const publishMessage = (topic, message) => {
    if (!client || !client.connected) {
        console.error('MQTT client not connected');
        return false;
    }
    client.publish(topic, JSON.stringify(message), { qos: 1 }, (err) => {
        if (err) {
            console.error('Failed to publish message:', err);
        }
    });
    return true;
};
exports.publishMessage = publishMessage;
const sendIrrigationCommand = (deviceId, command) => {
    const topic = `smart-agri/irrigation/${deviceId}/command`;
    return (0, exports.publishMessage)(topic, command);
};
exports.sendIrrigationCommand = sendIrrigationCommand;
const getMQTTClient = () => client;
exports.getMQTTClient = getMQTTClient;
//# sourceMappingURL=mqtt.js.map