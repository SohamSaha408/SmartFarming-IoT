const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config({ path: 'd:/smart-agri-iot/server/.env' });

const dbUrl = process.env.DATABASE_URL;
let sequelize;

if (dbUrl) {
    sequelize = new Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false
            }
        }
    });
} else {
    // Fallback if needed, but we expect DATABASE_URL
    console.error('DATABASE_URL not found in env');
    process.exit(1);
}

async function seed() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        // 1. Get a Farm
        const [farms] = await sequelize.query('SELECT id FROM farms LIMIT 1');
        if (farms.length === 0) {
            console.error('No farms found! Cannot create device.');
            process.exit(1);
        }
        const farmId = farms[0].id;
        console.log(`Using Farm ID: ${farmId}`);

        // 2. Check if device exists
        const [existing] = await sequelize.query(`SELECT id FROM iot_devices WHERE device_id = 'node_a1'`);
        if (existing.length > 0) {
            console.log('Device node_a1 already exists.');
            return;
        }

        // 3. Create Device
        // Using UUIDv4 for ID (random generation not available in plain SQL easily unless extension enabled, 
        // so we'll let DB handle it if default gen is set, or generate one in JS)

        // Simple UUID generator
        const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });

        const newId = uuid();
        const now = new Date().toISOString();

        await sequelize.query(`
            INSERT INTO iot_devices (
                id, farm_id, device_type, device_id, name, status, created_at, updated_at
            ) VALUES (
                '${newId}', '${farmId}', 'soil_sensor', 'node_a1', 'ESP32 Soil Node', 'active', '${now}', '${now}'
            )
        `);

        console.log(`✅ Created device 'node_a1' linked to farm ${farmId}`);

    } catch (error) {
        console.error('Seed failed:', error);
    } finally {
        await sequelize.close();
    }
}

seed();
