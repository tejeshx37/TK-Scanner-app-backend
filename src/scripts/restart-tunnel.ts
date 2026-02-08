import { execSync, spawn } from 'child_process';
import dotenv from 'dotenv';
import fs from 'fs';
import https from 'https';
import path from 'path';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const PORT = 3000;
const PREFERRED_SUBDOMAIN = 'tk-verify-2026';
const MOBILE_ENV_PATH = path.join(__dirname, '../../../mobile/.env');
const HEARTBEAT_INTERVAL = 60000;

console.log('🔄 Starting Advanced Localtunnel...');

function killExisting() {
    console.log('Clearing old processes...');
    try {
        if (process.platform === 'win32') {
            execSync('taskkill /F /IM lt.exe', { stdio: 'ignore' });
        } else {
            execSync('pkill -f "localtunnel"', { stdio: 'ignore' });
            execSync('pkill -f "lt --port"', { stdio: 'ignore' });
        }
    } catch (e) { }
}

function updateMobileEnv(url: string) {
    try {
        if (!fs.existsSync(MOBILE_ENV_PATH)) return;
        let content = fs.readFileSync(MOBILE_ENV_PATH, 'utf-8');
        const regex = /EXPO_PUBLIC_API_BASE_URL=.*/;

        if (regex.test(content)) {
            content = content.replace(regex, `EXPO_PUBLIC_API_BASE_URL=${url}`);
        } else {
            content += `\nEXPO_PUBLIC_API_BASE_URL=${url}`;
        }

        fs.writeFileSync(MOBILE_ENV_PATH, content);
        console.log(`📱 Updated mobile .env with: ${url}`);
    } catch (e) {
        console.error('❌ Failed to update mobile .env:', e);
    }
}

function startTunnel() {
    killExisting();

    console.log(`🚀 Requesting tunnel for port ${PORT}...`);

    const lt = spawn('npx', ['--yes', 'localtunnel', '--port', PORT.toString(), '--subdomain', PREFERRED_SUBDOMAIN]);

    lt.stdout.on('data', (data) => {
        const output = data.toString();
        // Look for the URL in the output
        const match = output.match(/your url is: (https:\/\/.*\.loca\.lt)/);
        if (match && match[1]) {
            const actualUrl = match[1];
            console.log(`✅ Tunnel Live: ${actualUrl}`);
            updateMobileEnv(actualUrl);
            startHeartbeat(actualUrl);
        }
        process.stdout.write(data);
    });

    lt.stderr.on('data', (data) => {
        process.stderr.write(data);
    });

    lt.on('close', (code) => {
        console.log(`Tunnel process exited with code ${code}. Restarting in 5s...`);
        setTimeout(startTunnel, 5000);
    });

    lt.unref();
}

let heartbeatInterval: NodeJS.Timeout;
function startHeartbeat(url: string) {
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    console.log(`💓 Heartbeat started for ${url}`);
    heartbeatInterval = setInterval(() => {
        https.get(`${url}/health`, (res) => {
            // Heartbeat check done
        }).on('error', (e) => {
            console.error(`💓 Heartbeat failed: ${e.message}`);
        });
    }, HEARTBEAT_INTERVAL);
}

startTunnel();
process.stdin.resume();
