const { Client } = require('pg');
require('dotenv').config({ path: 'server/.env' });

async function removeDevice() {
    // Use robust attributes to attempt connection
    // 1. Try to use Direct URL if possible (remove -pooler)
    const originalUrl = process.env.DATABASE_URL || '';
    const directUrl = originalUrl.replace('-pooler', '').split('?')[0];

    console.log('Connecting to DB...');
    const client = new Client({
        connectionString: directUrl, // Try direct first
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected.');

        const res = await client.query("DELETE FROM iot_devices WHERE device_id = 'node_a1' RETURNING *");

        if (res.rowCount > 0) {
            console.log(`Successfully deleted device: ${res.rows[0].name} (ID: ${res.rows[0].device_id})`);
        } else {
            console.log("No device found with device_id = 'node_a1'");
        }

    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        await client.end();
    }
}

removeDevice();
