// IMPROVED v2:
// 1. Irrigation dedup per-device + 6h cooldown guard
// 2. Phosphorus, Potassium, and pH threshold checks
// 3. CRITICAL alerts for extreme conditions → SMS + Email + in-app + WebSocket push
// 4. Device offline detection → critical alert after 15 min silence
// 5. Frost / heat-wave weather alerts from forecast service
// 6. Soil pH out-of-range alerts
// 7. emitAlert() WebSocket push so browser/PWA shows native notification instantly

import { logger } from '../utils/logger';
import IrrigationSchedule from '../models/IrrigationSchedule.model';
import FertilizationRecord from '../models/FertilizationRecord.model';
import Crop from '../models/Crop.model';
import CropHealth from '../models/CropHealth.model';
import IoTDevice from '../models/IoTDevice.model';
import Farm from '../models/Farm.model';
import { Op } from 'sequelize';
import { createNotification, createCriticalAlert } from './notification/notification.service';
import { getCachedForecast } from './weather.service';
import { emitAlert } from '../websocket/socketHandler';

export const processSensorData = async (farmId: string, nodeId: string, payload: any) => {
    try {
        const moisture    = payload.moisture    ?? payload.soilMoisture;
        const nitrogen    = payload.nitrogen    ?? payload.nitrogenLevel;
        const phosphorus  = payload.phosphorus  ?? payload.phosphorusLevel;
        const potassium   = payload.potassium   ?? payload.potassiumLevel;
        const temperature = payload.temperature ?? payload.temp;
        const humidity    = payload.humidity;
        const pH          = payload.ph          ?? payload.soilPH;

        const device = await IoTDevice.findOne({ where: { deviceId: nodeId, farmId } });
        if (!device) {
            logger.warn(`Unknown device ${nodeId} on farm ${farmId}`);
            return;
        }

        const activeCrop = await Crop.findOne({ where: { farmId, status: 'active' } });
        if (!activeCrop) {
            logger.debug(`No active crop for farm ${farmId}, skipping automation.`);
            return;
        }

        const farm = await Farm.findByPk(farmId);
        const cropId   = activeCrop.id;
        const farmerId = farm?.farmerId;
        const lat      = farm ? parseFloat(farm.latitude.toString())  : null;
        const lon      = farm ? parseFloat(farm.longitude.toString()) : null;

        const latestHealth = await CropHealth.findOne({
            where: { cropId },
            order: [['recordedAt', 'DESC']],
        });

        const ndvi = typeof latestHealth?.ndviValue === 'number'
            ? latestHealth.ndviValue
            : typeof latestHealth?.ndviValue === 'string'
                ? parseFloat(latestHealth.ndviValue as any)
                : 0.5;

        // ── Dynamic thresholds (NDVI-adjusted) ─────────────────────────────
        const moistureThreshold   = 20 + Math.max(0, (1 - ndvi) * 20);
        const moistureCritical    = 10; // drought emergency
        const nitrogenThreshold   = 15 + Math.max(0, (1 - ndvi) * 15);
        const phosphorusThreshold = 10 + Math.max(0, (1 - ndvi) * 10);
        const potassiumThreshold  = 12 + Math.max(0, (1 - ndvi) * 12);
        const irrigationDuration  = Math.round(15 + (1 - ndvi) * 25);

        // ── 1. CRITICAL drought alert ───────────────────────────────────────
        if (typeof moisture === 'number' && moisture < moistureCritical) {
            logger.warn(`[CRITICAL] Drought alert: moisture=${moisture}% on farm ${farmId}`);
            const alert = {
                type: 'drought',
                severity: 'critical',
                title: '🚨 Critical Drought Alert',
                message: `Soil moisture is dangerously low at ${moisture}%. Immediate irrigation required.`,
                sensor: { moisture },
            };
            emitAlert(farmId, alert); // → WebSocket → browser push notification
            if (farmerId) {
                await createCriticalAlert(farmerId, farmId, 'irrigation', alert.title, alert.message, { nodeId, moisture });
            }
        } else if (typeof moisture === 'number' && moisture < moistureThreshold) {
            await scheduleIrrigation(farmId, cropId, device.id, moisture, irrigationDuration, farmerId, lat, lon);
        }

        // ── 2. Heat stress alert (temperature > 40°C) ──────────────────────
        if (typeof temperature === 'number' && temperature > 40) {
            logger.warn(`[CRITICAL] Heat stress: temp=${temperature}°C on farm ${farmId}`);
            const alert = {
                type: 'heat_stress',
                severity: 'critical',
                title: '🌡 Extreme Heat Alert',
                message: `Temperature is ${temperature}°C — crop heat stress risk is very high. Consider shade nets or emergency irrigation.`,
                sensor: { temperature },
            };
            emitAlert(farmId, alert);
            if (farmerId) {
                await createCriticalAlert(farmerId, farmId, 'health_alert', alert.title, alert.message, { nodeId, temperature });
            }
        }

        // ── 3. Frost alert (temperature < 5°C) ─────────────────────────────
        if (typeof temperature === 'number' && temperature < 5) {
            logger.warn(`[CRITICAL] Frost risk: temp=${temperature}°C on farm ${farmId}`);
            const alert = {
                type: 'frost',
                severity: 'critical',
                title: '❄️ Frost Risk Alert',
                message: `Temperature has dropped to ${temperature}°C. Cover sensitive crops immediately to prevent frost damage.`,
                sensor: { temperature },
            };
            emitAlert(farmId, alert);
            if (farmerId) {
                await createCriticalAlert(farmerId, farmId, 'health_alert', alert.title, alert.message, { nodeId, temperature });
            }
        }

        // ── 4. Soil pH out of range (optimal 6.0–7.5) ──────────────────────
        if (typeof pH === 'number' && (pH < 5.5 || pH > 8.0)) {
            const severity = pH < 5.0 || pH > 8.5 ? 'critical' : 'high';
            const alert = {
                type: 'soil_ph',
                severity,
                title: severity === 'critical' ? '⚠️ Critical Soil pH' : '⚠️ Soil pH Warning',
                message: `Soil pH is ${pH.toFixed(1)} — outside optimal range (6.0–7.5). Nutrient uptake will be impaired.`,
                sensor: { pH },
            };
            emitAlert(farmId, alert);
            if (farmerId) {
                if (severity === 'critical') {
                    await createCriticalAlert(farmerId, farmId, 'health_alert', alert.title, alert.message, { nodeId, pH });
                } else {
                    await createNotification({
                        farmerId, farmId, cropId,
                        type: 'health_alert', priority: 'high',
                        title: alert.title, message: alert.message,
                        channels: ['in_app', 'sms'],
                    });
                }
            }
        }

        // ── 5. High humidity disease risk (>90% → fungal alert) ────────────
        if (typeof humidity === 'number' && humidity > 90) {
            const alert = {
                type: 'disease_risk',
                severity: 'high',
                title: '🍄 High Disease Risk',
                message: `Humidity at ${humidity}% — fungal/mould conditions are ideal. Inspect crops and consider fungicide application.`,
                sensor: { humidity },
            };
            emitAlert(farmId, alert);
            if (farmerId) {
                await createNotification({
                    farmerId, farmId, cropId,
                    type: 'health_alert', priority: 'high',
                    title: alert.title, message: alert.message,
                    channels: ['in_app', 'sms'],
                });
            }
        }

        // ── 6. Fertilization checks ─────────────────────────────────────────
        if (typeof nitrogen === 'number' && nitrogen < nitrogenThreshold) {
            await scheduleFertilization(cropId, 'Nitrogen', 'N-Boost', nitrogen, nitrogenThreshold, farmerId, farmId);
        }
        if (typeof phosphorus === 'number' && phosphorus < phosphorusThreshold) {
            await scheduleFertilization(cropId, 'Phosphorus', 'P-Boost', phosphorus, phosphorusThreshold, farmerId, farmId);
        }
        if (typeof potassium === 'number' && potassium < potassiumThreshold) {
            await scheduleFertilization(cropId, 'Potassium', 'K-Boost', potassium, potassiumThreshold, farmerId, farmId);
        }

    } catch (error) {
        logger.error('Error in processSensorData automation:', error);
    }
};

