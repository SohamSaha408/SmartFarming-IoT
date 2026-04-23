"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const validation_middleware_1 = require("../middleware/validation.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const models_1 = require("../models");
const sequelize_1 = require("sequelize");
const irrigationService = __importStar(require("../services/irrigation/irrigation.service"));
const router = (0, express_1.Router)();
router.use(auth_middleware_1.authenticate);
// Get irrigation recommendations for a farm
router.get('/recommendations', (0, validation_middleware_1.validate)([
    (0, express_validator_1.query)('farmId').isUUID().withMessage('Farm ID is required')
]), async (req, res) => {
    try {
        const recommendations = await irrigationService.getIrrigationRecommendations(req.query.farmId, req.farmer.id);
        res.json({ recommendations });
    }
    catch (error) {
        console.error('Get recommendations error:', error);
        res.status(500).json({ error: 'Failed to get recommendations' });
    }
});
// Get irrigation schedules
router.get('/schedule', (0, validation_middleware_1.validate)([
    (0, express_validator_1.query)('farmId').optional().isUUID(),
    (0, express_validator_1.query)('status').optional().isIn(['pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled']),
    (0, express_validator_1.query)('startDate').optional().isISO8601(),
    (0, express_validator_1.query)('endDate').optional().isISO8601()
]), async (req, res) => {
    try {
        // Get farms owned by this farmer
        const farms = await models_1.Farm.findAll({
            where: { farmerId: req.farmer.id },
            attributes: ['id']
        });
        const farmIds = farms.map(f => f.id);
        const whereClause = {
            farmId: req.query.farmId
                ? req.query.farmId
                : { [sequelize_1.Op.in]: farmIds }
        };
        if (req.query.status) {
            whereClause.status = req.query.status;
        }
        if (req.query.startDate || req.query.endDate) {
            whereClause.scheduledTime = {};
            if (req.query.startDate) {
                whereClause.scheduledTime[sequelize_1.Op.gte] = new Date(req.query.startDate);
            }
            if (req.query.endDate) {
                whereClause.scheduledTime[sequelize_1.Op.lte] = new Date(req.query.endDate);
            }
        }
        const schedules = await models_1.IrrigationSchedule.findAll({
            where: whereClause,
            include: [
                { model: models_1.Farm, as: 'farm', attributes: ['name'] },
                { model: models_1.Crop, as: 'crop', attributes: ['cropType'] },
                { model: models_1.IoTDevice, as: 'device', attributes: ['name', 'deviceId'] }
            ],
            order: [['scheduledTime', 'ASC']]
        });
        res.json({ schedules });
    }
    catch (error) {
        console.error('Get schedules error:', error);
        res.status(500).json({ error: 'Failed to get schedules' });
    }
});
// Create irrigation schedule
router.post('/schedule', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('farmId').isUUID().withMessage('Farm ID is required'),
    (0, express_validator_1.body)('cropId').optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)('deviceId').optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)('scheduledTime').isISO8601().withMessage('Scheduled time is required'),
    (0, express_validator_1.body)('durationMinutes')
        .isInt({ min: 1, max: 480 })
        .withMessage('Duration must be between 1 and 480 minutes'),
    (0, express_validator_1.body)('triggeredBy')
        .optional()
        .isIn(['manual', 'schedule'])
        .withMessage('Invalid trigger type')
]), async (req, res) => {
    try {
        // Verify farm ownership
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.body.farmId,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const schedule = await irrigationService.createIrrigationSchedule(req.body.farmId, req.body.cropId || null, req.body.deviceId || null, new Date(req.body.scheduledTime), req.body.durationMinutes, req.body.triggeredBy || 'manual');
        res.status(201).json({
            message: 'Irrigation scheduled successfully',
            schedule
        });
    }
    catch (error) {
        console.error('Create schedule error:', error);
        res.status(500).json({ error: 'Failed to create schedule' });
    }
});
// Trigger immediate irrigation
router.post('/trigger', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('farmId').isUUID().withMessage('Farm ID is required'),
    (0, express_validator_1.body)('cropId').optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)('deviceId').optional({ nullable: true }).isUUID(),
    (0, express_validator_1.body)('durationMinutes')
        .isInt({ min: 1, max: 480 })
        .withMessage('Duration must be between 1 and 480 minutes')
]), async (req, res) => {
    try {
        // Verify farm ownership
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.body.farmId,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        // Create and immediately trigger
        const schedule = await irrigationService.createIrrigationSchedule(req.body.farmId, req.body.cropId || null, req.body.deviceId || null, new Date(), req.body.durationMinutes, 'manual');
        const success = await irrigationService.triggerIrrigation(schedule.id);
        if (!success) {
            res.status(500).json({ error: 'Failed to trigger irrigation' });
            return;
        }
        res.json({
            message: 'Irrigation started',
            schedule
        });
    }
    catch (error) {
        console.error('Trigger irrigation error:', error);
        res.status(500).json({ error: 'Failed to trigger irrigation' });
    }
});
// Trigger immediate stop (Manual Override)
router.post('/stop', (0, validation_middleware_1.validate)([
    (0, express_validator_1.body)('farmId').isUUID().withMessage('Farm ID is required')
]), async (req, res) => {
    try {
        // Verify farm ownership
        const farm = await models_1.Farm.findOne({
            where: {
                id: req.body.farmId,
                farmerId: req.farmer.id
            }
        });
        if (!farm) {
            res.status(404).json({ error: 'Farm not found' });
            return;
        }
        const success = await irrigationService.stopIrrigation(req.body.farmId);
        if (!success) {
            res.status(500).json({ error: 'Failed to stop irrigation' });
            return;
        }
        res.json({ message: 'Irrigation stopped manually' });
    }
    catch (error) {
        console.error('Stop irrigation error:', error);
        res.status(500).json({ error: 'Failed to stop irrigation' });
    }
});
// Cancel irrigation schedule
router.post('/schedule/:id/cancel', (0, validation_middleware_1.validate)([
    (0, express_validator_1.param)('id').isUUID().withMessage('Invalid schedule ID')
]), async (req, res) => {
    try {
        const schedule = await models_1.IrrigationSchedule.findByPk(req.params.id, {
            include: [
                {
                    model: models_1.Farm,
                    as: 'farm',
                    where: { farmerId: req.farmer.id }
                }
            ]
        });
        if (!schedule) {
            res.status(404).json({ error: 'Schedule not found' });
            return;
        }
        if (['completed', 'failed', 'cancelled'].includes(schedule.status)) {
            res.status(400).json({ error: 'Cannot cancel completed or failed schedule' });
            return;
        }
        await schedule.update({ status: 'cancelled' });
        res.json({ message: 'Schedule cancelled successfully' });
    }
    catch (error) {
        console.error('Cancel schedule error:', error);
        res.status(500).json({ error: 'Failed to cancel schedule' });
    }
});
// Get irrigation history and analytics
router.get('/history', (0, validation_middleware_1.validate)([
    (0, express_validator_1.query)('farmId').optional().isUUID(),
    (0, express_validator_1.query)('days').optional().isInt({ min: 1, max: 365 }).toInt()
]), async (req, res) => {
    try {
        const days = req.query.days || 30;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        // Get farms owned by this farmer
        const farms = await models_1.Farm.findAll({
            where: { farmerId: req.farmer.id },
            attributes: ['id']
        });
        const farmIds = farms.map(f => f.id);
        const whereClause = {
            farmId: req.query.farmId
                ? req.query.farmId
                : { [sequelize_1.Op.in]: farmIds },
            status: 'completed',
            completedAt: { [sequelize_1.Op.gte]: startDate }
        };
        const completedIrrigations = await models_1.IrrigationSchedule.findAll({
            where: whereClause,
            include: [
                { model: models_1.Farm, as: 'farm', attributes: ['name'] },
                { model: models_1.Crop, as: 'crop', attributes: ['cropType'] }
            ],
            order: [['completedAt', 'DESC']]
        });
        // Calculate statistics
        const totalSessions = completedIrrigations.length;
        const totalDuration = completedIrrigations.reduce((sum, s) => sum + s.durationMinutes, 0);
        const totalVolume = completedIrrigations.reduce((sum, s) => sum + (parseFloat(s.actualVolumeLiters?.toString() || '0')), 0);
        res.json({
            history: completedIrrigations,
            statistics: {
                totalSessions,
                totalDurationMinutes: totalDuration,
                totalVolumeLiters: totalVolume,
                averageDurationMinutes: totalSessions > 0
                    ? Math.round(totalDuration / totalSessions)
                    : 0,
                periodDays: days
            }
        });
    }
    catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({ error: 'Failed to get irrigation history' });
    }
});
exports.default = router;
//# sourceMappingURL=irrigation.routes.js.map