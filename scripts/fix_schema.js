
const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
    process.env.DB_NAME || 'smart_agri',
    process.env.DB_USER || 'postgres',
    process.env.DB_PASSWORD || 'smartagri123',
    {
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
        dialect: 'postgres',
        logging: false,
        define: {
            underscored: true
        }
    }
);

// Define Models with underscored: true explicitly to match app config

const Farmer = sequelize.define('Farmer', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    phone: { type: DataTypes.STRING(15), allowNull: false, unique: true },
    password: { type: DataTypes.STRING(255), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: true },
    email: { type: DataTypes.STRING(255), allowNull: true },
    address: { type: DataTypes.TEXT, allowNull: true },
    profileImage: { type: DataTypes.STRING(500), allowNull: true },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    lastLoginAt: { type: DataTypes.DATE, allowNull: true }
}, { tableName: 'farmers', timestamps: true, underscored: true });

const Farm = sequelize.define('Farm', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    farmerId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farmers', key: 'id' }
    },
    name: { type: DataTypes.STRING(100), allowNull: false },
    latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: false },
    longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: false },
    boundary: { type: DataTypes.JSONB, allowNull: true },
    areaHectares: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    landType: { type: DataTypes.ENUM('alluvial', 'black', 'red', 'laterite', 'desert', 'mountain', 'forest'), allowNull: true },
    soilPh: { type: DataTypes.DECIMAL(3, 1), allowNull: true },
    district: { type: DataTypes.STRING(100), allowNull: true },
    state: { type: DataTypes.STRING(100), allowNull: true },
    village: { type: DataTypes.STRING(100), allowNull: true },
    pincode: { type: DataTypes.STRING(10), allowNull: true }
}, { tableName: 'farms', timestamps: true, underscored: true });

const IoTDevice = sequelize.define('IoTDevice', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    farmId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: { model: 'farms', key: 'id' }
    },
    deviceType: { type: DataTypes.ENUM('soil_sensor', 'water_pump', 'valve', 'weather_station', 'npk_sensor'), allowNull: false },
    deviceId: { type: DataTypes.STRING(100), allowNull: false },
    name: { type: DataTypes.STRING(100), allowNull: false, defaultValue: 'Unnamed Device' },
    latitude: { type: DataTypes.DECIMAL(10, 8), allowNull: true },
    longitude: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
    status: { type: DataTypes.ENUM('active', 'inactive', 'maintenance', 'offline'), defaultValue: 'active' },
    firmwareVersion: { type: DataTypes.STRING(20), allowNull: true },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
    batteryLevel: { type: DataTypes.INTEGER, allowNull: true },
    metadata: { type: DataTypes.JSONB, allowNull: true }
}, { tableName: 'iot_devices', timestamps: true, underscored: true });

const Crop = sequelize.define('Crop', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    farmId: { type: DataTypes.UUID, allowNull: false, references: { model: 'farms', key: 'id' } },
    cropType: { type: DataTypes.STRING(50), allowNull: false },
    variety: { type: DataTypes.STRING(100), allowNull: true },
    plantedDate: { type: DataTypes.DATEONLY, allowNull: true },
    expectedHarvestDate: { type: DataTypes.DATEONLY, allowNull: true },
    actualHarvestDate: { type: DataTypes.DATEONLY, allowNull: true },
    status: { type: DataTypes.ENUM('active', 'harvested', 'failed', 'planned'), defaultValue: 'active' },
    zoneBoundary: { type: DataTypes.JSONB, allowNull: true },
    areaHectares: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    expectedYieldKg: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    actualYieldKg: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true }
}, { tableName: 'crops', timestamps: true, underscored: true });

const IrrigationSchedule = sequelize.define('IrrigationSchedule', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    farmId: { type: DataTypes.UUID, allowNull: false, references: { model: 'farms', key: 'id' } },
    cropId: { type: DataTypes.UUID, allowNull: true, references: { model: 'crops', key: 'id' } },
    deviceId: { type: DataTypes.UUID, allowNull: true, references: { model: 'iot_devices', key: 'id' } },
    scheduledTime: { type: DataTypes.DATE, allowNull: false },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: false },
    waterVolumeLiters: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    status: { type: DataTypes.ENUM('pending', 'scheduled', 'in_progress', 'completed', 'failed', 'cancelled'), defaultValue: 'pending' },
    triggeredBy: { type: DataTypes.ENUM('manual', 'auto', 'schedule', 'sensor'), allowNull: false },
    executedAt: { type: DataTypes.DATE, allowNull: true },
    completedAt: { type: DataTypes.DATE, allowNull: true },
    actualVolumeLiters: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
    notes: { type: DataTypes.TEXT, allowNull: true },
    weatherCondition: { type: DataTypes.JSONB, allowNull: true }
}, { tableName: 'irrigation_schedules', timestamps: true, underscored: true });

async function fixSchema() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        // 1. Sync Farmer (should be fine, but ensuring)
        await Farmer.sync({ alter: true });
        console.log('✅ Farmers table verified.');

        // 2. Sync Farm (Force to fix columns)
        await Farm.sync({ force: true });
        console.log('✅ Farms table recreated (force sync).');

        // 3. Sync IoTDevice (Force to fix columns)
        await IoTDevice.sync({ force: true });
        console.log('✅ IoTDevices table recreated (force sync).');

        // 4. Sync Crop (Force to fix columns)
        await Crop.sync({ force: true });
        console.log('✅ Crops table recreated (force sync).');

        // 5. Sync IrrigationSchedule (Force to fix columns)
        await IrrigationSchedule.sync({ force: true });
        console.log('✅ IrrigationSchedules table recreated (force sync).');

    } catch (error) {
        console.error('Schema fix failed:', error);
    } finally {
        process.exit();
    }
}

fixSchema();
