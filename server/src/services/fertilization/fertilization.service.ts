import { Crop, CropHealth, FertilizationRecord, SensorReading, IoTDevice, Farm } from '../../models';
import { createNotification } from '../notification/notification.service';

interface FertilizationRecommendation {
  cropId: string;
  cropType: string;
  fertilizerType: string;
  quantityKg: number;
  npkRatio: string;
  urgency: 'low' | 'medium' | 'high';
  reason: string;
  estimatedCost: number;
  growthStage: string;
}

// NPK requirements by crop type (kg per hectare)
const CROP_NPK_REQUIREMENTS: Record<string, { n: number; p: number; k: number }> = {
  rice: { n: 120, p: 60, k: 60 },
  wheat: { n: 120, p: 60, k: 40 },
  cotton: { n: 150, p: 60, k: 60 },
  sugarcane: { n: 250, p: 100, k: 100 },
  maize: { n: 120, p: 60, k: 40 },
  potato: { n: 180, p: 80, k: 100 },
  tomato: { n: 150, p: 100, k: 120 },
  vegetables: { n: 100, p: 50, k: 50 },
  default: { n: 100, p: 50, k: 50 }
};

// Growth stages and their nutrient focus
const GROWTH_STAGES = {
  seedling: { name: 'Seedling Stage', npkFocus: 'balanced', percentage: 0.2 },
  vegetative: { name: 'Vegetative Stage', npkFocus: 'nitrogen', percentage: 0.4 },
  flowering: { name: 'Flowering Stage', npkFocus: 'phosphorus', percentage: 0.25 },
  fruiting: { name: 'Fruiting Stage', npkFocus: 'potassium', percentage: 0.15 }
};

// Fertilizer prices (INR per kg)
const FERTILIZER_PRICES: Record<string, number> = {
  urea: 6,
  dap: 27,
  mop: 17,
  npk_complex: 25,
  organic: 15
};

