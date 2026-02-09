import dotenv from 'dotenv';
import path from 'path';
import { db } from '../firebase';

// Load env explicitly
const result = dotenv.config({ path: path.join(__dirname, '../../.env') });
if (result.error) {
    console.log('⚠️ Could not load .env file:', result.error);
}

console.log('🔍 Checking Firebase Firestore Connection...');

async function checkConnection() {
    try {
        const collections = await db!.listCollections();
        console.log('✅ Connection Successful!');
        console.log(`🗄️ Found ${collections.length} collections.`);
        collections.forEach(col => console.log(` - ${col.id}`));
        process.exit(0);
    } catch (error: any) {
        console.error('❌ Connection Failed:', error.message);
        console.error('Check your FIREBASE_ADMIN_PRIVATE_KEY and other credentials in .env');
        process.exit(1);
    }
}

checkConnection();
