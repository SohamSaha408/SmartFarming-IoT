import { Sequelize } from 'sequelize';
import { Farm, Crop, IrrigationSchedule } from './src/models';
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

async function run() {
  try {
    await sequelize.authenticate();
    const farms = await Farm.findAll();
    console.log(`Found ${farms.length} farms.`);

    if (farms.length === 0) {
       console.log("No farms found. Cannot generate irrigation data.");
       process.exit(0);
    }
    
    // Clear existing schedules to avoid duplicates
    await IrrigationSchedule.destroy({ where: {} });

    const today = new Date();
    
    for (const farm of farms) {
      const activeCrops = await Crop.findAll({ where: { farmId: farm.id, status: 'active' } });
      console.log(`Generating dummy irrigation data for farm ${farm.id} with ${activeCrops.length} active crops...`);
      
      for (const crop of activeCrops) {
        
        // 1. Generate an AI Recommendation (Pending)
        // High Urgency
        await IrrigationSchedule.create({
          farmId: farm.id,
          cropId: crop.id,
          deviceId: null, // AI recommended, not yet sent to device
          scheduledTime: new Date(today.getTime() + 1000 * 60 * 30), // In 30 mins
          durationMinutes: 45,
          status: 'pending',
          triggeredBy: 'sensor', // Simulating sensor AI auto-trigger
          notes: 'AI Recommendation: Soil moisture dropping rapidly. High heat index today.',
          weatherCondition: { temp: 32, humidity: 40, condition: 'Sunny' }
        });

        // 2. Generate a Scheduled Irrigation (Upcoming)
        const scheduledTime = new Date(today);
        scheduledTime.setDate(today.getDate() + 1);
        scheduledTime.setHours(6, 0, 0, 0); // Tomorrow at 6:00 AM

        await IrrigationSchedule.create({
          farmId: farm.id,
          cropId: crop.id,
          deviceId: null,
          scheduledTime: scheduledTime,
          durationMinutes: 30,
          status: 'scheduled',
          triggeredBy: 'schedule', // Scheduled by user
          notes: 'Routine morning watering',
          weatherCondition: { temp: 22, humidity: 60, condition: 'Clear' }
        });

        // 3. Generate some historical (Completed) records
        for (let i = 1; i <= 3; i++) {
          const recDate = new Date(today);
          recDate.setDate(today.getDate() - i*2); // Every 2 days
          
          await IrrigationSchedule.create({
            farmId: farm.id,
            cropId: crop.id,
            deviceId: null,
            scheduledTime: recDate,
            durationMinutes: 30,
            status: 'completed',
            triggeredBy: 'schedule',
            executedAt: recDate,
            completedAt: new Date(recDate.getTime() + 1000 * 60 * 30),
            actualVolumeLiters: 1500,
            notes: 'Completed successfully',
            weatherCondition: { temp: 25, humidity: 50, condition: 'Partly Cloudy' }
          });
        }
      }
      
      console.log(`Successfully generated irrigation data for farm ${farm.id}.`);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

run();
