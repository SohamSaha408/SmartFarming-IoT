import { Farm, Crop, CropHealth, IoTDevice, SensorReading, IrrigationSchedule } from '../../models';
import { publishCommand } from '../../mqtt/mqttHandler';
import { getCurrentWeather, getWeatherForecast } from '../satellite/satellite.service';
import { createNotification } from '../notification/notification.service';

interface IrrigationRecommendation {
  cropId: string;
  cropType: string;
  recommendedDuration: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  weatherForecast: string;
}

// Crop-specific water requirements (liters per hectare per day)
const CROP_WATER_REQUIREMENTS: Record<string, { min: number; optimal: number; max: number }> = {
  rice: { min: 800, optimal: 1200, max: 1500 },
  wheat: { min: 300, optimal: 450, max: 600 },
  cotton: { min: 400, optimal: 600, max: 800 },
  sugarcane: { min: 1000, optimal: 1500, max: 2000 },
  maize: { min: 400, optimal: 550, max: 700 },
  vegetables: { min: 300, optimal: 450, max: 600 },
  default: { min: 350, optimal: 500, max: 700 }
};

// Get water requirement for crop type
const getWaterRequirement = (cropType: string) => {
  const normalized = cropType.toLowerCase();
  return CROP_WATER_REQUIREMENTS[normalized] || CROP_WATER_REQUIREMENTS.default;
};

