import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

if (!admin.apps.length) {
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            // Handle private key specificly for environment variables
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.error('Missing Firebase Admin credentials. Please check .env file.');
            // Don't crash here to allow mock mode if needed, but logging error is good.
        } else {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // Optional for Firestore
            });
            console.log('🔥 Firebase Admin Initialized');
        }
    } catch (error) {
        console.error('Firebase admin initialization error', error);
    }
}

export const db = admin.firestore();