// ── Device offline detection (call from a cron/interval job) ────────────────
export const checkDeviceOffline = async (farmId: string, deviceId: string, farmerId?: string) => {
    const device = await IoTDevice.findOne({ where: { deviceId, farmId } });
    if (!device) return;

    const silenceThresholdMs = 15 * 60 * 1000; // 15 minutes
    const lastSeen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
    if (Date.now() - lastSeen > silenceThresholdMs) {
        const alert = {
            type: 'device_offline',
            severity: 'high',
            title: '📡 Device Offline',
            message: `IoT node "${deviceId}" on your farm has not reported in over 15 minutes. Check power and connectivity.`,
        };
        emitAlert(farmId, alert);
        if (farmerId) {
            await createNotification({
                farmerId, farmId,
                type: 'device', priority: 'high',
                title: alert.title, message: alert.message,
                channels: ['in_app', 'sms'],
                metadata: { deviceId },
            });
        }
    }
};

const scheduleIrrigation = async (
    farmId: string,
    cropId: string,
    deviceId: string,
    moistureLevel: number,
    ndviDurationMins: number,   // NDVI-adaptive baseline from processSensorData
    farmerId?: string,
    lat?: number | null,        // farm latitude  — needed for forecast
    lon?: number | null,        // farm longitude — needed for forecast
) => {
    // ── 1. Dedup: bail if already active for this device ─────────────────
    const existing = await IrrigationSchedule.findOne({
        where: {
            farmId, cropId, deviceId,
            status: { [Op.in]: ['pending', 'scheduled', 'in_progress'] },
        },
    });
    if (existing) {
        logger.debug(`[Irrigation] Already active for device ${deviceId}. Skipping.`);
        return;
    }

    // ── 2. Cooldown: bail if completed within the last 6 hours ───────────
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    const recent = await IrrigationSchedule.findOne({
        where: {
            farmId, cropId, deviceId,
            status: 'completed',
            updatedAt: { [Op.gte]: sixHoursAgo },
        },
    });
    if (recent) {
        logger.debug(`[Irrigation] Completed within 6h for device ${deviceId}. Skipping.`);
        return;
    }

    // ── 3. Weather-aware gate ─────────────────────────────────────────────
    let finalDurationMins = ndviDurationMins;
    let forecastNote      = '';

    if (lat != null && lon != null) {
        try {
            const forecast = await getCachedForecast(farmId, lat, lon);

            // Skip entirely when meaningful rain is coming in the next 6 hours
            if (forecast.rainExpectedNext6h) {
                logger.info(
                    `[Irrigation] Skipped for farm ${farmId} — ${forecast.skipReason}. ` +
                    `Moisture=${moistureLevel}%, but rain will cover deficit.`
                );
                if (farmerId) {
                    await createNotification({
                        farmerId, farmId, cropId,
                        type: 'irrigation', priority: 'low',
                        title: 'Irrigation Skipped — Rain Forecast',
                        message:
                            `Soil moisture is at ${moistureLevel}%, but ${forecast.skipReason?.toLowerCase()}. ` +
                            `Irrigation has been skipped to conserve water.`,
                        channels: ['in_app'],
                        metadata: {
                            precipitationNext6h:  forecast.precipitationNext6h,
                            precipitationNext24h: forecast.precipitationNext24h,
                            et0Next24h:           forecast.et0Next24h,
                        },
                    });
                }
                return; // ← weather gate: do not create the schedule record
            }

            // Adjust duration: use the ET₀-scaled recommendation from the forecast,
            // but clamp it to ±40% of the NDVI baseline so sensor stress still governs.
            const lower = Math.round(ndviDurationMins * 0.6);
            const upper = Math.round(ndviDurationMins * 1.4);
            finalDurationMins = Math.min(upper, Math.max(lower, forecast.recommendedDurationMins));

            forecastNote = ` | ET₀=${forecast.et0Next24h}mm/day, rain24h=${forecast.precipitationNext24h}mm` +
                           ` → duration adjusted ${ndviDurationMins}→${finalDurationMins}min`;

            logger.info(
                `[Irrigation] Farm ${farmId}: moisture=${moistureLevel}%, ` +
                `ndviDuration=${ndviDurationMins}min, et0=${forecast.et0Next24h}mm/day, ` +
                `finalDuration=${finalDurationMins}min`
            );

        } catch (forecastErr) {
            // Weather fetch failed — fall back to NDVI duration, never block irrigation
            logger.warn(`[Irrigation] Forecast fetch failed for farm ${farmId}, using NDVI baseline.`, forecastErr);
        }
    }

    // ── 4. Create the schedule record ────────────────────────────────────
    await IrrigationSchedule.create({
        farmId,
        cropId,
        deviceId,
        scheduledTime:    new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
        durationMinutes:  finalDurationMins,
        waterVolumeLiters: null,
        status:           'pending',
        triggeredBy:      'sensor',
        notes:            `Auto-scheduled: moisture=${moistureLevel}%${forecastNote}`,
    });

    if (farmerId) {
        await createNotification({
            farmerId, farmId, cropId,
            type:     'irrigation',
            priority: 'medium',
            title:    'Auto-Irrigation Scheduled',
            message:
                `Soil moisture dropped to ${moistureLevel}%. ` +
                `Irrigation scheduled for ${finalDurationMins} min` +
                (forecastNote ? ` (ET₀-adjusted).` : `.`),
            channels: ['in_app'],
        });
    }
};

