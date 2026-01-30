
const { Sequelize } = require('sequelize');
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
    }
);

async function checkSchema() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        const tables = ['farms', 'iot_devices'];

        for (const table of tables) {
            console.log(`\nChecking table: ${table}`);
            const [results] = await sequelize.query(
                `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '${table}';`
            );

            if (results.length === 0) {
                console.log(`❌ Table '${table}' DOES NOT EXIST.`);
            } else {
                console.log('Columns:');
                results.forEach(row => console.log(` - ${row.column_name} (${row.data_type})`));
            }
        }

    } catch (error) {
        console.error('Schema check failed:', error);
    } finally {
        process.exit();
    }
}

checkSchema();
