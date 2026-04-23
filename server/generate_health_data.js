const { Sequelize } = require('sequelize');
const { updateCropHealth } = require('./src/services/satellite/satellite.service');
const { Crop, Farm, CropHealth } = require('./src/models');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
});

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Connected to DB');

    // Get all active crops
    const crops = await Crop.findAll({ where: { status: 'active' } });
    console.log(`Found ${crops.length} active crops.`);

    if (crops.length === 0) {
       console.log("No crops found. Cannot generate health data.");
       return;
    }

    for (const crop of crops) {
      console.log(`Generating health data for crop ${crop.id}...`);
      
      // Update crop health which calls getNDVIData based on farm coords
      // We pass a dummy polygon ID since getNDVIData mocks satellite data anyway.
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

run();
