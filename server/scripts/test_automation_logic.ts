
import { processSensorData } from '../src/services/automation.service';
import { sequelize } from '../src/config/database';
import Farm from '../src/models/Farm.model';
import Farmer from '../src/models/Farmer.model';
import Crop from '../src/models/Crop.model';
import IoTDevice from '../src/models/IoTDevice.model';
import IrrigationSchedule from '../src/models/IrrigationSchedule.model';
import FertilizationRecord from '../src/models/FertilizationRecord.model';
import { v4 as uuidv4 } from 'uuid';

const testAutomation = async () => {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        // 1. Setup Test Data
        const farmerId = uuidv4();
        const farmId = uuidv4();
        const cropId = uuidv4();
        const deviceId = uuidv4();
        const realDeviceId = 'TEST_DEVICE_001';

        await Farmer.create({
            id: farmerId,
            phone: '1234567890',
            password: 'hashed_password',
            name: 'Test Farmer'
        });

        await Farm.create({
            id: farmId,
            farmerId: farmerId,
            name: 'Test Farm',
            latitude: 20.5,
            longitude: 78.9,
            areaHectares: 10
        });

        await Crop.create({
            id: cropId,
            farmId,
            cropType: 'Wheat',
            status: 'active',
            plantedDate: new Date(),
        });

        await IoTDevice.create({
            id: deviceId,
            farmId,
            deviceType: 'soil_sensor',
            deviceId: realDeviceId,
            name: 'Test Sensor',
            status: 'active'
        });

        console.log('Test data created.');

        // 2. Test Irrigation Logic (Moisture < 30)
        console.log('Testing Irrigation Logic...');
        await processSensorData(farmId, realDeviceId, { moisture: 25 });

        const irrigation = await IrrigationSchedule.findOne({
            where: { farmId, cropId, status: 'pending' }
        });

        if (irrigation && irrigation.triggeredBy === 'sensor') {
            console.log('✅ Irrigation scheduled successfully.');
        } else {
            console.error('❌ Failed to schedule irrigation.');
        }

        // 3. Test Fertilization Logic (Nitrogen < 20)
        console.log('Testing Fertilization Logic...');
        await processSensorData(farmId, realDeviceId, { nitrogen: 15 });

        const fertilization = await FertilizationRecord.findOne({
            where: { cropId, status: 'recommended' }
        });

        if (fertilization && fertilization.notes?.includes('Auto-recommended')) {
            console.log('✅ Fertilization recommended successfully.');
        } else {
            console.error('❌ Failed to recommend fertilization.');
        }

        // 4. Cleanup
        await IrrigationSchedule.destroy({ where: { farmId } });
        await FertilizationRecord.destroy({ where: { cropId } });
        await IoTDevice.destroy({ where: { id: deviceId } });
        await Crop.destroy({ where: { id: cropId } });
        await Farm.destroy({ where: { id: farmId } });
        await Farmer.destroy({ where: { id: farmerId } });
        console.log('Cleanup done.');

    } catch (error) {
        console.error('Test failed:', error);
        // Clean up even on error if possible - though IDs might not exist
    } finally {
        await sequelize.close();
    }
};

testAutomation();
