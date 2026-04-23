import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Farm, Crop, IrrigationSchedule, IoTDevice } from '../models';
import { Op } from 'sequelize';
import * as irrigationService from '../services/irrigation/irrigation.service';

const router = Router();

router.use(authenticate);

// Get irrigation recommendations for a farm
router.get(
  '/recommendations',
  validate([
    query('farmId').isUUID().withMessage('Farm ID is required')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const recommendations = await irrigationService.getIrrigationRecommendations(
        req.query.farmId as string,
        req.farmer!.id
      );

      res.json({ recommendations });
    } catch (error) {
      console.error('Get recommendations error:', error);
      res.status(500).json({ error: 'Failed to get recommendations' });
    }
  }
);

// Get irrigation schedules
router.get(
  '/schedule',
  validate([
    query('farmId').optional().isUUID(),
    query('status').optional().isIn(['pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get farms owned by this farmer
      const farms = await Farm.findAll({
        where: { farmerId: req.farmer!.id },
        attributes: ['id']
      });
      const farmIds = farms.map(f => f.id);

      const whereClause: any = {
        farmId: req.query.farmId 
          ? req.query.farmId 
          : { [Op.in]: farmIds }
      };

      if (req.query.status) {
        whereClause.status = req.query.status;
      }

      if (req.query.startDate || req.query.endDate) {
        whereClause.scheduledTime = {};
        if (req.query.startDate) {
          whereClause.scheduledTime[Op.gte] = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          whereClause.scheduledTime[Op.lte] = new Date(req.query.endDate as string);
        }
      }

      const schedules = await IrrigationSchedule.findAll({
        where: whereClause,
        include: [
          { model: Farm, as: 'farm', attributes: ['name'] },
          { model: Crop, as: 'crop', attributes: ['cropType'] },
          { model: IoTDevice, as: 'device', attributes: ['name', 'deviceId'] }
        ],
        order: [['scheduledTime', 'ASC']]
      });

      res.json({ schedules });
    } catch (error) {
      console.error('Get schedules error:', error);
      res.status(500).json({ error: 'Failed to get schedules' });
    }
  }
);

// Create irrigation schedule
router.post(
  '/schedule',
  validate([
    body('farmId').isUUID().withMessage('Farm ID is required'),
    body('cropId').optional({ nullable: true }).isUUID(),
    body('deviceId').optional({ nullable: true }).isUUID(),
    body('scheduledTime').isISO8601().withMessage('Scheduled time is required'),
    body('durationMinutes')
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes'),
    body('triggeredBy')
      .optional()
      .isIn(['manual', 'schedule'])
      .withMessage('Invalid trigger type')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify farm ownership
      const farm = await Farm.findOne({
        where: {
          id: req.body.farmId,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      const schedule = await irrigationService.createIrrigationSchedule(
        req.body.farmId,
        req.body.cropId || null,
        req.body.deviceId || null,
        new Date(req.body.scheduledTime),
        req.body.durationMinutes,
        req.body.triggeredBy || 'manual'
      );

      res.status(201).json({
        message: 'Irrigation scheduled successfully',
        schedule
      });
    } catch (error) {
      console.error('Create schedule error:', error);
      res.status(500).json({ error: 'Failed to create schedule' });
    }
  }
);

// Trigger immediate irrigation
router.post(
  '/trigger',
  validate([
    body('farmId').isUUID().withMessage('Farm ID is required'),
    body('cropId').optional({ nullable: true }).isUUID(),
    body('deviceId').optional({ nullable: true }).isUUID(),
    body('durationMinutes')
      .isInt({ min: 1, max: 480 })
      .withMessage('Duration must be between 1 and 480 minutes')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify farm ownership
      const farm = await Farm.findOne({
        where: {
          id: req.body.farmId,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      // Create and immediately trigger
      const schedule = await irrigationService.createIrrigationSchedule(
        req.body.farmId,
        req.body.cropId || null,
        req.body.deviceId || null,
        new Date(),
        req.body.durationMinutes,
        'manual'
      );

      const success = await irrigationService.triggerIrrigation(schedule.id);

      if (!success) {
        res.status(500).json({ error: 'Failed to trigger irrigation' });
        return;
      }

      res.json({
        message: 'Irrigation started',
        schedule
      });
    } catch (error) {
      console.error('Trigger irrigation error:', error);
      res.status(500).json({ error: 'Failed to trigger irrigation' });
    }
  }
);

// Trigger immediate stop (Manual Override)
router.post(
  '/stop',
  validate([
    body('farmId').isUUID().withMessage('Farm ID is required')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify farm ownership
      const farm = await Farm.findOne({
        where: {
          id: req.body.farmId,
          farmerId: req.farmer!.id
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
    } catch (error) {
      console.error('Stop irrigation error:', error);
      res.status(500).json({ error: 'Failed to stop irrigation' });
    }
  }
);

// Cancel irrigation schedule
router.post(
  '/schedule/:id/cancel',
  validate([
    param('id').isUUID().withMessage('Invalid schedule ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const schedule = await IrrigationSchedule.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
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
    } catch (error) {
      console.error('Cancel schedule error:', error);
      res.status(500).json({ error: 'Failed to cancel schedule' });
    }
  }
);

// Get irrigation history and analytics
router.get(
  '/history',
  validate([
    query('farmId').optional().isUUID(),
    query('days').optional().isInt({ min: 1, max: 365 }).toInt()
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const days = (req.query.days as unknown as number) || 30;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get farms owned by this farmer
      const farms = await Farm.findAll({
        where: { farmerId: req.farmer!.id },
        attributes: ['id']
      });
      const farmIds = farms.map(f => f.id);

      const whereClause: any = {
        farmId: req.query.farmId 
          ? req.query.farmId 
          : { [Op.in]: farmIds },
        status: 'completed',
        completedAt: { [Op.gte]: startDate }
      };

      const completedIrrigations = await IrrigationSchedule.findAll({
        where: whereClause,
        include: [
          { model: Farm, as: 'farm', attributes: ['name'] },
          { model: Crop, as: 'crop', attributes: ['cropType'] }
        ],
        order: [['completedAt', 'DESC']]
      });

      // Calculate statistics
      const totalSessions = completedIrrigations.length;
      const totalDuration = completedIrrigations.reduce(
        (sum, s) => sum + s.durationMinutes, 0
      );
      const totalVolume = completedIrrigations.reduce(
        (sum, s) => sum + (parseFloat(s.actualVolumeLiters?.toString() || '0')), 0
      );

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
    } catch (error) {
      console.error('Get history error:', error);
      res.status(500).json({ error: 'Failed to get irrigation history' });
    }
  }
);

export default router;