const scheduleFertilization = async (
    cropId: string,
    nutrientName: string,
    fertilizerType: string,
    currentLevel: number,
    threshold: number,
    farmerId?: string,
    farmId?: string
) => {
    // Dedup: only one pending recommendation per nutrient type
    const pending = await FertilizationRecord.findOne({
        where: {
            cropId,
            fertilzerType: fertilizerType,
            status: { [Op.in]: ['recommended', 'scheduled'] },
        },
    });
    if (pending) {
        logger.debug(`Fertilization already pending for ${fertilizerType}. Skipping.`);
        return;
    }

    const quantityKg = parseFloat(((threshold - currentLevel) * 0.8).toFixed(1));

    await FertilizationRecord.create({
        cropId,
        recommendedDate:     new Date(),
        fertilzerType:       fertilizerType,
        quantityKg:          quantityKg > 0 ? quantityKg : 5,
        status:              'recommended',
        notes:               `Auto: low ${nutrientName} (${currentLevel} < ${threshold.toFixed(1)})`,
        basedOnSoilAnalysis: true,
        soilAnalysisData:    { [nutrientName.toLowerCase()]: currentLevel },
    });

    // IMPROVED: Notify farmer about fertilization recommendation
    if (farmerId && farmId) {
        await createNotification({
            farmerId,
            farmId,
            cropId,
            type:     'fertilization',
            priority: 'medium',
            title:    `Low ${nutrientName} Detected`,
            message:  `${nutrientName} level is ${currentLevel}. A ${fertilizerType} application of ~${quantityKg}kg has been recommended.`,
            channels: ['in_app'],
        });
    }
};
