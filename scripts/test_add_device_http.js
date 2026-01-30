
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

// 2. Get Farms to find a valid farmId
function getFarms(token) {
    const opts = {
        hostname: 'localhost', port: 3000, path: '/api/farms', method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };
    http.get(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log('GET /farms raw response:', data);
            try {
                const farms = JSON.parse(data).farms;
                if (farms && farms.length > 0) {
                    console.log(`Found ${farms.length} farms. Using ID: ${farms[0].id}`);
                    registerDevice(token, farms[0].id);
                } else {
                    console.error('No farms found. Cannot add device.');
                }
            } catch (e) {
                console.error('Error parsing farms response:', e);
            }
        });
    });
}

// 3. Register Device
function registerDevice(token, farmId) {
    const devData = JSON.stringify({
        farmId: farmId,
        deviceId: `DEV-${Math.floor(Math.random() * 10000)}`,
        deviceType: "soil_sensor",
        name: "Test Soil Sensor",
        latitude: 19.05,
        longitude: 72.88
    });

    const opts = {
        hostname: 'localhost', port: 3000, path: '/api/devices/register', method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': devData.length,
            'Authorization': `Bearer ${token}`
        }
    };

    const req = http.request(opts, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
            console.log(`Register Device Status: ${res.statusCode}`);
            console.log('Body:', data);
        });
    });
    req.write(devData);
    req.end();
}
