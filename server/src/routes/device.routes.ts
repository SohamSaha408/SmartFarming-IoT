import { Router, Response } from 'express';
import { publishCommand } from '../mqtt/mqttHandler';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Farm, IoTDevice, SensorReading } from '../models';
import { Op } from 'sequelize';
import * as iotService from '../services/iot/iot.service';

const router = Router();

router.use(authenticate);

// Get all devices for farmer's farms
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const farms = await Farm.findAll({
      where: { farmerId: req.farmer!.id },
      attributes: ['id']
    });
    const farmIds = farms.map(f => f.id);

    const devices = await IoTDevice.findAll({
      where: { farmId: { [Op.in]: farmIds } },
      include: [
        { model: Farm, as: 'farm', attributes: ['name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ devices });
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Register new device
router.post(
  '/register',
  validate([
    body('farmId').isUUID().withMessage('Farm ID is required'),
    body('deviceId')
      .notEmpty()
      .withMessage('Device ID is required')
      .isLength({ min: 8, max: 100 }),
    body('deviceType')
      .isIn(['soil_sensor', 'water_pump', 'valve', 'weather_station', 'npk_sensor'])
      .withMessage('Invalid device type'),
    body('name').optional().isLength({ max: 100 }),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 })
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

      const device = await iotService.registerDevice(
        req.body.farmId,
        req.body.deviceId,
        req.body.deviceType,
        req.body.name,
        req.body.latitude,
        req.body.longitude
      );

      if (!device) {
        res.status(400).json({ error: 'Device already registered' });
        return;
      }

      res.status(201).json({
        message: 'Device registered successfully',
        device
      });
    } catch (error) {
      console.error('Register device error:', error);
      res.status(500).json({ error: 'Failed to register device' });
    }
  }
);

// Get device details
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid device ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      // Get latest readings
      const latestReadings = await iotService.getLatestReadings(device.id, 5);

      // Get stats
      const stats = await iotService.getDeviceStats(device.id, 24);

      res.json({
        device,
        latestReadings,
        stats
      });
    } catch (error) {
      console.error('Get device error:', error);
      res.status(500).json({ error: 'Failed to fetch device' });
    }
  }
);

// Get device readings
router.get(
  '/:id/readings',
  validate([
    param('id').isUUID().withMessage('Invalid device ID'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).toInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      const whereClause: any = { deviceId: device.id };

      if (req.query.startDate || req.query.endDate) {
        whereClause.recordedAt = {};
        if (req.query.startDate) {
          whereClause.recordedAt[Op.gte] = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          whereClause.recordedAt[Op.lte] = new Date(req.query.endDate as string);
        }
      }

      const limit = (req.query.limit as unknown as number) || 100;

      const readings = await SensorReading.findAll({
        where: whereClause,
        order: [['recordedAt', 'DESC']],
        limit
      });

      res.json({ readings });
    } catch (error) {
      console.error('Get readings error:', error);
      res.status(500).json({ error: 'Failed to fetch readings' });
    }
  }
);

// Update device
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid device ID'),
    body('name').optional().isLength({ max: 100 }),
    body('status')
      .optional()
      .isIn(['active', 'inactive', 'maintenance']),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 })
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      await device.update(req.body);

      res.json({
        message: 'Device updated successfully',
        device
      });
    } catch (error) {
      console.error('Update device error:', error);
      res.status(500).json({ error: 'Failed to update device' });
    }
  }
);

// Delete device
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid device ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      await device.destroy();

      res.json({ message: 'Device deleted successfully' });
    } catch (error) {
      console.error('Delete device error:', error);
      res.status(500).json({ error: 'Failed to delete device' });
    }
  }
);

// Send command to device
router.post(
  '/:id/command',
  validate([
    param('id').isUUID().withMessage('Invalid device ID'),
    body('action')
      .notEmpty()
      .withMessage('Action is required')
      .isIn(['start', 'stop', 'restart', 'calibrate']),
    body('params').optional().isObject()
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!device) {
        res.status(404).json({ error: 'Device not found' });
        return;
      }

      // Use standardized MQTT handler
      publishCommand(device.farmId, device.deviceId, req.body.action, {
        params: req.body.params || {},
        timestamp: Date.now()
      });
      // Assuming success as publishCommand is void/async fire-and-forget in current implementation
      const success = true;

      if (!success) {
        res.status(500).json({ error: 'Failed to send command' });
        return;
      }

      res.json({ message: 'Command sent successfully' });
    } catch (error) {
      console.error('Send command error:', error);
      res.status(500).json({ error: 'Failed to send command' });
    }
  }
);

export default router;
