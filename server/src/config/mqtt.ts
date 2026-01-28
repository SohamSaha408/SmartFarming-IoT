import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import dotenv from 'dotenv';

dotenv.config();

let client: MqttClient | null = null;

const TOPICS = {
  SENSOR_DATA: 'smart-agri/sensors/+/data',
  DEVICE_STATUS: 'smart-agri/devices/+/status',
  IRRIGATION_COMMAND: 'smart-agri/irrigation/+/command',
  IRRIGATION_ACK: 'smart-agri/irrigation/+/ack',
  DEVICE_REGISTER: 'smart-agri/devices/register'
};

export const initMQTT = (): MqttClient | null => {
  const options: IClientOptions = {
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
    return null as any;
  }

  let brokerUrl = (rawBrokerUrl && rawBrokerUrl.trim().length > 0 ? rawBrokerUrl.trim() : fallbackUrl);

  // Render/hosted dashboards often provide host:port without protocol.
  // mqtt.connect requires a protocol like mqtt:// or mqtts://
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(brokerUrl)) {
    brokerUrl = `mqtt://${brokerUrl}`;
  }

  try {
    client = mqtt.connect(brokerUrl, options);
  } catch (err) {
    console.error('MQTT initialization failed:', err);
    // Don't crash the whole server for MQTT config issues
    return null as any;
  }

  client.on('connect', () => {
    console.log('MQTT Connected to broker');
    
    // Subscribe to topics
    Object.values(TOPICS).forEach(topic => {
      client?.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        } else {
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

const handleMessage = async (topic: string, message: string) => {
  try {
    const data = JSON.parse(message);
    
    if (topic.includes('/sensors/') && topic.includes('/data')) {
      await handleSensorData(topic, data);
    } else if (topic.includes('/devices/') && topic.includes('/status')) {
      await handleDeviceStatus(topic, data);
    } else if (topic.includes('/irrigation/') && topic.includes('/ack')) {
      await handleIrrigationAck(topic, data);
    } else if (topic === TOPICS.DEVICE_REGISTER) {
      await handleDeviceRegistration(data);
    }
  } catch (error) {
    console.error('Error processing MQTT message:', error);
  }
};

const handleSensorData = async (topic: string, data: any) => {
  // Extract device ID from topic: smart-agri/sensors/{deviceId}/data
  const parts = topic.split('/');
  const deviceId = parts[2];
  
  console.log(`Received sensor data from device ${deviceId}:`, data);
  
  // Import and use the IoT service to store sensor data
  const { storeSensorReading } = await import('../services/iot/iot.service');
  await storeSensorReading(deviceId, data);
};

const handleDeviceStatus = async (topic: string, data: any) => {
  const parts = topic.split('/');
  const deviceId = parts[2];
  
  console.log(`Device ${deviceId} status:`, data);
  
  const { updateDeviceStatus } = await import('../services/iot/iot.service');
  await updateDeviceStatus(deviceId, data.status);
};

const handleIrrigationAck = async (topic: string, data: any) => {
  const parts = topic.split('/');
  const deviceId = parts[2];
  
  console.log(`Irrigation acknowledgment from ${deviceId}:`, data);
  
  const { updateIrrigationStatus } = await import('../services/irrigation/irrigation.service');
  await updateIrrigationStatus(data.scheduleId, data.status);
};

const handleDeviceRegistration = async (data: any) => {
  console.log('New device registration request:', data);
  // Handle device registration logic
};

export const publishMessage = (topic: string, message: object): boolean => {
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

export const sendIrrigationCommand = (deviceId: string, command: object): boolean => {
  const topic = `smart-agri/irrigation/${deviceId}/command`;
  return publishMessage(topic, command);
};

export const getMQTTClient = (): MqttClient | null => client;

export { TOPICS };
