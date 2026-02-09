import { db } from '../firebase';

async function initAppUsers() {
    console.log('🚀 Initializing appUsers collection...');

    if (!db) {
        console.error('❌ Firestore not initialized. Please check your .env file and Firebase credentials.');
        process.exit(1);
    }

    const appUsersRef = db.collection('appUsers');

    const testUser = {
        name: 'Volunteer User',
        email: 'volunteer@example.com',
        password: 'password123', // In a real app, passwords should be hashed!
        role: 'volunteer',
        createdAt: new Date().toISOString()
    };

    try {
        // Check if user already exists
        const snapshot = await appUsersRef.where('email', '==', testUser.email).get();

        if (snapshot.empty) {
            const docRef = await appUsersRef.add(testUser);
            console.log(`✅ Created test user in appUsers collection with ID: ${docRef.id}`);
        } else {
            console.log('ℹ️ Test user already exists in appUsers collection.');
        }

        console.log('✨ Firestore initialization complete!');
    } catch (error) {
        console.error('❌ Error initializing Firestore:', error);
        process.exit(1);
    }
}

initAppUsers();
