import SensorReading from '../models/SensorReading.model';
import IoTDevice from '../models/IoTDevice.model';
import { logger } from '../utils/logger';

interface SensorPayload {
    soilMoisture?: number;
    temperature?: number;
    humidity?: number; // Air humidity
    airTemperature?: number;
    soilTemperature?: number;
    light?: number;
    battery?: number;
    // Fallback for raw data
    [key: string]: any;
}

/**
 * Saves sensor data from MQTT payload to the database.
 * @param farmId - The farm ID reported by the topic
 * @param deviceId - The device ID reported by the topic
 * @param payload - The data payload
 */
export const saveSensorData = async (farmId: string, deviceId: string, payload: SensorPayload) => {
    try {
        // 1. Find the device by deviceId (hardware ID)
        // We optionally verify farmId matches, but deviceId should be unique globally (or per farm)
        const device = await IoTDevice.findOne({
            where: { deviceId }
        });

        if (!device) {
            logger.warn(`Received data for unknown device: ${deviceId}`);
            return;
        }

        // 2. Normalize payload keys to model attributes
        // Payload might be { type: 'soil', value: 30 } or { soilMoisture: 30 }
        // We need to map it carefully.

        const readingData: any = {
            deviceId: device.id, // Internal UUID
            recordedAt: new Date(),
            rawData: payload
        };

        // Mapping common sensor keys
        if (typeof payload.soilMoisture === 'number') readingData.soilMoisture = payload.soilMoisture;
        if (typeof payload.soilTemperature === 'number') readingData.soilTemperature = payload.soilTemperature;

        // "temperature" could be air or soil depending on context, assuming air if unspecified
        if (typeof payload.temperature === 'number') {
            if (device.deviceType === 'soil_sensor') readingData.soilTemperature = payload.temperature;
            else readingData.airTemperature = payload.temperature;
        }

        if (typeof payload.airTemperature === 'number') readingData.airTemperature = payload.airTemperature;
        if (typeof payload.humidity === 'number') readingData.airHumidity = payload.humidity;
        if (typeof payload.light === 'number') readingData.lightIntensity = payload.light;

        // 3. Save reading
        await SensorReading.create(readingData);
        logger.info(`Saved reading for device ${device.name} (${deviceId})`);

        // 4. Update device "last seen" and battery
        const updateData: any = { lastSeenAt: new Date() };
        if (typeof payload.battery === 'number') updateData.batteryLevel = payload.battery;

        await device.update(updateData);

    } catch (error) {
        logger.error('Error saving sensor data:', error);
    }
};
