"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCropHealth = exports.generateRecommendations = exports.getHealthStatus = exports.calculateHealthScore = exports.getUVIndex = exports.getSoilData = exports.getWeatherForecast = exports.getCurrentWeather = exports.getSatelliteImagery = exports.getNDVIData = exports.deletePolygon = exports.getPolygon = exports.createPolygon = void 0;
const axios_1 = __importDefault(require("axios"));
const models_1 = require("../../models");
const OPEN_METEO_URL = 'https://api.open-meteo.com/v1/forecast';
// MOCK: Create a polygon for a farm (Always returns success)
const createPolygon = async (farm, boundary) => {
    // Mock success response
    return {
        id: `mock-poly-${farm.id}`,
        name: `Farm-${farm.id}`,
        center: [0, 0], // Placeholder
        area: farm.areaHectares || 10
    };
};
exports.createPolygon = createPolygon;
// MOCK: Get polygon by ID
const getPolygon = async (polygonId) => {
    return {
        id: polygonId,
        name: 'Mock Polygon',
        center: [0, 0],
        area: 10
    };
};
exports.getPolygon = getPolygon;
// MOCK: Delete polygon
const deletePolygon = async (polygonId) => {
    return true;
};
exports.deletePolygon = deletePolygon;
// MOCK: Get NDVI data for a polygon
const getNDVIData = async (polygonId, startDate, endDate) => {
    // Generate realistic mock data
    const data = [];
    const days = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    // Generate a data point every few days
    for (let i = 0; i <= days; i += 3) {
        const currentDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const mockNdviMean = 0.4 + Math.random() * 0.4; // 0.4 to 0.8 (Moderate to Healthy)
        data.push({
            dt: Math.floor(currentDate.getTime() / 1000),
            source: 'Mock Satellite',
            dc: 0,
            cl: 0,
            data: {
                std: 0.1,
                p75: mockNdviMean + 0.05,
                min: mockNdviMean - 0.1,
                max: mockNdviMean + 0.1,
                median: mockNdviMean,
                p25: mockNdviMean - 0.05,
                num: 100,
                mean: mockNdviMean
            }
        });
    }
    return data;
};
exports.getNDVIData = getNDVIData;
// MOCK: Get satellite imagery for a polygon
const getSatelliteImagery = async (polygonId, startDate, endDate) => {
    // Return a single mock image
    return [{
            dt: Math.floor(endDate.getTime() / 1000),
            type: 'mock',
            dc: 0,
            cl: 0,
            sun: { azimuth: 100, elevation: 50 },
            image: {
                truecolor: 'https://placehold.co/600x400/green/white?text=Satellite+View',
                falsecolor: 'https://placehold.co/600x400/red/white?text=False+Color',
                ndvi: 'https://placehold.co/600x400/00aa00/white?text=NDVI+Map',
                evi: 'https://placehold.co/600x400/00aa00/white?text=EVI+Map'
            },
            tile: {
                truecolor: '',
                falsecolor: '',
                ndvi: '',
                evi: ''
            },
            stats: {
                ndvi: '0.65',
                evi: '0.45'
            },
            data: {
                truecolor: '',
                falsecolor: '',
                ndvi: '',
                evi: ''
            }
        }];
};
exports.getSatelliteImagery = getSatelliteImagery;
// REAL: Get current weather for a location using Open-Meteo
const getCurrentWeather = async (lat, lon) => {
    try {
        const response = await axios_1.default.get(`${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,rain&timezone=auto`);
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
    }
    catch (error) {
        console.error('Error getting weather from Open-Meteo:', error);
        return null;
    }
};
exports.getCurrentWeather = getCurrentWeather;
// REAL: Get weather forecast using Open-Meteo
const getWeatherForecast = async (lat, lon) => {
    try {
        const response = await axios_1.default.get(`${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto`);
        return response.data;
    }
    catch (error) {
        console.error('Error getting forecast from Open-Meteo:', error);
        return null;
    }
};
exports.getWeatherForecast = getWeatherForecast;
// MOCK: Get soil data
const getSoilData = async (polygonId) => {
    return {
        t0: 285, // Temp surface
        t10: 286, // Temp 10cm
        moisture: 0.25 // Volumetric water content
    };
};
exports.getSoilData = getSoilData;
// MOCK: Get UV Index
const getUVIndex = async (lat, lon) => {
    return { uvi: 5.5 };
};
exports.getUVIndex = getUVIndex;
// Calculate health score from NDVI
const calculateHealthScore = (ndvi) => {
    // NDVI ranges: -1 to 1
    if (ndvi < 0)
        return 0;
    if (ndvi < 0.2)
        return Math.round(ndvi * 100);
    if (ndvi < 0.4)
        return Math.round(20 + (ndvi - 0.2) * 150);
    if (ndvi < 0.6)
        return Math.round(50 + (ndvi - 0.4) * 150);
    return Math.round(80 + (ndvi - 0.6) * 50);
};
exports.calculateHealthScore = calculateHealthScore;
// Determine health status from score
const getHealthStatus = (score) => {
    if (score >= 80)
        return 'excellent';
    if (score >= 60)
        return 'healthy';
    if (score >= 40)
        return 'moderate';
    if (score >= 20)
        return 'stressed';
    return 'critical';
};
exports.getHealthStatus = getHealthStatus;
// Generate recommendations based on health data
const generateRecommendations = (healthScore, ndvi, moisture, temperature) => {
    const recommendations = [];
    // NDVI-based recommendations
    if (ndvi < 0.3) {
        recommendations.push('Crop shows signs of stress. Check for pest infestation or disease.');
        recommendations.push('Consider soil testing for nutrient deficiencies.');
    }
    else if (ndvi < 0.5) {
        recommendations.push('Moderate vegetation health. Ensure adequate water and nutrients.');
    }
    // Moisture-based recommendations
    if (moisture !== null) {
        if (moisture < 30) {
            recommendations.push('Soil moisture is low. Schedule irrigation soon.');
        }
        else if (moisture > 80) {
            recommendations.push('Soil moisture is high. Reduce irrigation to prevent waterlogging.');
        }
    }
    // Temperature-based recommendations
    if (temperature !== null) {
        if (temperature > 35) {
            recommendations.push('High temperature detected. Consider increasing irrigation frequency.');
            recommendations.push('Apply mulching to retain soil moisture.');
        }
        else if (temperature < 10) {
            recommendations.push('Low temperature detected. Monitor for frost damage.');
        }
    }
    // General recommendations based on health score
    if (healthScore < 40) {
        recommendations.push('Consider consulting an agricultural expert for detailed assessment.');
    }
    return recommendations;
};
exports.generateRecommendations = generateRecommendations;
// Fetch and store crop health data (Uses Mocks + Open-Meteo)
const updateCropHealth = async (crop, polygonId) => {
    try {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // Last 7 days
        // Get Mock NDVI data
        const ndviData = await (0, exports.getNDVIData)(polygonId, startDate, endDate);
        if (ndviData.length === 0) {
            return null;
        }
        // Get latest NDVI
        const latestNDVI = ndviData[ndviData.length - 1];
        const ndviValue = latestNDVI.data.mean;
        // Get Real Weather data
        const farm = await models_1.Farm.findByPk(crop.farmId);
        let weatherData = null;
        if (farm) {
            weatherData = await (0, exports.getCurrentWeather)(parseFloat(farm.latitude.toString()), parseFloat(farm.longitude.toString()));
        }
        // Calculate health metrics
        const healthScore = (0, exports.calculateHealthScore)(ndviValue);
        const healthStatus = (0, exports.getHealthStatus)(healthScore);
        const temperature = weatherData?.main?.temp || null;
        const humidity = weatherData?.main?.humidity || null;
        const moisture = null; // Would come from sensors
        const recommendations = (0, exports.generateRecommendations)(healthScore, ndviValue, moisture, temperature);
        // Get Mock satellite image URL
        const imagery = await (0, exports.getSatelliteImagery)(polygonId, startDate, endDate);
        const satelliteImageUrl = imagery.length > 0 ? imagery[imagery.length - 1].image.ndvi : null;
        // Create health record
        const healthRecord = await models_1.CropHealth.create({
            cropId: crop.id,
            recordedAt: new Date(),
            ndviValue,
            healthScore,
            healthStatus,
            moistureLevel: moisture,
            temperature,
            humidity,
            rainfallMm: null,
            soilMoisture: null,
            recommendations,
            satelliteImageUrl,
            dataSource: 'mock-agromonitoring'
        });
        return healthRecord;
    }
    catch (error) {
        console.error('Error updating crop health:', error);
        return null;
    }
};
exports.updateCropHealth = updateCropHealth;
//# sourceMappingURL=satellite.service.js.map