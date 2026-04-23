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
            triggerHealth(token);
        } else {
            console.error('Login failed:', res.statusCode, data);
        }
    });
});

loginReq.write(loginData);
loginReq.end();

// 2. Trigger Health Generation
function triggerHealth(token) {
    const healthOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/crops/trigger-health',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    };

    const healthReq = http.request(healthOptions, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log(`Trigger Health Response Status: ${res.statusCode}`);
            console.log('Response Body:', data);
        });
    });

    healthReq.end();
}