// Determine growth stage based on planting date
const determineGrowthStage = (plantedDate: Date | null, cropType: string): string => {
  if (!plantedDate) return 'vegetative';

  const now = new Date();
  const daysSincePlanting = Math.floor(
    (now.getTime() - plantedDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Simplified growth stage calculation
  if (daysSincePlanting < 21) return 'seedling';
  if (daysSincePlanting < 60) return 'vegetative';
  if (daysSincePlanting < 90) return 'flowering';
  return 'fruiting';
};

// Get NPK requirements for crop
const getNPKRequirements = (cropType: string) => {
  const normalized = cropType.toLowerCase();
  return CROP_NPK_REQUIREMENTS[normalized] || CROP_NPK_REQUIREMENTS.default;
};

// Calculate fertilization recommendation
export const calculateFertilizationNeed = async (
  crop: Crop,
  sensorData: SensorReading | null,
  latestHealth: CropHealth | null
): Promise<FertilizationRecommendation | null> => {
  try {
    const requirements = getNPKRequirements(crop.cropType);
    const growthStage = determineGrowthStage(crop.plantedDate, crop.cropType);
    const stageInfo = GROWTH_STAGES[growthStage as keyof typeof GROWTH_STAGES];

    const areaHectares = crop.areaHectares 
      ? parseFloat(crop.areaHectares.toString()) 
      : 1;

    let deficientNutrient: 'n' | 'p' | 'k' | null = null;
    let reason = '';
    let urgency: 'low' | 'medium' | 'high' = 'low';

    // Check sensor data for nutrient levels
    if (sensorData) {
      const nLevel = sensorData.nitrogenLevel 
        ? parseFloat(sensorData.nitrogenLevel.toString()) 
        : null;
      const pLevel = sensorData.phosphorusLevel 
        ? parseFloat(sensorData.phosphorusLevel.toString()) 
        : null;
      const kLevel = sensorData.potassiumLevel 
        ? parseFloat(sensorData.potassiumLevel.toString()) 
        : null;

      // Check for deficiencies (threshold: 50 mg/kg)
      if (nLevel !== null && nLevel < 40) {
        deficientNutrient = 'n';
        reason = 'Low nitrogen levels detected in soil';
        urgency = nLevel < 20 ? 'high' : 'medium';
      } else if (pLevel !== null && pLevel < 30) {
        deficientNutrient = 'p';
        reason = 'Low phosphorus levels detected in soil';
        urgency = pLevel < 15 ? 'high' : 'medium';
      } else if (kLevel !== null && kLevel < 40) {
        deficientNutrient = 'k';
        reason = 'Low potassium levels detected in soil';
        urgency = kLevel < 20 ? 'high' : 'medium';
      }
    }

    // Check health status for stress signs
    if (!deficientNutrient && latestHealth?.healthStatus === 'stressed') {
      // Recommend based on growth stage focus
      deficientNutrient = stageInfo.npkFocus === 'nitrogen' ? 'n' :
                          stageInfo.npkFocus === 'phosphorus' ? 'p' :
                          stageInfo.npkFocus === 'potassium' ? 'k' : 'n';
      reason = 'Crop showing stress symptoms - nutrient boost recommended';
      urgency = 'medium';
    }

    // Default scheduled fertilization based on growth stage
    if (!deficientNutrient) {
      deficientNutrient = stageInfo.npkFocus === 'nitrogen' ? 'n' :
                          stageInfo.npkFocus === 'phosphorus' ? 'p' :
                          stageInfo.npkFocus === 'potassium' ? 'k' : 'n';
      reason = `Scheduled fertilization for ${stageInfo.name}`;
      urgency = 'low';
    }

    // Calculate quantities
    const baseN = requirements.n * stageInfo.percentage * areaHectares;
    const baseP = requirements.p * stageInfo.percentage * areaHectares;
    const baseK = requirements.k * stageInfo.percentage * areaHectares;

    // Determine fertilizer type and quantity
    let fertilizerType: string;
    let quantityKg: number;
    let npkRatio: string;

    if (deficientNutrient === 'n') {
      fertilizerType = 'Urea (46-0-0)';
      quantityKg = Math.round(baseN / 0.46);
      npkRatio = '46:0:0';
    } else if (deficientNutrient === 'p') {
      fertilizerType = 'DAP (18-46-0)';
      quantityKg = Math.round(baseP / 0.46);
      npkRatio = '18:46:0';
    } else {
      fertilizerType = 'MOP (0-0-60)';
      quantityKg = Math.round(baseK / 0.60);
      npkRatio = '0:0:60';
    }

    // Calculate cost
    const priceKey = deficientNutrient === 'n' ? 'urea' : 
                     deficientNutrient === 'p' ? 'dap' : 'mop';
    const estimatedCost = Math.round(quantityKg * FERTILIZER_PRICES[priceKey]);

    return {
      cropId: crop.id,
      cropType: crop.cropType,
      fertilizerType,
      quantityKg,
      npkRatio,
      urgency,
      reason,
      estimatedCost,
      growthStage: stageInfo.name
    };
  } catch (error) {
    console.error('Calculate fertilization need error:', error);
    return null;
  }
};

// Get fertilization recommendations for crops
export const getFertilizationRecommendations = async (
  farmId: string,
  farmerId: string
): Promise<FertilizationRecommendation[]> => {
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
      where: { farmId, deviceType: 'npk_sensor', status: 'active' }
    });

    let latestSensorData: SensorReading | null = null;
    if (devices.length > 0) {
      latestSensorData = await SensorReading.findOne({
        where: { deviceId: devices[0].id },
        order: [['recordedAt', 'DESC']]
      });
    }

    const recommendations: FertilizationRecommendation[] = [];

    for (const crop of crops) {
      const latestHealth = (crop as any).healthRecords?.[0] || null;
      const recommendation = await calculateFertilizationNeed(
        crop,
        latestSensorData,
        latestHealth
      );

      if (recommendation) {
        recommendations.push(recommendation);
      }
    }

    // Sort by urgency
    const urgencyOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return recommendations;
  } catch (error) {
    console.error('Get fertilization recommendations error:', error);
    return [];
  }
};

// Create fertilization record
export const createFertilizationRecord = async (
  cropId: string,
  fertilizerType: string,
  quantityKg: number,
  npkRatio: string,
  recommendedDate: Date,
  costEstimate: number
): Promise<FertilizationRecord> => {
  const record = await FertilizationRecord.create({
    cropId,
    // Model field is currently named `fertilzerType` (typo) – keep runtime/db consistent.
    fertilzerType: fertilizerType,
    quantityKg,
    npkRatio,
    recommendedDate,
    costEstimate,
    status: 'recommended'
  });

  return record;
};

// Mark fertilization as applied
export const markAsApplied = async (
  recordId: string,
  actualQuantityKg: number,
  actualCost: number,
  applicationMethod: string,
  notes?: string
): Promise<FertilizationRecord | null> => {
  const record = await FertilizationRecord.findByPk(recordId);

  if (!record) {
    return null;
  }

  await record.update({
    status: 'applied',
    appliedAt: new Date(),
    actualQuantityKg,
    actualCost,
    applicationMethod,
    notes
  });

  // Create notification
  const crop = await Crop.findByPk(record.cropId, {
    include: [{ model: Farm, as: 'farm' }]
  });

  if (crop) {
    const farm = (crop as any).farm;
    await createNotification({
      farmerId: farm.farmerId,
      farmId: farm.id,
      cropId: crop.id,
      type: 'fertilization',
      priority: 'low',
      title: 'Fertilization Applied',
      message: `${record.fertilzerType} applied to ${crop.cropType} (${actualQuantityKg}kg)`,
      channels: ['in_app', 'email']
    });
  }

  return record;
};
