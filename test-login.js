const fetch = require('node-fetch');

async function testLogin() {
    const url = 'http://localhost:3000/api/auth/login';
    console.log(`Testing login at: ${url}`);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: 'volunteer@example.com',
                password: 'password123'
            })
        });

        const status = response.status;
        const text = await response.text();
        console.log(`Status: ${status}`);
        console.log(`Response: ${text}`);

        if (status === 200) {
            console.log('✅ TEST PASSED: Mock login works!');
        } else {
            console.log('❌ TEST FAILED');
        }
    } catch (error) {
        console.error('❌ Connection failed. Is the server running?', error.message);
    }
}

testLogin();
