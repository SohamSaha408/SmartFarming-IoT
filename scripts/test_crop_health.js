const http = require('http');

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
            getFarms(token);
        } else {
            console.error('Login failed:', res.statusCode, data);
        }
    });
});

loginReq.write(loginData);
loginReq.end();

function getFarms(token) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/farms',
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };

    http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            const farms = JSON.parse(data).farms;
            if (farms.length > 0) getCrops(token, farms[0].id);
        });
    }).end();
}

function getCrops(token, farmId) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/crops/farm/${farmId}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };

    http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
             const crops = JSON.parse(data).crops;
             if (crops.length > 0) getCropHealth(token, crops[0].id);
        });
    }).end();
}

function getCropHealth(token, cropId) {
    const options = {
        hostname: 'localhost',
        port: 3000,
        path: `/api/crops/${cropId}/health?limit=30`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    };

    http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Health Response Status: ${res.statusCode}`);
            console.log(JSON.parse(data));
        });
    }).end();
}
