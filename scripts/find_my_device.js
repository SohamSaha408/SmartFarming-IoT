
const { Sequelize } = require('sequelize');
require('dotenv').config({ path: 'd:/smart-agri-iot/server/.env' });

const dbUrl = process.env.DATABASE_URL;
let sequelize;

if (dbUrl) {
    sequelize = new Sequelize(dbUrl, {
        dialect: 'postgres',
        logging: false,
        dialectOptions: { ssl: { require: true, rejectUnauthorized: false } }
    });
} else {
    // Fallback for local
    sequelize = new Sequelize(
        process.env.DB_NAME || 'smart_agri',
        process.env.DB_USER || 'postgres',
        process.env.DB_PASSWORD || 'smartagri123',
        {
            host: process.env.DB_HOST || 'localhost',
            dialect: 'postgres',
            logging: false,
        }
    );
}

async function findDevice() {
    try {
        await sequelize.authenticate();

        const query = `
            SELECT f.name as farm_name 
            FROM iot_devices d
            JOIN farms f ON d.farm_id = f.id
            WHERE d.device_id = 'node_a1';
        `;

        const [results] = await sequelize.query(query);

        if (results.length > 0) {
            console.log('FARM_NAME:' + results[0].farm_name);
        } else {
            console.log('NOT_FOUND');
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

findDevice();
