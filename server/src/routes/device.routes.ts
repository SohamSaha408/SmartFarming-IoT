import { Router, Response } from 'express';
import { publishCommand } from '../mqtt/mqttHandler';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Farm, IoTDevice, SensorReading } from '../models';
import { Op } from 'sequelize';
import * as iotService from '../services/iot/iot.service';
import * as agronomyService from '../services/agronomy.service';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as otaService from '../services/ota.service';

// ── Multer config: store .bin uploads in a temp folder, max 4 MB ─────────────
const otaUpload = multer({
  dest: path.join(__dirname, '../../../../ota_firmware/tmp'),
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.originalname.endsWith('.bin')) return cb(null, true);
    cb(new Error('Only .bin firmware files are accepted'));
  },
});

const router = Router();

router.use(authenticate);

// Get all devices for farmer's farms
// FIXED: now accepts optional ?farmId= query param to return only devices for
// a specific farm. Previously the frontend called getAll() and filtered client-side,
// which fetched every device across every farm unnecessarily.
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const farms = await Farm.findAll({
      where: { farmerId: req.farmer!.id },
      attributes: ['id']
    });
    const farmIds = farms.map(f => f.id);

    // If caller supplies ?farmId=, restrict to that single farm (after ownership check)
    const requestedFarmId = req.query.farmId as string | undefined;
    const whereClause: any = requestedFarmId && farmIds.includes(requestedFarmId)
      ? { farmId: requestedFarmId }
      : { farmId: { [Op.in]: farmIds } };

    const devices = await IoTDevice.findAll({
      where: whereClause,
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
      .isLength({ min: 2, max: 100 }),
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

      // Add agronomy stats dynamically based on the latest reading
      let agronomy = null;
      if (latestReadings && latestReadings.length > 0) {
        const latest = latestReadings[0];
        const temp = latest.airTemperature || latest.soilTemperature;
        const hum = latest.airHumidity;
        const light = latest.lightIntensity;
        
        if (temp != null && hum != null) {
          const vpdInfo = agronomyService.calculateVPD(temp, hum);
          const etInfo = agronomyService.calculateET(temp, hum, light || 0);
          agronomy = {
            vpd: vpdInfo.value,
            vpdStatus: vpdInfo.status,
            et: etInfo
          };
        }
      }

      res.json({
        device,
        latestReadings,
        stats,
        agronomy
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

// ═══════════════════════════════════════════════════════════════════════════
// OTA FIRMWARE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /api/devices/:id/ota
 * Upload a new .bin firmware for this device's type.
 * Body (multipart/form-data):
 *   file        – the .bin firmware file
 *   version     – semver string e.g. "1.2.3"
 *   deviceType  – optional override; defaults to the device's own type
 *   releaseNotes – optional text
 */
router.post(
  '/:id/ota',
  otaUpload.single('file'),
  validate([param('id').isUUID()]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Verify ownership
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [{ model: Farm, as: 'farm', where: { farmerId: req.farmer!.id } }],
      });
      if (!device) { res.status(404).json({ error: 'Device not found' }); return; }

      if (!req.file) { res.status(400).json({ error: 'No .bin file uploaded' }); return; }

      const { version, deviceType, releaseNotes } = req.body;
      if (!version) { res.status(400).json({ error: 'version is required' }); return; }

      // Ensure tmp dir exists (multer dest)
      const tmpDir = path.join(__dirname, '../../../../ota_firmware/tmp');
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

      const firmware = await otaService.saveFirmware({
        deviceType:   deviceType || device.deviceType,
        version,
        tmpPath:      req.file.path,
        originalName: req.file.originalname,
        releaseNotes,
        uploadedBy:   req.farmer!.id,
      });

      res.status(201).json({
        message: 'Firmware uploaded successfully',
        firmware: {
          id:            firmware.id,
          deviceType:    firmware.deviceType,
          version:       firmware.version,
          fileSizeBytes: firmware.fileSizeBytes,
          checksum:      firmware.checksum,
          releaseNotes:  firmware.releaseNotes,
          createdAt:     firmware.createdAt,
        },
      });
    } catch (err: any) {
      console.error('OTA upload error:', err);
      res.status(500).json({ error: err.message || 'OTA upload failed' });
    }
  }
);

/**
 * GET /api/devices/:id/ota/check?version=1.0.0
 * Called by the ESP32 on every boot to see if a newer firmware is available.
 * No auth required — device uses its DB UUID as path param.
 */
router.get('/:id/ota/check', async (req: AuthRequest, res: Response) => {
  try {
    const currentVersion = (req.query.version as string) || '0.0.0';
    const result = await otaService.checkForUpdate(req.params.id, currentVersion);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTA check failed' });
  }
});

/**
 * GET /api/devices/:id/ota/download
 * Streams the active .bin firmware binary to the ESP32 via HTTPUpdate.
 * No auth required — device uses its DB UUID.
 */
router.get('/:id/ota/download', async (req: AuthRequest, res: Response) => {
  try {
    const firmware = await otaService.getActiveFirmware(req.params.id);
    if (!firmware || !fs.existsSync(firmware.filePath)) {
      res.status(404).json({ error: 'No firmware available' });
      return;
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${firmware.fileName}"`);
    res.setHeader('Content-Length', firmware.fileSizeBytes);
    res.setHeader('x-MD5', firmware.checksum); // HTTPUpdate reads this header

    fs.createReadStream(firmware.filePath).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'OTA download failed' });
  }
});

/**
 * POST /api/devices/:id/ota/confirm
 * ESP32 calls this after a successful flash to record the new version.
 * Body: { version: "1.2.3" }
 */
router.post('/:id/ota/confirm', async (req: AuthRequest, res: Response) => {
  try {
    const { version } = req.body;
    if (!version) { res.status(400).json({ error: 'version required' }); return; }
    await otaService.confirmInstall(req.params.id, version);
    res.json({ message: 'Firmware version recorded', version });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Confirm failed' });
  }
});

/**
 * GET /api/devices/:id/ota/history
 * Dashboard: list all firmware records for this device's type.
 */
router.get(
  '/:id/ota/history',
  validate([param('id').isUUID()]),
  async (req: AuthRequest, res: Response) => {
    try {
      const device = await IoTDevice.findByPk(req.params.id, {
        include: [{ model: Farm, as: 'farm', where: { farmerId: req.farmer!.id } }],
      });
      if (!device) { res.status(404).json({ error: 'Device not found' }); return; }
      const list = await otaService.listFirmware(device.deviceType);
      res.json({ firmware: list });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'History fetch failed' });
    }
  }
);

export default router;
