
const http = require('http');

// 1. Login
const loginData = JSON.stringify({ identifier: 'admin@smartagri.com', password: 'admin123' });
const loginOptions = {
    hostname: 'localhost', port: 3000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': loginData.length }
};

const loginReq = http.request(loginOptions, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        if (res.statusCode === 200) {
            const token = JSON.parse(data).accessToken;
            console.log('Login successful.');
            getFarms(token);
        } else { console.error('Login failed', data); }
    });
});
loginReq.write(loginData);
loginReq.end();

// 2. Get Farms List
function getFarms(token) {
    const opts = {
        hostname: 'localhost', port: 3000, path: '/api/farms', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };
    http.get(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            const farms = JSON.parse(data).farms;
            if (farms && farms.length > 0) {
                console.log(`Found ${farms.length} farms. Testing details for ID: ${farms[0].id}`);
                getFarmDetails(token, farms[0].id);
            } else {
                console.error('No farms found. Cannot test details.');
            }
        });
    });
}

// 3. Get Farm Details
function getFarmDetails(token, farmId) {
    const opts = {
        hostname: 'localhost', port: 3000, path: `/api/farms/${farmId}`, method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };
    http.get(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log(`GET Farm Details Status: ${res.statusCode}`);
            if (res.statusCode === 200) {
                console.log('✅ Farm details fetched successfully.');
                // console.log(data); // Uncomment for verbose output
            } else {
                console.error('❌ Failed to fetch farm details.');
                console.error('Response:', data);
            }
        });
    });
}
