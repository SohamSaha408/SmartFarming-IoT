// IMPROVED:
// 1. Removed dynamic require() inside async function — replaced with proper top-level import
// 2. Added support for nitrogenLevel, phosphorusLevel, potassiumLevel, soilPh fields
// 3. Better device auto-registration: uses farmId from MQTT topic if possible
// 4. parseNumber helper is reusable and handles edge cases (NaN strings, null, undefined)

import SensorReading from '../models/SensorReading.model';
import IoTDevice from '../models/IoTDevice.model';
import Farm from '../models/Farm.model';
import { logger } from '../utils/logger';

interface SensorPayload {
    soilMoisture?:      number;
    moisture?:          number;
    temperature?:       number;
    soilTemperature?:   number;
    airTemperature?:    number;
    humidity?:          number;
    airHumidity?:       number;
    lightIntensity?:    number;
    light?:             number;
    battery?:           number;
    nitrogenLevel?:     number;
    nitrogen?:          number;
    phosphorusLevel?:   number;
    phosphorus?:        number;
    potassiumLevel?:    number;
    potassium?:         number;
    soilPh?:            number;
    ph?:                number;
    [key: string]: any;
}

const parseNumber = (val: any): number | null => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string') {
        const parsed = parseFloat(val);
        if (!isNaN(parsed)) return parsed;
    }
    return null;
};

export const saveSensorData = async (farmId: string, deviceId: string, payload: SensorPayload) => {
    try {
        let device = await IoTDevice.findOne({ where: { deviceId } });

        if (!device) {
            logger.warn(`Unknown device: ${deviceId}. Auto-registering on farm ${farmId}...`);
            // IMPROVED: top-level import instead of require() inside async
            const farm = await Farm.findOne({ where: { id: farmId } })
                      || await Farm.findOne();
            if (!farm) {
                logger.error('No farms found — cannot auto-register device.');
                return;
            }
            device = await IoTDevice.create({
                farmId:     farm.id,
                deviceId,
                name:       `Auto-${deviceId}`,
                deviceType: 'soil_sensor',
                status:     'active',
            });
        }

        const readingData: any = {
            deviceId:   device.id,
            recordedAt: new Date(),
            rawData:    payload,
        };

        // Soil moisture — accept both field names
        const sm = parseNumber(payload.soilMoisture ?? payload.moisture);
        if (sm !== null) readingData.soilMoisture = sm;

        // Temperatures
        const st = parseNumber(payload.soilTemperature);
        if (st !== null) readingData.soilTemperature = st;

        const at = parseNumber(payload.airTemperature);
        if (at !== null) readingData.airTemperature = at;

        // Generic temperature → assign based on device type
        const gt = parseNumber(payload.temperature);
        if (gt !== null && at === null && st === null) {
            if (device.deviceType === 'soil_sensor') readingData.soilTemperature = gt;
            else readingData.airTemperature = gt;
        }

        // Humidity
        const ah = parseNumber(payload.airHumidity ?? payload.humidity);
        if (ah !== null) readingData.airHumidity = ah;

        // Light
        const li = parseNumber(payload.lightIntensity ?? payload.light);
        if (li !== null) readingData.lightIntensity = li;

        // IMPROVED: NPK and pH fields now saved
        const ni = parseNumber(payload.nitrogenLevel ?? payload.nitrogen);
        if (ni !== null) readingData.nitrogenLevel = ni;

        const ph = parseNumber(payload.phosphorusLevel ?? payload.phosphorus);
        if (ph !== null) readingData.phosphorusLevel = ph;

        const po = parseNumber(payload.potassiumLevel ?? payload.potassium);
        if (po !== null) readingData.potassiumLevel = po;

        const spH = parseNumber(payload.soilPh ?? payload.ph);
        if (spH !== null) readingData.soilPh = spH;

        await SensorReading.create(readingData);
        logger.info(`Saved reading for device ${device.name} (${deviceId})`);

        // Update last_seen and battery level
        const deviceUpdate: any = { lastSeenAt: new Date() };
        const batt = parseNumber(payload.battery);
        if (batt !== null) deviceUpdate.batteryLevel = batt;
        await device.update(deviceUpdate);

    } catch (error) {
        logger.error('Error saving sensor data:', error);
    }
};
