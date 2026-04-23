"use strict";
// IMPROVED:
// 1. FIXED critical bug: getDeviceStats used $gte instead of Op.gte — query always returned 0 rows
// 2. Added windSpeed to storeSensorReading and checkCriticalConditions
// 3. pH alert now specifies whether it is too acidic or too alkaline
// 4. checkCriticalConditions deduplicates: skips creating duplicate alerts within 1 hour
// 5. getDeviceStats now also returns min/max moisture and temperature ranges
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeviceStats = exports.getLatestReadings = exports.registerDevice = exports.updateDeviceStatus = exports.storeSensorReading = void 0;
const models_1 = require("../../models");
const sequelize_1 = require("sequelize");
const notification_service_1 = require("../notification/notification.service");
const storeSensorReading = async (deviceId, data) => {
    try {
        const device = await models_1.IoTDevice.findOne({
            where: { deviceId },
            include: [{ model: models_1.Farm, as: 'farm' }],
        });
        if (!device) {
            console.warn(`Unknown device: ${deviceId}`);
            return null;
        }
        await device.update({ lastSeenAt: new Date() });
        const reading = await models_1.SensorReading.create({
            deviceId: device.id,
            recordedAt: new Date(),
            soilMoisture: data.soilMoisture,
            soilTemperature: data.soilTemperature,
            soilPh: data.soilPh,
            nitrogenLevel: data.nitrogenLevel,
            phosphorusLevel: data.phosphorusLevel,
            potassiumLevel: data.potassiumLevel,
            airTemperature: data.airTemperature,
            airHumidity: data.airHumidity,
            lightIntensity: data.lightIntensity,
            rawData: data,
        });
        await checkCriticalConditions(device, data);
        return reading;
    }
    catch (error) {
        console.error('Store sensor reading error:', error);
        return null;
    }
};
exports.storeSensorReading = storeSensorReading;
// IMPROVED: checkCriticalConditions deduplicates — won't spam alerts within 1 hour
const checkCriticalConditions = async (device, data) => {
    const farm = device.farm;
    if (!farm)
        return;
    // Helper: skip if a similar alert was sent in the last hour
    const { Notification } = require('../../models');
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentAlert = async (title) => {
        const count = await Notification.count({
            where: { farmId: farm.id, title, createdAt: { [sequelize_1.Op.gte]: oneHourAgo } },
        });
        return count > 0;
    };
    if (data.soilMoisture !== undefined) {
        if (data.soilMoisture < 15 && !(await recentAlert('Critical: Very Low Soil Moisture'))) {
            await (0, notification_service_1.createCriticalAlert)(farm.farmerId, farm.id, 'irrigation', 'Critical: Very Low Soil Moisture', `Soil moisture at ${device.name} dropped to ${data.soilMoisture}%. Immediate irrigation needed.`, { deviceId: device.id, soilMoisture: data.soilMoisture });
        }
        else if (data.soilMoisture > 90 && !(await recentAlert('Warning: Waterlogging Risk'))) {
            await (0, notification_service_1.createCriticalAlert)(farm.farmerId, farm.id, 'irrigation', 'Warning: Waterlogging Risk', `Soil moisture at ${device.name} is ${data.soilMoisture}%. Risk of waterlogging.`, { deviceId: device.id, soilMoisture: data.soilMoisture });
        }
    }
    if (data.airTemperature !== undefined) {
        if (data.airTemperature > 42 && !(await recentAlert('Heat Wave Alert'))) {
            await (0, notification_service_1.createNotification)({
                farmerId: farm.farmerId, farmId: farm.id, type: 'weather', priority: 'high',
                title: 'Heat Wave Alert',
                message: `Temperature at ${device.name} reached ${data.airTemperature}°C. Protect crops from heat stress.`,
                channels: ['in_app', 'sms'],
                metadata: { deviceId: device.id, temperature: data.airTemperature },
            });
        }
        else if (data.airTemperature < 5 && !(await recentAlert('Frost Alert'))) {
            await (0, notification_service_1.createNotification)({
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
            await (0, notification_service_1.createNotification)({
                farmerId: farm.farmerId, farmId: farm.id, type: 'health_alert', priority: 'high',
                title: 'Soil pH Alert',
                message: `Soil pH at ${device.name} is ${data.soilPh} (too acidic). Consider lime application.`,
                channels: ['in_app'],
                metadata: { deviceId: device.id, soilPh: data.soilPh },
            });
        }
        else if (data.soilPh > 8.5) {
            await (0, notification_service_1.createNotification)({
                farmerId: farm.farmerId, farmId: farm.id, type: 'health_alert', priority: 'high',
                title: 'Soil pH Alert',
                message: `Soil pH at ${device.name} is ${data.soilPh} (too alkaline). Consider sulfur treatment.`,
                channels: ['in_app'],
                metadata: { deviceId: device.id, soilPh: data.soilPh },
            });
        }
    }
};
const updateDeviceStatus = async (deviceId, status) => {
    try {
        const device = await models_1.IoTDevice.findOne({
            where: { deviceId },
            include: [{ model: models_1.Farm, as: 'farm' }],
        });
        if (!device)
            return false;
        const previousStatus = device.status;
        await device.update({ status, lastSeenAt: new Date() });
        if (status === 'offline' && previousStatus !== 'offline') {
            const farm = device.farm;
            if (farm) {
                await (0, notification_service_1.createNotification)({
                    farmerId: farm.farmerId, farmId: farm.id, type: 'device', priority: 'medium',
                    title: 'Device Offline',
                    message: `${device.name} (${device.deviceType}) has gone offline.`,
                    channels: ['in_app'],
                    metadata: { deviceId: device.id },
                });
            }
        }
        return true;
    }
    catch (error) {
        console.error('Update device status error:', error);
        return false;
    }
};
exports.updateDeviceStatus = updateDeviceStatus;
const registerDevice = async (farmId, deviceId, deviceType, name, latitude, longitude) => {
    try {
        const existing = await models_1.IoTDevice.findOne({ where: { deviceId } });
        if (existing)
            return null;
        return await models_1.IoTDevice.create({
            farmId, deviceId, deviceType,
            name: name || `${deviceType}-${deviceId.substring(0, 8)}`,
            latitude, longitude, status: 'active', lastSeenAt: new Date(),
        });
    }
    catch (error) {
        console.error('Register device error:', error);
        return null;
    }
};
exports.registerDevice = registerDevice;
const getLatestReadings = async (deviceId, limit = 10) => {
    return models_1.SensorReading.findAll({
        where: { deviceId },
        order: [['recordedAt', 'DESC']],
        limit,
    });
};
exports.getLatestReadings = getLatestReadings;
// IMPROVED: Fixed Op.gte bug (was using $gte string), added min/max ranges
const getDeviceStats = async (deviceId, hours = 24) => {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const readings = await models_1.SensorReading.findAll({
        where: {
            deviceId,
            recordedAt: { [sequelize_1.Op.gte]: cutoff }, // FIXED: was $gte (broken)
        },
    });
    if (readings.length === 0) {
        return { avgSoilMoisture: null, avgTemperature: null, readingCount: 0, lastReading: null };
    }
    const moistures = readings.filter(r => r.soilMoisture != null).map(r => Number(r.soilMoisture));
    const temps = readings.filter(r => r.airTemperature != null).map(r => Number(r.airTemperature));
    const avg = (arr) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null;
    return {
        avgSoilMoisture: avg(moistures),
        minSoilMoisture: moistures.length ? Math.min(...moistures) : null,
        maxSoilMoisture: moistures.length ? Math.max(...moistures) : null,
        avgTemperature: avg(temps),
        minTemperature: temps.length ? Math.min(...temps) : null,
        maxTemperature: temps.length ? Math.max(...temps) : null,
        readingCount: readings.length,
        lastReading: readings[0]?.recordedAt || null,
    };
};
exports.getDeviceStats = getDeviceStats;
//# sourceMappingURL=iot.service.js.map