// Calculate irrigation need based on various factors
export const calculateIrrigationNeed = async (
  crop: Crop,
  farm: Farm,
  latestHealth: CropHealth | null,
  sensorData: SensorReading | null
): Promise<IrrigationRecommendation | null> => {
  try {
    const waterReq = getWaterRequirement(crop.cropType);
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let reason = '';
    let recommendedDuration = 30; // default 30 minutes

    // Check soil moisture from sensors
    const soilMoisture = sensorData?.soilMoisture
      ? parseFloat(sensorData.soilMoisture.toString())
      : null;

    // Check satellite-derived moisture
    const satelliteMoisture = latestHealth?.moistureLevel
      ? parseFloat(latestHealth.moistureLevel.toString())
      : null;

    // Use available moisture data
    const moisture = soilMoisture || satelliteMoisture;

    // Get weather forecast
    const lat = parseFloat(farm.latitude.toString());
    const lon = parseFloat(farm.longitude.toString());
    const forecast = await getWeatherForecast(lat, lon);

    // Check if rain is expected in next 24 hours
    const rainExpected = forecast?.list?.some((item: any) => {
      const itemTime = new Date(item.dt * 1000);
      const now = new Date();
      const hoursDiff = (itemTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      return hoursDiff <= 24 && item.rain && item.rain['3h'] > 5;
    });

    let weatherForecast = rainExpected
      ? 'Rain expected in next 24 hours'
      : 'No significant rain expected';

    // Decision logic
    if (moisture !== null) {
      if (moisture < 20) {
        urgency = 'critical';
        reason = 'Soil moisture critically low';
        recommendedDuration = 60;
      } else if (moisture < 35) {
        urgency = 'high';
        reason = 'Soil moisture below optimal level';
        recommendedDuration = 45;
      } else if (moisture < 50) {
        urgency = 'medium';
        reason = 'Soil moisture approaching low threshold';
        recommendedDuration = 30;
      } else if (moisture > 80) {
        return null; // No irrigation needed
      }
    }

    // Adjust based on weather
    if (rainExpected && urgency !== 'critical') {
      if (urgency === 'high') {
        urgency = 'medium';
        reason += '. Rain expected - reduced urgency.';
        recommendedDuration = Math.round(recommendedDuration * 0.5);
      } else if (urgency === 'medium') {
        urgency = 'low';
        reason += '. Consider waiting for rain.';
        recommendedDuration = Math.round(recommendedDuration * 0.5);
      } else {
        return null; // Skip if low urgency and rain expected
      }
    }

    // Adjust based on health status
    if (latestHealth?.healthStatus === 'stressed' || latestHealth?.healthStatus === 'critical') {
      if (urgency === 'low') urgency = 'medium';
      reason += ' Crop showing signs of stress.';
    }

    // Calculate water volume based on area
    const areaHectares = crop.areaHectares
      ? parseFloat(crop.areaHectares.toString())
      : 1;

    return {
      cropId: crop.id,
      cropType: crop.cropType,
      recommendedDuration,
      urgency,
      reason: reason || 'Scheduled maintenance irrigation',
      weatherForecast
    };
  } catch (error) {
    console.error('Calculate irrigation need error:', error);
    return null;
  }
};

// Get irrigation recommendations for a farm
export const getIrrigationRecommendations = async (
  farmId: string,
  farmerId: string
): Promise<IrrigationRecommendation[]> => {
  try {
    const farm = await Farm.findOne({
      where: { id: farmId, farmerId }
    });

    if (!farm) {
      return [];
    }

    const crops = await Crop.findAll({
      where: { farmId, status: 'active' },
      include: [
        {
          model: CropHealth,
          as: 'healthRecords',
          limit: 1,
          order: [['recordedAt', 'DESC']]
        }
      ]
    });

    // Get latest sensor readings
    const devices = await IoTDevice.findAll({
      where: { farmId, deviceType: 'soil_sensor', status: 'active' }
    });

    let latestSensorData: SensorReading | null = null;
    if (devices.length > 0) {
      latestSensorData = await SensorReading.findOne({
        where: { deviceId: devices[0].id },
        order: [['recordedAt', 'DESC']]
      });
    }

    const recommendations: IrrigationRecommendation[] = [];

    for (const crop of crops) {
      const latestHealth = (crop as any).healthRecords?.[0] || null;
      const recommendation = await calculateIrrigationNeed(
        crop,
        farm,
        latestHealth,
        latestSensorData
      );

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return recommendations;
  } catch (error) {
    console.error('Get irrigation recommendations error:', error);
    return [];
  }
};

// Create irrigation schedule
export const createIrrigationSchedule = async (
  farmId: string,
  cropId: string | null,
  deviceId: string | null,
  scheduledTime: Date,
  durationMinutes: number,
  triggeredBy: 'manual' | 'auto' | 'schedule' | 'sensor'
): Promise<IrrigationSchedule> => {
  const farm = await Farm.findByPk(farmId);

  // Get weather condition at scheduling time
  let weatherCondition = null;
  if (farm) {
    const lat = parseFloat(farm.latitude.toString());
    const lon = parseFloat(farm.longitude.toString());
    weatherCondition = await getCurrentWeather(lat, lon);
  }

  const schedule = await IrrigationSchedule.create({
    farmId,
    cropId,
    deviceId,
    scheduledTime,
    durationMinutes,
    triggeredBy,
    status: 'scheduled',
    weatherCondition
  });

  return schedule;
};

// Trigger immediate irrigation
export const triggerIrrigation = async (
  scheduleId: string
): Promise<boolean> => {
  try {
    const schedule = await IrrigationSchedule.findByPk(scheduleId, {
      include: [{ model: IoTDevice, as: 'device' }]
    });

    if (!schedule) {
      return false;
    }

    // Update status
    await schedule.update({
      status: 'in_progress',
      executedAt: new Date()
    });

    // Send command to IoT device
    const device = (schedule as any).device;
    if (device) {
      publishCommand(schedule.farmId, device.deviceId, 'start', {
        scheduleId: schedule.id,
        durationMinutes: schedule.durationMinutes
      });
    }

    return true;
  } catch (error) {
    console.error('Trigger irrigation error:', error);
    return false;
  }
};

// Update irrigation status (called from MQTT handler)
export const updateIrrigationStatus = async (
  scheduleId: string,
  status: 'completed' | 'failed',
  actualVolume?: number
): Promise<void> => {
  try {
    const schedule = await IrrigationSchedule.findByPk(scheduleId);

    if (schedule) {
      await schedule.update({
        status,
        completedAt: new Date(),
        actualVolumeLiters: actualVolume
      });

      // Create notification
      const farm = await Farm.findByPk(schedule.farmId);
      if (farm) {
        await createNotification({
          farmerId: farm.farmerId,
          farmId: farm.id,
          type: 'irrigation',
          priority: status === 'failed' ? 'high' : 'low',
          title: status === 'completed' ? 'Irrigation Completed' : 'Irrigation Failed',
          message: status === 'completed'
            ? `Irrigation completed for ${schedule.durationMinutes} minutes`
            : 'Irrigation failed. Please check your equipment.',
          channels: ['in_app']
        });
      }
    }
  } catch (error) {
    console.error('Update irrigation status error:', error);
  }
};
