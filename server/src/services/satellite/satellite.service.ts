import axios from 'axios';
import { Farm, Crop, CropHealth } from '../../models';
import { agromonitoringService } from './agromonitoring.service';
import { logger } from '../../utils/logger';

const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';

interface Polygon {
  id: string;
  name: string;
  center: [number, number];
  area: number;
}

interface NDVIData {
  dt: number;
  source: string;
  dc: number;
  cl: number;
  data: {
    std: number;
    p75: number;
    min: number;
    max: number;
    median: number;
    p25: number;
    num: number;
    mean: number;
  };
}

interface SatelliteImage {
  dt: number;
  type: string;
  dc: number;
  cl: number;
  sun: { azimuth: number; elevation: number };
  image: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
  tile: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
  stats: {
    ndvi: string;
    evi: string;
  };
  data: {
    truecolor: string;
    falsecolor: string;
    ndvi: string;
    evi: string;
  };
}

// MOCK: Create a polygon for a farm (Always returns success)
export const createPolygon = async (
  farm: Farm,
  boundary: any
): Promise<Polygon | null> => {
  // Mock success response
  return {
    id: `mock-poly-${farm.id}`,
    name: `Farm-${farm.id}`,
    center: [0, 0], // Placeholder
    area: farm.areaHectares || 10
  };
};

// MOCK: Get polygon by ID
export const getPolygon = async (polygonId: string): Promise<Polygon | null> => {
  return {
    id: polygonId,
    name: 'Mock Polygon',
    center: [0, 0],
    area: 10
  };
};

// MOCK: Delete polygon
export const deletePolygon = async (polygonId: string): Promise<boolean> => {
  return true;
};

// REAL: Get NDVI data for a polygon using Agromonitoring
export const getNDVIData = async (
  polygonId: string,
  startDate: Date,
  endDate: Date,
  lat: number = 0,
  lon: number = 0,
  farmId: string = ''
): Promise<any[]> => {
  // FIX 1: Old gate only caught 'mock-' prefix. 'poly-{uuid}' (set by farm.routes)
  // was not caught, so a fake ID was sent to the API and silently fell back to mock.
  // New rule: if the API key is missing OR the polygonId is not a raw API-issued ID
  // (i.e. it contains our constructed prefixes 'mock-' or 'poly-'), resolve a real
  // polygon via getOrCreatePolygon() which deduplicates against the API.
  const needsRealPoly =
    !polygonId ||
    polygonId.startsWith('mock-') ||
    polygonId.startsWith('poly-');

  let polyId = polygonId;

  if (agromonitoringService.isConfigured() && needsRealPoly && lat !== 0 && lon !== 0) {
    const resolved = await agromonitoringService.getOrCreatePolygon(
      farmId || polygonId, lat, lon
    );
    if (resolved) polyId = resolved;
  }

  // FIX 2: getNDVI() now calls getStatistics() internally and returns records
  // with a resolved numeric ndviMean field — no more URL-string type confusion.
  let data = await agromonitoringService.getNDVI(polyId, startDate, endDate);

  // Fallback: API key missing, coordinates zero, or API returned nothing
  if (!data || data.length === 0) {
    logger.debug('[Satellite] Using mock NDVI fallback');
    const mockNdvi = parseFloat((0.55 + Math.random() * 0.30).toFixed(3)); // 0.55–0.85
    data = [{
      dt: Math.floor(endDate.getTime() / 1000),
      ndviMean: mockNdvi,                          // numeric — consistent with real path
      stats:  { ndvi: mockNdvi },                  // kept for legacy callers
      data:   { mean: mockNdvi },
      image:  { ndvi: 'https://placehold.co/600x400/10b981/ffffff?text=Mock+NDVI+Map' },
      _isMock: true,
    }];
  }

  return data;
};

// REAL: Get satellite imagery — now threads farmId + coords through to getNDVIData
export const getSatelliteImagery = async (
  polygonId: string,
  startDate: Date,
  endDate: Date,
  lat: number = 0,
  lon: number = 0,
  farmId: string = ''
): Promise<any[]> => {
    return await getNDVIData(polygonId, startDate, endDate, lat, lon, farmId);
};

