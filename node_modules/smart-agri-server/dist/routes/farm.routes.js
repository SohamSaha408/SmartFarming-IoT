"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const models_1 = require("../models");
const geocoding_service_1 = require("../services/satellite/geocoding.service");
const satellite_service_1 = require("../services/satellite/satellite.service");
const router = (0, express_1.Router)();
// All routes require authentication
router.use(auth_middleware_1.authenticate);
// Get all farms for the authenticated farmer
router.get('/', async (req, res) => {
    try {
        const farms = await models_1.Farm.findAll({
            where: { farmerId: req.farmer.id },
            include: [
                { model: models_1.Crop, as: 'crops', attributes: ['id', 'cropType', 'status'] },
                { model: models_1.IoTDevice, as: 'devices', attributes: ['id', 'deviceType', 'status'] }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ farms });
    }
    catch (error) {
        console.error('Get farms error:', error);
        res.status(500).json({ error: 'Failed to fetch farms' });
    }
});
// Create a new farm
router.post('/', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('name')
        .notEmpty()
        .withMessage('Farm name is required')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('latitude')
        .notEmpty()
        .withMessage('Latitude is required')
        .isFloat({ min: -90, max: 90 })
        .withMessage('Invalid latitude'),
    (0, express_validator_1.body)('longitude')
        .notEmpty()
        .withMessage('Longitude is required')
        .isFloat({ min: -180, max: 180 })
        .withMessage('Invalid longitude'),
    (0, express_validator_1.body)('boundary')
        .optional()
        .isObject()
        .withMessage('Boundary must be a valid GeoJSON object'),
    (0, express_validator_1.body)('areaHectares')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Area must be a positive number'),
    (0, express_validator_1.body)('landType')
        .optional()
        .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
        .withMessage('Invalid land type'),
    (0, express_validator_1.body)('soilPh')
        .optional()
        .isFloat({ min: 0, max: 14 })
        .withMessage('Soil pH must be between 0 and 14')
]), async (req, res) => {
    try {
        const { name, latitude, longitude, boundary, areaHectares, landType, soilPh } = req.body;
        // Get location details from coordinates
        const locationDetails = await (0, geocoding_service_1.reverseGeocode)(latitude, longitude);
        const farm = await models_1.Farm.create({
            farmerId: req.farmer.id,
            name,
            latitude,
            longitude,
            boundary,
            areaHectares,
            landType,
            soilPh,
            village: locationDetails.village,
            district: locationDetails.district,
            state: locationDetails.state,
            pincode: locationDetails.pincode
        });
        res.status(201).json({
            message: 'Farm created successfully',
            farm
        });
    }
    catch (error) {
        console.error('Create farm error:', error);
        res.status(500).json({ error: 'Failed to create farm' });
    }
});
// Get a specific farm
router.get('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid farm ID')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id
            },
            include: [
                {
                    model: models_1.Crop,
                    as: 'crops',
                    where: { status: 'active' },
                    required: false
                },
                {
                    model: models_1.IoTDevice,
                    as: 'devices',
                    where: { status: 'active' },
                    required: false
                },
                {
                    model: models_1.IrrigationSchedule,
                    as: 'irrigationSchedules',
                    where: { status: ['pending', 'scheduled'] },
                    required: false,
                    limit: 5,
                    order: [['scheduledTime', 'ASC']]
                }
            ]
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        res.json({ farm });
    }
    catch (error) {
        console.error('Get farm error:', error);
        res.status(500).json({ error: 'Failed to fetch farm' });
    }
});
// Update a farm
router.put('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid farm ID'),
    (0, express_validator_1.body)('name')
        .optional()
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters'),
    (0, express_validator_1.body)('boundary')
        .optional()
        .isObject()
        .withMessage('Boundary must be a valid GeoJSON object'),
    (0, express_validator_1.body)('areaHectares')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('Area must be a positive number'),
    (0, express_validator_1.body)('landType')
        .optional()
        .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
        .withMessage('Invalid land type'),
    (0, express_validator_1.body)('soilPh')
        .optional()
        .isFloat({ min: 0, max: 14 })
        .withMessage('Soil pH must be between 0 and 14')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const { name, boundary, areaHectares, landType, soilPh } = req.body;
        await farm.update({
            name: name || farm.name,
            boundary: boundary || farm.boundary,
            areaHectares: areaHectares ?? farm.areaHectares,
            landType: landType || farm.landType,
            soilPh: soilPh ?? farm.soilPh
        });
        res.json({
            message: 'Farm updated successfully',
            farm
        });
    }
    catch (error) {
        console.error('Update farm error:', error);
        res.status(500).json({ error: 'Failed to update farm' });
    }
});
// Delete a farm
router.delete('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid farm ID')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        await farm.destroy();
        res.json({ message: 'Farm deleted successfully' });
    }
    catch (error) {
        console.error('Delete farm error:', error);
        res.status(500).json({ error: 'Failed to delete farm' });
    }
});
// Get weather for a farm
router.get('/:id/weather', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid farm ID')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const lat = parseFloat(farm.latitude.toString());
        const lon = parseFloat(farm.longitude.toString());
        const [current, forecast] = await Promise.all([
            (0, satellite_service_1.getCurrentWeather)(lat, lon),
            (0, satellite_service_1.getWeatherForecast)(lat, lon)
        ]);
        res.json({
            current,
            forecast,
            location: {
                latitude: lat,
                longitude: lon,
                village: farm.village,
                district: farm.district,
                state: farm.state
            }
        });
    }
    catch (error) {
        console.error('Get weather error:', error);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});
// Get satellite data for a farm
router.get('/:id/satellite', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid farm ID'),
    (0, express_validator_1.query)('startDate').optional().isISO8601().withMessage('Invalid start date'),
    (0, express_validator_1.query)('endDate').optional().isISO8601().withMessage('Invalid end date')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.id,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        // Use the farm's polygon ID if available, otherwise use a generated ID based on farm ID
        const polygonId = farm.boundary ? `poly-${farm.id}` : `mock-poly-${farm.id}`;
        // Fetch satellite imagery
        const imagery = await (0, satellite_service_1.getSatelliteImagery)(polygonId, startDate, endDate);
        res.json({
            farmId: farm.id,
            imagery
        });
    }
    catch (error) {
        console.error('Get satellite data error:', error);
        res.status(500).json({ error: 'Failed to fetch satellite data' });
    }
});
exports.default = router;
//# sourceMappingURL=farm.routes.js.map