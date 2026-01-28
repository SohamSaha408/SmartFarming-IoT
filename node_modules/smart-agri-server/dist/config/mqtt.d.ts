import { MqttClient } from 'mqtt';
declare const TOPICS: {
    SENSOR_DATA: string;
    DEVICE_STATUS: string;
    IRRIGATION_COMMAND: string;
    IRRIGATION_ACK: string;
    DEVICE_REGISTER: string;
};
export declare const initMQTT: () => MqttClient | null;
export declare const publishMessage: (topic: string, message: object) => boolean;
export declare const sendIrrigationCommand: (deviceId: string, command: object) => boolean;
export declare const getMQTTClient: () => MqttClient | null;
export { TOPICS };
//# sourceMappingURL=mqtt.d.ts.map