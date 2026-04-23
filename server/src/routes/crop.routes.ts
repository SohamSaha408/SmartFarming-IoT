import { Router, Response } from 'express';
import { body, param, query } from 'express-validator';
import { validate } from '../middleware/validation.middleware';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { Farm, Crop, CropHealth } from '../models';
import { Op } from 'sequelize';
import { updateCropHealth, calculateHealthScore, getHealthStatus, generateRecommendations } from '../services/satellite/satellite.service';
import * as agronomyService from '../services/agronomy.service';

const router = Router();

router.use(authenticate);

// Get crop rankings (healthiest and weakest)
router.get(
  '/rankings/all',
  validate([
    query('landType')
      .optional()
      .isIn(['alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'])
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      // Get all farms owned by this farmer
      const farmWhere: any = { farmerId: req.farmer!.id };
      if (req.query.landType) {
        farmWhere.landType = req.query.landType;
      }

      const farms = await Farm.findAll({
        where: farmWhere,
        attributes: ['id']
      });

      const farmIds = farms.map(f => f.id);

      // Get all active crops with their latest health records
      const crops = await Crop.findAll({
        where: {
          farmId: { [Op.in]: farmIds },
          status: 'active'
        },
        include: [
          {
            model: Farm,
            as: 'farm',
            attributes: ['name', 'landType']
          },
          {
            model: CropHealth,
            as: 'healthRecords',
            limit: 1,
            order: [['recordedAt', 'DESC']]
          }
        ]
      });

      // Calculate health scores and sort
      const cropsWithHealth = crops.map(crop => {
        const latestHealth = (crop as any).healthRecords?.[0];
        return {
          id: crop.id,
          cropType: crop.cropType,
          variety: crop.variety,
          farmName: (crop as any).farm?.name,
          landType: (crop as any).farm?.landType,
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
    } catch (error) {
      console.error('Get rankings error:', error);
      res.status(500).json({ error: 'Failed to fetch crop rankings' });
    }
  }
);

// Get all crops for a farm
router.get(
  '/farm/:farmId',
  validate([
    param('farmId').isUUID().withMessage('Invalid farm ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.farmId,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      const crops = await Crop.findAll({
        where: { farmId: req.params.farmId },
        include: [
          {
            model: CropHealth,
            as: 'healthRecords',
            limit: 30,
            order: [['recordedAt', 'DESC']]
          }
        ],
        order: [['createdAt', 'DESC']]
      });

      const cropsWithAgronomy = crops.map(crop => {
        let cumulativeGDD = 0;
        let diseaseRisk = null;
        let yieldPotential = null;
        let nitrogenReq = null;
        const hr = (crop as any).healthRecords || [];
        
        if (hr.length > 0) {
            for (const record of hr) {
                if (record.temperature != null) {
                    cumulativeGDD += agronomyService.calculateGDD(record.temperature);
                }
            }
            const latest = hr[0];
            if (latest.temperature != null && latest.humidity != null) {
                diseaseRisk = agronomyService.calculateDiseaseRisk(latest.temperature, latest.humidity);
            }
            if (latest.ndviValue != null) {
                const ndvi = typeof latest.ndviValue === 'number' ? latest.ndviValue : parseFloat(latest.ndviValue as any);
                yieldPotential = agronomyService.calculateYieldPotential(ndvi);
                nitrogenReq = agronomyService.calculateNitrogenRequirement(ndvi);
            }
        }
        
        return {
            ...crop.toJSON(),
            agronomy: { cumulativeGDD, diseaseRisk, yieldPotential, nitrogenReq }
        };
      });

      res.json({ crops: cropsWithAgronomy });
    } catch (error) {
      console.error('Get crops error:', error);
      res.status(500).json({ error: 'Failed to fetch crops' });
    }
  }
);

// Create a new crop
router.post(
  '/farm/:farmId',
  validate([
    param('farmId').isUUID().withMessage('Invalid farm ID'),
    body('cropType')
      .notEmpty()
      .withMessage('Crop type is required')
      .isLength({ max: 50 })
      .withMessage('Crop type must be 50 characters or less'),
    body('variety')
      .optional()
      .isLength({ max: 100 }),
    body('plantedDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid planted date'),
    body('expectedHarvestDate')
      .optional()
      .isISO8601()
      .withMessage('Invalid harvest date'),
    body('zoneBoundary')
      .optional()
      .isObject(),
    body('areaHectares')
      .optional()
      .isFloat({ min: 0 })
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const farm = await Farm.findOne({
        where: {
          id: req.params.farmId,
          farmerId: req.farmer!.id
        }
      });

      if (!farm) {
        res.status(404).json({ error: 'Farm not found' });
        return;
      }

      const crop = await Crop.create({
        farmId: req.params.farmId,
        cropType: req.body.cropType,
        variety: req.body.variety,
        plantedDate: req.body.plantedDate,
        expectedHarvestDate: req.body.expectedHarvestDate,
        zoneBoundary: req.body.zoneBoundary,
        areaHectares: req.body.areaHectares,
        status: 'active'
      });

      // --- AUTO-GENERATE 30 DAYS OF NDVI HISTORY ---
      const today = new Date();
      let currentNdvi = 0.5 + Math.random() * 0.2; // Start around 0.5-0.7
      const bulkRecords = [];

      for (let i = 29; i >= 0; i--) {
        const recordDate = new Date(today);
        recordDate.setDate(today.getDate() - i);
        
        currentNdvi += (Math.random() - 0.5) * 0.05;
        if (currentNdvi > 0.95) currentNdvi = 0.95;
        if (currentNdvi < 0.2) currentNdvi = 0.2;
        
        const healthScore = Math.round(currentNdvi * 100);
        const healthStatus = getHealthStatus(healthScore);
        const moistureLevel = 40 + Math.random() * 40;
        const temperature = 20 + Math.random() * 10;

        bulkRecords.push({
          cropId: crop.id,
          recordedAt: recordDate,
          ndviValue: currentNdvi,
          healthScore,
          healthStatus,
          moistureLevel,
          temperature,
          dataSource: 'auto-generated',
          recommendations: generateRecommendations(healthScore, currentNdvi, moistureLevel, temperature)
        });
      }
      
      await CropHealth.bulkCreate(bulkRecords);
      // ---------------------------------------------

      res.status(201).json({
        message: 'Crop added successfully',
        crop
      });
    } catch (error) {
      console.error('Create crop error:', error);
      res.status(500).json({ error: 'Failed to add crop' });
    }
  }
);

// Get crop details
router.get(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid crop ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const crop = await Crop.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          },
          {
            model: CropHealth,
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
    } catch (error) {
      console.error('Get crop error:', error);
      res.status(500).json({ error: 'Failed to fetch crop' });
    }
  }
);

