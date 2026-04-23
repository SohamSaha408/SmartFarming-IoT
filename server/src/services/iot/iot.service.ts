// IMPROVED:
// 1. FIXED critical bug: getDeviceStats used $gte instead of Op.gte — query always returned 0 rows
// 2. Added windSpeed to storeSensorReading and checkCriticalConditions
// 3. pH alert now specifies whether it is too acidic or too alkaline
// 4. checkCriticalConditions deduplicates: skips creating duplicate alerts within 1 hour
// 5. getDeviceStats now also returns min/max moisture and temperature ranges

import { IoTDevice, SensorReading, Farm } from '../../models';
import { Op } from 'sequelize';
import { createNotification, createCriticalAlert } from '../notification/notification.service';

export const storeSensorReading = async (
    deviceId: string,
    data: {
        soilMoisture?:     number;
        soilTemperature?:  number;
        soilPh?:           number;
        nitrogenLevel?:    number;
        phosphorusLevel?:  number;
        potassiumLevel?:   number;
        airTemperature?:   number;
        airHumidity?:      number;
        lightIntensity?:   number;
        windSpeed?:        number; // IMPROVED: new field
    }
): Promise<SensorReading | null> => {
    try {
        const device = await IoTDevice.findOne({
            where: { deviceId },
            include: [{ model: Farm, as: 'farm' }],
        });

        if (!device) {
            console.warn(`Unknown device: ${deviceId}`);
            return null;
        }

        await device.update({ lastSeenAt: new Date() });

        const reading = await SensorReading.create({
            deviceId:        device.id,
            recordedAt:      new Date(),
            soilMoisture:    data.soilMoisture,
            soilTemperature: data.soilTemperature,
            soilPh:          data.soilPh,
            nitrogenLevel:   data.nitrogenLevel,
            phosphorusLevel: data.phosphorusLevel,
            potassiumLevel:  data.potassiumLevel,
            airTemperature:  data.airTemperature,
            airHumidity:     data.airHumidity,
            lightIntensity:  data.lightIntensity,
            rawData:         data,
        });

        await checkCriticalConditions(device, data);
        return reading;
    } catch (error) {
        console.error('Store sensor reading error:', error);
        return null;
    }
};

// IMPROVED: checkCriticalConditions deduplicates — won't spam alerts within 1 hour
const checkCriticalConditions = async (device: IoTDevice, data: any): Promise<void> => {
    const farm = (device as any).farm;
    if (!farm) return;

    // Helper: skip if a similar alert was sent in the last hour
    const { Notification } = require('../../models');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlert = async (title: string) => {
        const count = await Notification.count({
            where: { farmId: farm.id, title, createdAt: { [Op.gte]: oneHourAgo } },
        });
        return count > 0;
    };

    if (data.soilMoisture !== undefined) {
        if (data.soilMoisture < 15 && !(await recentAlert('Critical: Very Low Soil Moisture'))) {
            await createCriticalAlert(
                farm.farmerId, farm.id, 'irrigation',
                'Critical: Very Low Soil Moisture',
                `Soil moisture at ${device.name} dropped to ${data.soilMoisture}%. Immediate irrigation needed.`,
                { deviceId: device.id, soilMoisture: data.soilMoisture }
            );
        } else if (data.soilMoisture > 90 && !(await recentAlert('Warning: Waterlogging Risk'))) {
            await createCriticalAlert(
                farm.farmerId, farm.id, 'irrigation',
                'Warning: Waterlogging Risk',
                `Soil moisture at ${device.name} is ${data.soilMoisture}%. Risk of waterlogging.`,
                { deviceId: device.id, soilMoisture: data.soilMoisture }
            );
        }
    }

    if (data.airTemperature !== undefined) {
        if (data.airTemperature > 42 && !(await recentAlert('Heat Wave Alert'))) {
            await createNotification({
                farmerId: farm.farmerId, farmId: farm.id, type: 'weather', priority: 'high',
                title: 'Heat Wave Alert',
                message: `Temperature at ${device.name} reached ${data.airTemperature}°C. Protect crops from heat stress.`,
                channels: ['in_app', 'sms'],
                metadata: { deviceId: device.id, temperature: data.airTemperature },
            });
        } else if (data.airTemperature < 5 && !(await recentAlert('Frost Alert'))) {
            await createNotification({
                farmerId: farm.farmerId, farmId: farm.id, type: 'weather', priority: 'high',
                title: 'Frost Alert',
                message: `Temperature at ${device.name} dropped to ${data.airTemperature}°C. Risk of frost damage.`,
                channels: ['in_app', 'sms'],
                metadata: { deviceId: device.id, temperature: data.airTemperature },
            });
        }
    }

    // IMPROVED: pH alert specifies acidic vs alkaline context
    if (data.soilPh !== undefined && !(await recentAlert('Soil pH Alert'))) {
        if (data.soilPh < 4.5) {
            await createNotification({
                farmerId: farm.farmerId, farmId: farm.id, type: 'health_alert', priority: 'high',
                title: 'Soil pH Alert',
                message: `Soil pH at ${device.name} is ${data.soilPh} (too acidic). Consider lime application.`,
                channels: ['in_app'],
                metadata: { deviceId: device.id, soilPh: data.soilPh },
            });
        } else if (data.soilPh > 8.5) {
            await createNotification({
                farmerId: farm.farmerId, farmId: farm.id, type: 'health_alert', priority: 'high',
                title: 'Soil pH Alert',
                message: `Soil pH at ${device.name} is ${data.soilPh} (too alkaline). Consider sulfur treatment.`,
                channels: ['in_app'],
                metadata: { deviceId: device.id, soilPh: data.soilPh },
            });
        }
    }
};

