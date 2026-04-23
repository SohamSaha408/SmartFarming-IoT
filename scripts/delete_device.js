
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

async function deleteDevice() {
    try {
        await sequelize.authenticate();

        // Direct raw query to avoid model loading issues in script context
        const query = "DELETE FROM iot_devices WHERE device_id = 'node_a1'";
        const [results, metadata] = await sequelize.query(query);

        console.log(`Command Executed. Row count impacted: ${metadata.rowCount}`);
        if (metadata.rowCount > 0) {
            console.log('✅ SUCCESS: Device "node_a1" has been deleted.');
        } else {
            console.log('⚠️ INFO: Device "node_a1" was not found (it might be already deleted).');
        }

    } catch (error) {
        console.error('Error deleting device:', error);
    } finally {
        await sequelize.close();
    }
}

deleteDevice();
