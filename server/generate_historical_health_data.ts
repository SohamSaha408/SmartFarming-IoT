import { Sequelize } from 'sequelize';
import { Crop, CropHealth } from './src/models';
import * as dotenv from 'dotenv';
import { generateRecommendations } from './src/services/satellite/satellite.service';
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

async function run() {
  try {
    await sequelize.authenticate();
    const crops = await Crop.findAll({ where: { status: 'active' } });
    console.log(`Found ${crops.length} active crops.`);

    if (crops.length === 0) {
       console.log("No crops found. Cannot generate health data.");
       process.exit(0);
    }

    const today = new Date();
    
    for (const crop of crops) {
      console.log(`Generating 30 days of dummy health data for crop ${crop.id}...`);
      
      // Clear existing records for this crop so we have a clean chart
      await CropHealth.destroy({ where: { cropId: crop.id } });
      
      let currentNdvi = 0.5 + Math.random() * 0.2; // Start around 0.5-0.7

      for (let i = 30; i >= 0; i--) {
        const recordDate = new Date(today);
        recordDate.setDate(today.getDate() - i);
        
        // Random walk for NDVI
        currentNdvi += (Math.random() - 0.5) * 0.05;
        if (currentNdvi > 0.95) currentNdvi = 0.95;
        if (currentNdvi < 0.2) currentNdvi = 0.2;
        
        const healthScore = Math.round(currentNdvi * 100);
        let healthStatus: 'excellent' | 'healthy' | 'moderate' | 'stressed' | 'critical' = 'healthy';
        
        if (healthScore > 85) healthStatus = 'excellent';
        else if (healthScore > 70) healthStatus = 'healthy';
        else if (healthScore > 50) healthStatus = 'moderate';
        else if (healthScore > 30) healthStatus = 'stressed';
        else healthStatus = 'critical';

        const moistureLevel = 40 + Math.random() * 40; // 40-80%
        const temperature = 20 + Math.random() * 10; // 20-30 C

        const recommendations = generateRecommendations(healthScore, currentNdvi, moistureLevel, temperature);

        await CropHealth.create({
          cropId: crop.id,
          recordedAt: recordDate,
          ndviValue: currentNdvi,
          healthScore: healthScore,
          healthStatus: healthStatus,
          moistureLevel: moistureLevel,
          temperature: temperature,
          dataSource: 'dummy-script',
          recommendations: recommendations
        });
      }
      
      console.log(`Successfully generated 30 days of data for crop ${crop.id}.`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

run();