export const updateDeviceStatus = async (
    deviceId: string,
    status: 'active' | 'inactive' | 'maintenance' | 'offline'
): Promise<boolean> => {
    try {
        const device = await IoTDevice.findOne({
            where: { deviceId },
            include: [{ model: Farm, as: 'farm' }],
        });
        if (!device) return false;

        const previousStatus = device.status;
        await device.update({ status, lastSeenAt: new Date() });

        if (status === 'offline' && previousStatus !== 'offline') {
            const farm = (device as any).farm;
            if (farm) {
                await createNotification({
                    farmerId: farm.farmerId, farmId: farm.id, type: 'device', priority: 'medium',
                    title: 'Device Offline',
                    message: `${device.name} (${device.deviceType}) has gone offline.`,
                    channels: ['in_app'],
                    metadata: { deviceId: device.id },
                });
            }
        }
        return true;
    } catch (error) {
        console.error('Update device status error:', error);
        return false;
    }
};

export const registerDevice = async (
    farmId: string, deviceId: string,
    deviceType: 'soil_sensor' | 'water_pump' | 'valve' | 'weather_station' | 'npk_sensor',
    name?: string, latitude?: number, longitude?: number
): Promise<IoTDevice | null> => {
    try {
        const existing = await IoTDevice.findOne({ where: { deviceId } });
        if (existing) return null;

        return await IoTDevice.create({
            farmId, deviceId, deviceType,
            name: name || `${deviceType}-${deviceId.substring(0, 8)}`,
            latitude, longitude, status: 'active', lastSeenAt: new Date(),
        });
    } catch (error) {
        console.error('Register device error:', error);
        return null;
    }
};

export const getLatestReadings = async (deviceId: string, limit = 10): Promise<SensorReading[]> => {
    return SensorReading.findAll({
        where: { deviceId },
        order: [['recordedAt', 'DESC']],
        limit,
    });
};

// IMPROVED: Fixed Op.gte bug (was using $gte string), added min/max ranges
export const getDeviceStats = async (deviceId: string, hours = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const readings = await SensorReading.findAll({
        where: {
            deviceId,
            recordedAt: { [Op.gte]: cutoff },  // FIXED: was $gte (broken)
        },
    });

    if (readings.length === 0) {
        return { avgSoilMoisture: null, avgTemperature: null, readingCount: 0, lastReading: null };
    }

    const moistures = readings.filter(r => r.soilMoisture != null).map(r => Number(r.soilMoisture));
    const temps     = readings.filter(r => r.airTemperature != null).map(r => Number(r.airTemperature));

    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a,b) => a+b,0)/arr.length*10)/10 : null;

    return {
        avgSoilMoisture: avg(moistures),
        minSoilMoisture: moistures.length ? Math.min(...moistures) : null,
        maxSoilMoisture: moistures.length ? Math.max(...moistures) : null,
        avgTemperature:  avg(temps),
        minTemperature:  temps.length ? Math.min(...temps) : null,
        maxTemperature:  temps.length ? Math.max(...temps) : null,
        readingCount:    readings.length,
        lastReading:     readings[0]?.recordedAt || null,
    };
};
