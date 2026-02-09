import dotenv from 'dotenv';
import * as admin from 'firebase-admin';

dotenv.config();

let db: admin.firestore.Firestore | null = null;

if (!admin.apps.length) {
    try {
        const serviceAccount = {
            projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
            // Handle private key specificly for environment variables
            privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        };

        if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
            console.warn('⚠️  Missing Firebase Admin credentials. Firebase features will be disabled. Mock login will still work.');
        } else {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
                // databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.firebaseio.com` // Optional for Firestore
            });
            console.log('🔥 Firebase Admin Initialized');
            db = admin.firestore();
        }
    } catch (error) {
        console.error('❌ Firebase admin initialization error:', error);
        console.warn('⚠️  Continuing without Firebase. Only mock login will work.');
    }
} else {
    try {
        db = admin.firestore();
    } catch (error) {
        console.error('❌ Failed to get Firestore instance:', error);
    }
}

export { db };
