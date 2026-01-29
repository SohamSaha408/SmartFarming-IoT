import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Farm, Crop, IoTDevice, IrrigationSchedule } from '../models';
import { reverseGeocode } from '../services/satellite/geocoding.service';
import { getCurrentWeather, getWeatherForecast, getSatelliteImagery } from '../services/satellite/satellite.service';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Get all farms for the authenticated farmer
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const farms = await Farm.findAll({
      where: { farmerId: req.farmer!.id },
      include: [
        { model: Crop, as: 'crops', attributes: ['id', 'cropType', 'status'] },
        { model: IoTDevice, as: 'devices', attributes: ['id', 'deviceType', 'status'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ farms });
  } catch (error) {
    console.error('Get farms error:', error);
    res.status(500).json({ error: 'Failed to fetch farms' });
  }
});

// Create a new farm
router.post(
  '/',
  validate([
    body('name')
      .notEmpty()
      .withMessage('Farm name is required')
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('latitude')
      .notEmpty()
      .withMessage('Latitude is required')
      .isFloat({ min: -90, max: 90 })
      .withMessage('Invalid latitude'),
    body('longitude')
      .notEmpty()
      .withMessage('Longitude is required')
      .isFloat({ min: -180, max: 180 })
      .withMessage('Invalid longitude'),
    body('boundary')
      .optional()
      .isObject()
      .withMessage('Boundary must be a valid GeoJSON object'),
    body('areaHectares')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Area must be a positive number'),
    body('landType')
      .optional()
      .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
      .withMessage('Invalid land type'),
    body('soilPh')
      .optional()
      .isFloat({ min: 0, max: 14 })
      .withMessage('Soil pH must be between 0 and 14')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        latitude,
        longitude,
        boundary,
        areaHectares,
        landType,
        soilPh
      } = req.body;

      // Get location details from coordinates
      const locationDetails = await reverseGeocode(latitude, longitude);

      const farm = await Farm.create({
        farmerId: req.farmer!.id,
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
    } catch (error) {
      console.error('Create farm error:', error);
      res.status(500).json({ error: 'Failed to create farm' });
    }
  }
);

// Get a specific farm
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid farm ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.id,
          farmerId: req.farmer!.id
        },
        include: [
          {
            model: Crop,
            as: 'crops',
            where: { status: 'active' },
            required: false
          },
          {
            model: IoTDevice,
            as: 'devices',
            where: { status: 'active' },
            required: false
          },
          {
            model: IrrigationSchedule,
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
    } catch (error) {
      console.error('Get farm error:', error);
      res.status(500).json({ error: 'Failed to fetch farm' });
    }
  }
);

// Update a farm
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid farm ID'),
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('boundary')
      .optional()
      .isObject()
      .withMessage('Boundary must be a valid GeoJSON object'),
    body('areaHectares')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Area must be a positive number'),
    body('landType')
      .optional()
      .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
      .withMessage('Invalid land type'),
    body('soilPh')
      .optional()
      .isFloat({ min: 0, max: 14 })
      .withMessage('Soil pH must be between 0 and 14')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.id,
          farmerId: req.farmer!.id
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
    } catch (error) {
      console.error('Update farm error:', error);
      res.status(500).json({ error: 'Failed to update farm' });
    }
  }
);

// Delete a farm
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid farm ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.id,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      await farm.destroy();

      res.json({ message: 'Farm deleted successfully' });
    } catch (error) {
      console.error('Delete farm error:', error);
      res.status(500).json({ error: 'Failed to delete farm' });
    }
  }
);

// Get weather for a farm
router.get(
  '/:id/weather',
  validate([
    param('id').isUUID().withMessage('Invalid farm ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.id,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      const lat = parseFloat(farm.latitude.toString());
      const lon = parseFloat(farm.longitude.toString());

      const [current, forecast] = await Promise.all([
        getCurrentWeather(lat, lon),
        getWeatherForecast(lat, lon)
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
    } catch (error) {
      console.error('Get weather error:', error);
      res.status(500).json({ error: 'Failed to fetch weather data' });
    }
  }
);

// Get satellite data for a farm
router.get(
  '/:id/satellite',
  validate([
    param('id').isUUID().withMessage('Invalid farm ID'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.id,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to last 30 days
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      // Use the farm's polygon ID if available, otherwise use a generated ID based on farm ID
      const polygonId = farm.boundary ? `poly-${farm.id}` : `mock-poly-${farm.id}`;

      // Fetch satellite imagery
      const imagery = await getSatelliteImagery(
        polygonId,
        startDate,
        endDate
      );

      res.json({
        farmId: farm.id,
        imagery
      });
    } catch (error) {
      console.error('Get satellite data error:', error);
      res.status(500).json({ error: 'Failed to fetch satellite data' });
    }
  }
);

export default router;
