const { Sequelize } = require('sequelize');
require('dotenv').config({ path: 'd:/smart-agri-iot/server/.env' });

const dbUrl = process.env.DATABASE_URL;
let sequelize;

if (dbUrl) {
    console.log('Using DATABASE_URL');
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
    sequelize = new Sequelize(
        process.env.DB_NAME || 'smart_agri',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'smartagri123',
        {
            host: process.env.DB_HOST || 'postgres',
            port: parseInt(process.env.DB_PORT || '5432'),
            dialect: 'postgres',
            logging: false,
        }
    );
}

async function checkDevice() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        // Check for node_a1 in iot_devices table
        const [results] = await sequelize.query(`
            SELECT * FROM "farms" LIMIT 5;
        `);

        if (results.length > 0) {
            console.log('✅ Farms FOUND:', results.length);
            console.log(results[0]);
        } else {
            console.log('❌ No Farms FOUND.');
        }

        if (results.length > 0) {
            console.log('✅ Device node_a1 FOUND:');
            console.log(results[0]);
        } else {
            console.log('❌ Device node_a1 NOT FOUND.');

            // Check what devices DO exist
            const [allDevices] = await sequelize.query('SELECT * FROM "iot_devices" LIMIT 5');
            console.log('Existing devices:', allDevices.map(d => `${d.name} (${d.deviceId})`));
        }

    } catch (error) {
        console.error('Query failed:', error);
    } finally {
        await sequelize.close();
    }
}

checkDevice();
