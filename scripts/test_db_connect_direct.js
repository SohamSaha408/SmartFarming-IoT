const { Client } = require('pg');
require('dotenv').config({ path: 'server/.env' });

// Attempt to construct the DIRECT connection URI by removing '-pooler'
// Original: ...@ep-calm-block-a1rj4aob-pooler.ap-southeast-1...
// Direct:   ...@ep-calm-block-a1rj4aob.ap-southeast-1...
const originalUrl = process.env.DATABASE_URL || '';
const directUrl = originalUrl.replace('-pooler', '').split('?')[0];

console.log('Original URL (masked):', originalUrl.replace(/:[^:@]*@/, ':****@'));
console.log('Testing DIRECT connection to:', directUrl.replace(/:[^:@]*@/, ':****@'));

const client = new Client({
    connectionString: directUrl,
    ssl: {
        rejectUnauthorized: false
    }
});

client.connect()
    .then(() => {
        console.log('SUCCESS: Connected via Direct URL!');
        return client.query('SELECT NOW()');
    })
    .then(res => {
        console.log('Time:', res.rows[0].now);
        return client.end();
    })
    .catch(err => {
        console.error('FAILED (Direct):', err.message);
        client.end();
    });
