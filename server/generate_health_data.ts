import { Sequelize } from 'sequelize';
import { updateCropHealth } from './src/services/satellite/satellite.service';
import { Crop, Farm, CropHealth } from './src/models';
import * as dotenv from 'dotenv';
dotenv.config();

// We just need to trigger the logic that populates CropHealth
async function run() {
  try {
    const crops = await Crop.findAll({ where: { status: 'active' } });
    console.log(`Found ${crops.length} active crops.`);

    if (crops.length === 0) {
       console.log("No crops found. Cannot generate health data.");
       return;
    }

    for (const crop of crops) {
      console.log(`Generating health data for crop ${crop.id}...`);
      
      // Update crop health which calls getNDVIData based on farm coords
      const healthRecord = await updateCropHealth(crop, `poly-${crop.id}`);
      
      if (healthRecord) {
        console.log(`Successfully created health record for crop ${crop.id} with NDVI ${healthRecord.ndviValue}`);
      } else {
        console.log(`Failed to create health record for crop ${crop.id}`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

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

sequelize.authenticate().then(run).catch(console.error);
