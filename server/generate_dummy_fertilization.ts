import { Sequelize } from 'sequelize';
import { Crop, FertilizationRecord } from './src/models';
import * as dotenv from 'dotenv';
dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

const FERTILIZERS = [
  { type: 'Urea (46-0-0)', ratio: '46:0:0', price: 6 },
  { type: 'DAP (18-46-0)', ratio: '18:46:0', price: 27 },
  { type: 'MOP (0-0-60)', ratio: '0:0:60', price: 17 },
  { type: 'NPK Complex (10-26-26)', ratio: '10:26:26', price: 25 },
  { type: 'Organic Compost', ratio: '2:1:1', price: 15 }
];

async function run() {
  try {
    await sequelize.authenticate();
    const crops = await Crop.findAll({ where: { status: 'active' } });
    console.log(`Found ${crops.length} active crops.`);

    if (crops.length === 0) {
       console.log("No crops found. Cannot generate fertilization data.");
       process.exit(0);
    }

    const today = new Date();
    
    for (const crop of crops) {
      console.log(`Generating dummy fertilization data for crop ${crop.id}...`);
      
      // Clear existing records to avoid duplicates clutter
      await FertilizationRecord.destroy({ where: { cropId: crop.id } });
      
      // 1. Generate 3 historical 'applied' records from the past
      for (let i = 1; i <= 3; i++) {
        const fert = FERTILIZERS[Math.floor(Math.random() * FERTILIZERS.length)];
        const qty = Math.floor(20 + Math.random() * 50); // 20 to 70 kg
        const cost = qty * fert.price;
        
        const recDate = new Date(today);
        recDate.setDate(today.getDate() - (i * 15) - Math.floor(Math.random() * 5)); // 15, 30, 45 days ago

        const appliedDate = new Date(recDate);
        appliedDate.setDate(recDate.getDate() + Math.floor(Math.random() * 3)); // Applied 0-3 days later

        await FertilizationRecord.create({
          cropId: crop.id,
          recommendedDate: recDate,
          fertilzerType: fert.type, // matching model typo
          quantityKg: qty,
          npkRatio: fert.ratio,
          status: 'applied',
          appliedAt: appliedDate,
          actualQuantityKg: qty,
          costEstimate: cost,
          actualCost: cost + (Math.random() > 0.5 ? 50 : 0), // Maybe slight cost variance
          applicationMethod: Math.random() > 0.5 ? 'Broadcasting' : 'Foliar Spray',
          notes: 'Routine nutrient boost',
          basedOnSoilAnalysis: Math.random() > 0.5
        });
      }

      // 2. Generate 1 current 'recommended' record indicating action needed now
      const currentFert = FERTILIZERS[Math.floor(Math.random() * Math.min(3, FERTILIZERS.length))];
      const currentQty = Math.floor(30 + Math.random() * 40);
      const currentCost = currentQty * currentFert.price;

      await FertilizationRecord.create({
        cropId: crop.id,
        recommendedDate: new Date(today),
        fertilzerType: currentFert.type,
        quantityKg: currentQty,
        npkRatio: currentFert.ratio,
        status: 'recommended',
        costEstimate: currentCost,
        notes: 'Low nitrogen levels detected in recent analysis. Immediate application suggested.',
        basedOnSoilAnalysis: true,
        soilAnalysisData: { nitrogen: 18, phosphorus: 45, potassium: 50 }
      });
      
      console.log(`Successfully generated fertilization data for crop ${crop.id}.`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

run();
