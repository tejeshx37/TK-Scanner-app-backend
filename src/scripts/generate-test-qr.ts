import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { db } from '../firebase';

// Load env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const ENCRYPTION_KEY = process.env.QR_ENCRYPTION_KEY || 'c82a64c06c982ee1d50863aca97856cc';

function encrypt(text: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'utf8'), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
}

async function generateTestQR() {
    console.log('🔍 Searching for a Day Pass in Firestore...');

    try {
        if (!db) {
            console.error('❌ Firestore not initialized');
            process.exit(1);
        }

        // Try to find a Day Pass specifically
        let query = await db.collection('passes')
            .where('passType', '==', 'day_pass')
            .limit(1)
            .get();

        if (query.empty) {
            console.log('⚠️ No Day Pass found. Searching for any pass...');
            query = await db.collection('passes').limit(1).get();
        }

        if (query.empty) {
            console.log('❌ No passes found in database at all.');
            process.exit(1);
        }

        const doc = query.docs[0];
        const data = doc.data();

        console.log('✅ Found Pass:', doc.id);
        console.log('👤 User:', data.userName || data.name || 'Anonymous');
        console.log('🎫 Type:', data.passType);

        // Construct QR Data Object
        // This matches the format expected by the decryption utility
        const qrData = {
            id: doc.id,
            userId: data.userId || data.email || 'unknown',
            passType: data.passType,
            token: data.token || doc.id,
            name: data.userName || data.name || 'Access Pass'
        };

        const encryptedString = encrypt(JSON.stringify(qrData));

        console.log('\n' + '='.repeat(60));
        console.log('🚀 ENCRYPTED QR CODE STRING:');
        console.log('='.repeat(60));
        console.log(encryptedString);
        console.log('='.repeat(60));
        console.log('\nCopy-paste the string above into the "QR Data" input of your scanner (if manual input is enabled) or generate a QR code from it.');

        process.exit(0);
    } catch (error: any) {
        console.error('❌ Error generating QR:', error.message);
        process.exit(1);
    }
}

generateTestQR();
