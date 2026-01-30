
const http = require('http');

// 1. Login to get token
const loginData = JSON.stringify({
    identifier: 'admin@smartagri.com',
    password: 'admin123'
});

const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
    }
};

const loginReq = http.request(loginOptions, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        if (res.statusCode === 200) {
            const response = JSON.parse(data);
            const token = response.accessToken;
            console.log('Login successful. Token obtained.');
            createFarm(token);
        } else {
            console.error('Login failed:', res.statusCode, data);
        }
    });
});

loginReq.write(loginData);
loginReq.end();

// 2. Create Farm using token
function createFarm(token) {
    const farmData = JSON.stringify({
        name: "Hero Farm",
        latitude: 19.05588925,
        longitude: 72.88316946,
        landType: "alluvial",
        areaHectares: 5.5,
        soilPh: 6.5
    });

    const farmOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/farms',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': farmData.length,
            'Authorization': `Bearer ${token}`
        }
    };

    const farmReq = http.request(farmOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Create Farm Response Status: ${res.statusCode}`);
            console.log('Response Body:', data);
        });
    });

    farmReq.write(farmData);
    farmReq.end();
}
