
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

async function checkAll() {
    try {
        await sequelize.authenticate();
        console.log('Connected to DB.');

        // List all tables
        const [tables] = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name;
        `);

        console.log('\n--- EXISTING TABLES ---');
        tables.forEach(t => console.log(`- ${t.table_name}`));

        // Check specific schemas
        const targetTables = ['farms', 'iot_devices', 'Farmers', 'Farms'];

        for (const table of targetTables) {
            console.log(`\n--- COLUMNS FOR '${table}' ---`);
            const [columns] = await sequelize.query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '${table}'
                ORDER BY column_name;
            `);

            if (columns.length === 0) {
                console.log(`(Table not found)`);
            } else {
                columns.forEach(c => console.log(`  ${c.column_name}: ${c.data_type}`));
            }
        }

    } catch (error) {
        console.error('Check failed:', error);
    } finally {
        process.exit();
    }
}

checkAll();