// Update crop
router.put(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid crop ID'),
    body('cropType').optional().isLength({ max: 50 }),
    body('variety').optional().isLength({ max: 100 }),
    body('status')
      .optional()
      .isIn(['active', 'harvested', 'failed', 'planned']),
    body('actualHarvestDate').optional().isISO8601(),
    body('actualYieldKg').optional().isFloat({ min: 0 })
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const crop = await Crop.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
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
    } catch (error) {
      console.error('Update crop error:', error);
      res.status(500).json({ error: 'Failed to update crop' });
    }
  }
);

// Delete crop
router.delete(
  '/:id',
  validate([
    param('id').isUUID().withMessage('Invalid crop ID')
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const crop = await Crop.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!crop) {
        res.status(404).json({ error: 'Crop not found' });
        return;
      }

      await crop.destroy();

      res.json({ message: 'Crop deleted successfully' });
    } catch (error) {
      console.error('Delete crop error:', error);
      res.status(500).json({ error: 'Failed to delete crop' });
    }
  }
);

// Get crop health history
router.get(
  '/:id/health',
  validate([
    param('id').isUUID().withMessage('Invalid crop ID'),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ]),
  async (req: AuthRequest, res: Response) => {
    try {
      const crop = await Crop.findByPk(req.params.id, {
        include: [
          {
            model: Farm,
            as: 'farm',
            where: { farmerId: req.farmer!.id }
          }
        ]
      });

      if (!crop) {
        res.status(404).json({ error: 'Crop not found' });
        return;
      }

      const limit = (req.query.limit as unknown as number) || 30;
      const whereClause: any = { cropId: crop.id };

      if (req.query.startDate || req.query.endDate) {
        whereClause.recordedAt = {};
        if (req.query.startDate) {
          whereClause.recordedAt[Op.gte] = new Date(req.query.startDate as string);
        }
        if (req.query.endDate) {
          whereClause.recordedAt[Op.lte] = new Date(req.query.endDate as string);
        }
      }

      const healthRecords = await CropHealth.findAll({
        where: whereClause,
        order: [['recordedAt', 'DESC']],
        limit
      });

      let cumulativeGDD = 0;
      let diseaseRisk = null;
      let yieldPotential = null;
      let nitrogenReq = null;

      if (healthRecords && healthRecords.length > 0) {
        // Calculate cumulative GDD over this returned period
        for (const record of healthRecords) {
          if (record.temperature != null) {
            cumulativeGDD += agronomyService.calculateGDD(record.temperature);
          }
        }
        
        // Calculate current disease risk using the latest record
        const latest = healthRecords[0];
        if (latest.temperature != null && latest.humidity != null) {
          diseaseRisk = agronomyService.calculateDiseaseRisk(latest.temperature, latest.humidity);
        }
        
        // Calculate NDVI-driven insights
        if (latest.ndviValue != null) {
          const ndvi = typeof latest.ndviValue === 'number' ? latest.ndviValue : parseFloat(latest.ndviValue as any);
          yieldPotential = agronomyService.calculateYieldPotential(ndvi);
          nitrogenReq = agronomyService.calculateNitrogenRequirement(ndvi);
        }
      }

      res.json({ 
        healthRecords,
        agronomy: {
          cumulativeGDD,
          diseaseRisk,
          yieldPotential,
          nitrogenReq
        }
      });
    } catch (error) {
      console.error('Get health history error:', error);
      res.status(500).json({ error: 'Failed to fetch health history' });
    }
  }
);

export default router;