// REAL: Get current weather for a location using Open-Meteo
export const getCurrentWeather = async (
  lat: number,
  lon: number
): Promise<any> => {
  try {
    const response = await axios.get(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain&timezone=auto`
    );

    // Transform Open-Meteo response to match expected structure somewhat, 
    // or just return compatible fields used by health calculation.
    const current = response.data.current;

    return {
      main: {
        temp: current.temperature_2m,
        humidity: current.relative_humidity_2m
      },
      weather: [{ main: current.rain > 0 ? 'Rain' : 'Clear' }]
    };
  } catch (error: any) {
    console.error('Error getting weather from Open-Meteo:', error.message);
    if (error.response) {
      console.error('Open-Meteo Response:', error.response.status, error.response.data);
    }

    // Fallback to Mock Data
    console.log('Falling back to mock weather data');
    return {
      main: {
        temp: 25 + Math.random() * 5, // Random temp between 25-30
        humidity: 60 + Math.random() * 20 // Random humidity 60-80
      },
      weather: [{ main: Math.random() > 0.7 ? 'Rain' : 'Clear' }]
    };
  }
};

// REAL: Get weather forecast using Open-Meteo
export const getWeatherForecast = async (
  lat: number,
  lon: number
): Promise<any> => {
  try {
    const response = await axios.get(
      `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`
    );
    return response.data;
  } catch (error: any) {
    console.error('Error getting forecast from Open-Meteo:', error.message);
    // Fallback to mock forecast
    return {
      daily: {
        time: Array.from({ length: 7 }, (_, i) => {
          const d = new Date();
          d.setDate(d.getDate() + i);
          return d.toISOString().split('T')[0];
        }),
        temperature_2m_max: Array.from({ length: 7 }, () => 30 + Math.random() * 5),
        temperature_2m_min: Array.from({ length: 7 }, () => 20 + Math.random() * 5),
        precipitation_sum: Array.from({ length: 7 }, () => Math.random() * 10)
      }
    };
  }
};

// MOCK: Get soil data
export const getSoilData = async (polygonId: string): Promise<any> => {
  return {
    t0: 285, // Temp surface
    t10: 286, // Temp 10cm
    moisture: 0.25 // Volumetric water content
  };
};

// MOCK: Get UV Index
export const getUVIndex = async (lat: number, lon: number): Promise<any> => {
  return { uvi: 5.5 };
};

// Calculate health score from NDVI
export const calculateHealthScore = (ndvi: number): number => {
  // NDVI ranges: -1 to 1
  if (ndvi < 0) return 0;
  if (ndvi < 0.2) return Math.round(ndvi * 100);
  if (ndvi < 0.4) return Math.round(20 + (ndvi - 0.2) * 150);
  if (ndvi < 0.6) return Math.round(50 + (ndvi - 0.4) * 150);
  return Math.round(80 + (ndvi - 0.6) * 50);
};

// Determine health status from score
export const getHealthStatus = (score: number): 'excellent' | 'healthy' | 'moderate' | 'stressed' | 'critical' => {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'healthy';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'stressed';
  return 'critical';
};

// Generate recommendations based on health data
export const generateRecommendations = (
  healthScore: number,
  ndvi: number,
  moisture: number | null,
  temperature: number | null
): string[] => {
  const recommendations: string[] = [];

  // NDVI-based recommendations
  if (ndvi < 0.3) {
    recommendations.push('Crop shows signs of stress. Check for pest infestation or disease.');
    recommendations.push('Consider soil testing for nutrient deficiencies.');
  } else if (ndvi < 0.5) {
    recommendations.push('Moderate vegetation health. Ensure adequate water and nutrients.');
  }

  // Moisture-based recommendations
  if (moisture !== null) {
    if (moisture < 30) {
      recommendations.push('Soil moisture is low. Schedule irrigation soon.');
    } else if (moisture > 80) {
      recommendations.push('Soil moisture is high. Reduce irrigation to prevent waterlogging.');
    }
  }

  // Temperature-based recommendations
  if (temperature !== null) {
    if (temperature > 35) {
      recommendations.push('High temperature detected. Consider increasing irrigation frequency.');
      recommendations.push('Apply mulching to retain soil moisture.');
    } else if (temperature < 10) {
      recommendations.push('Low temperature detected. Monitor for frost damage.');
    }
  }

  // General recommendations based on health score
  if (healthScore < 40) {
    recommendations.push('Consider consulting an agricultural expert for detailed assessment.');
  }

  return recommendations;
};

// Fetch and store crop health data
export const updateCropHealth = async (crop: Crop, polygonId: string): Promise<CropHealth | null> => {
  try {
    const endDate   = new Date();
    const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    const farm = await Farm.findByPk(crop.farmId);
    let lat = 0, lon = 0, weatherData = null;

    if (farm) {
      lat         = parseFloat(farm.latitude.toString());
      lon         = parseFloat(farm.longitude.toString());
      weatherData = await getCurrentWeather(lat, lon);
    }

    // Pass farmId + coords so real polygon resolution works
    const ndviData = await getNDVIData(polygonId, startDate, endDate, lat, lon, crop.farmId);
    if (!ndviData || ndviData.length === 0) return null;

    const latestImage = ndviData[ndviData.length - 1];
    const isMock      = latestImage._isMock === true;

    // FIX 3: ndviMean is now a guaranteed number on both real and mock paths.
    // Old code checked typeof stats?.ndvi === 'number' which always failed for real
    // API responses (stats.ndvi is a URL string there), silently defaulting to 0.65.
    const ndviValue: number =
      typeof latestImage.ndviMean === 'number'
        ? latestImage.ndviMean
        : typeof latestImage.data?.mean === 'number'
          ? latestImage.data.mean
          : 0.65;

    const healthScore  = calculateHealthScore(ndviValue);
    const healthStatus = getHealthStatus(healthScore);
    const temperature  = weatherData?.main?.temp  ?? null;
    const humidity     = weatherData?.main?.humidity ?? null;

    const recommendations = generateRecommendations(healthScore, ndviValue, null, temperature);
    const satelliteImageUrl = latestImage.image?.ndvi || latestImage.image?.truecolor || null;

    // FIX 4: dataSource now accurately reflects whether real satellite data was used.
    const dataSource = isMock
      ? 'mock'
      : agromonitoringService.isConfigured()
        ? 'agromonitoring'
        : 'mock';

    const healthRecord = await CropHealth.create({
      cropId: crop.id,
      recordedAt: new Date(),
      ndviValue,
      healthScore,
      healthStatus,
      moistureLevel: null,
      temperature,
      humidity,
      rainfallMm:   null,
      soilMoisture: null,
      recommendations,
      satelliteImageUrl,
      dataSource,
    });

    return healthRecord;
  } catch (error) {
    console.error('Error updating crop health:', error);
    return null;
  }
};
