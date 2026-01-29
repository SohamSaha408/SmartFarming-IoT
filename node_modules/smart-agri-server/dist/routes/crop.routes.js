"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Get crop rankings (healthiest and weakest)
router.get('/rankings/all', (0, validation_middleware_1.validate)([
    (0, express_validator_1.query)('landType')
        .optional()
        .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
]), async (req, res) => {
    try {
        // Get all farms owned by this farmer
        const farmWhere = { farmerId: req.farmer.id };
        if (req.query.landType) {
            farmWhere.landType = req.query.landType;
        }
        const farms = await models_1.Farm.findAll({
            where: farmWhere,
            attributes: ['id']
        });
        const farmIds = farms.map(f => f.id);
        // Get all active crops with their latest health records
        const crops = await models_1.Crop.findAll({
            where: {
                farmId: { [sequelize_1.Op.in]: farmIds },
                status: 'active'
            },
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    attributes: ['name', 'landType']
                },
                {
                    model: models_1.CropHealth,
                    as: 'healthRecords',
                    limit: 1,
                    order: [['recordedAt', 'DESC']]
                }
            ]
        });
        // Calculate health scores and sort
        const cropsWithHealth = crops.map(crop => {
            const latestHealth = crop.healthRecords?.[0];
            return {
                id: crop.id,
                cropType: crop.cropType,
                variety: crop.variety,
                farmName: crop.farm?.name,
                landType: crop.farm?.landType,
                healthScore: latestHealth?.healthScore || 0,
                healthStatus: latestHealth?.healthStatus || 'unknown',
                ndviValue: latestHealth?.ndviValue,
                lastUpdated: latestHealth?.recordedAt
            };
        });
        // Sort by health score
        const sorted = cropsWithHealth.sort((a, b) => b.healthScore - a.healthScore);
        // Get top 5 healthiest and bottom 5 weakest
        const healthiest = sorted.slice(0, 5);
        const weakest = sorted.slice(-5).reverse();
        res.json({
            healthiest,
            weakest,
            totalCrops: crops.length,
            averageHealth: cropsWithHealth.length > 0
                ? Math.round(cropsWithHealth.reduce((sum, c) => sum + c.healthScore, 0) / cropsWithHealth.length)
                : 0
        });
    }
    catch (error) {
        console.error('Get rankings error:', error);
        res.status(500).json({ error: 'Failed to fetch crop rankings' });
    }
});
// Get all crops for a farm
router.get('/farm/:farmId', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('farmId').isUUID().withMessage('Invalid farm ID')
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.farmId,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const crops = await models_1.Crop.findAll({
            where: { farmId: req.params.farmId },
            include: [
                {
                    model: models_1.CropHealth,
                    as: 'healthRecords',
                    limit: 1,
                    order: [['recordedAt', 'DESC']]
                }
            ],
            order: [['createdAt', 'DESC']]
        });
        res.json({ crops });
    }
    catch (error) {
        console.error('Get crops error:', error);
        res.status(500).json({ error: 'Failed to fetch crops' });
    }
});
// Create a new crop
router.post('/farm/:farmId', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('farmId').isUUID().withMessage('Invalid farm ID'),
    (0, express_validator_1.body)('cropType')
        .notEmpty()
        .withMessage('Crop type is required')
        .isLength({ max: 50 })
        .withMessage('Crop type must be 50 characters or less'),
    (0, express_validator_1.body)('variety')
        .optional()
        .isLength({ max: 100 }),
    (0, express_validator_1.body)('plantedDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid planted date'),
    (0, express_validator_1.body)('expectedHarvestDate')
        .optional()
        .isISO8601()
        .withMessage('Invalid harvest date'),
    (0, express_validator_1.body)('zoneBoundary')
        .optional()
        .isObject(),
    (0, express_validator_1.body)('areaHectares')
        .optional()
        .isFloat({ min: 0 })
]), async (req, res) => {
    try {
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.params.farmId,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const crop = await models_1.Crop.create({
            farmId: req.params.farmId,
            cropType: req.body.cropType,
            variety: req.body.variety,
            plantedDate: req.body.plantedDate,
            expectedHarvestDate: req.body.expectedHarvestDate,
            zoneBoundary: req.body.zoneBoundary,
            areaHectares: req.body.areaHectares,
            status: 'active'
        });
        res.status(201).json({
            message: 'Crop added successfully',
            crop
        });
    }
    catch (error) {
        console.error('Create crop error:', error);
        res.status(500).json({ error: 'Failed to add crop' });
    }
});
// Get crop details
router.get('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid crop ID')
]), async (req, res) => {
    try {
        const crop = await models_1.Crop.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    where: { farmerId: req.farmer.id }
                },
                {
                    model: models_1.CropHealth,
                    as: 'healthRecords',
                    limit: 10,
                    order: [['recordedAt', 'DESC']]
                }
            ]
        });
        if (!crop) {
            res.status(404).json({ error: 'Crop not found' });
            return;
        }
        res.json({ crop });
    }
    catch (error) {
        console.error('Get crop error:', error);
        res.status(500).json({ error: 'Failed to fetch crop' });
    }
});
// Update crop
router.put('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid crop ID'),
    (0, express_validator_1.body)('cropType').optional().isLength({ max: 50 }),
    (0, express_validator_1.body)('variety').optional().isLength({ max: 100 }),
    (0, express_validator_1.body)('status')
        .optional()
        .isIn(['active', 'harvested', 'failed', 'planned']),
    (0, express_validator_1.body)('actualHarvestDate').optional().isISO8601(),
    (0, express_validator_1.body)('actualYieldKg').optional().isFloat({ min: 0 })
]), async (req, res) => {
    try {
        const crop = await models_1.Crop.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    where: { farmerId: req.farmer.id }
                }
            ]
        });
        if (!crop) {
            res.status(404).json({ error: 'Crop not found' });
            return;
        }
        await crop.update(req.body);
        res.json({
            message: 'Crop updated successfully',
            crop
        });
    }
    catch (error) {
        console.error('Update crop error:', error);
        res.status(500).json({ error: 'Failed to update crop' });
    }
});
// Delete crop
router.delete('/:id', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid crop ID')
]), async (req, res) => {
    try {
        const crop = await models_1.Crop.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    where: { farmerId: req.farmer.id }
                }
            ]
        });
        if (!crop) {
            res.status(404).json({ error: 'Crop not found' });
            return;
        }
        await crop.destroy();
        res.json({ message: 'Crop deleted successfully' });
    }
    catch (error) {
        console.error('Delete crop error:', error);
        res.status(500).json({ error: 'Failed to delete crop' });
    }
});
// Get crop health history
router.get('/:id/health', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid crop ID'),
    (0, express_validator_1.query)('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601()
]), async (req, res) => {
    try {
        const crop = await models_1.Crop.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    where: { farmerId: req.farmer.id }
                }
            ]
        });
        if (!crop) {
            res.status(404).json({ error: 'Crop not found' });
            return;
        }
        const limit = req.query.limit || 30;
        const whereClause = { cropId: crop.id };
        if (req.query.startDate || req.query.endDate) {
            whereClause.recordedAt = {};
            if (req.query.startDate) {
                whereClause.recordedAt[sequelize_1.Op.gte] = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                whereClause.recordedAt[sequelize_1.Op.lte] = new Date(req.query.endDate);
            }
        }
        const healthRecords = await models_1.CropHealth.findAll({
            where: whereClause,
            order: [['recordedAt', 'DESC']],
            limit
        });
        res.json({ healthRecords });
    }
    catch (error) {
        console.error('Get health history error:', error);
        res.status(500).json({ error: 'Failed to fetch health history' });
    }
});
exports.default = router;
//# sourceMappingURL=crop.routes.js.map