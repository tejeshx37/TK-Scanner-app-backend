import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
import { db } from './firebase'; // Firestore instance

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// GLOBAL CACHE for High-Performance Duplicate Checks
// Stores IDs of passes that are confirmed to be checked in
const checkedInCache = new Set<string>();

// Logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST') {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- API ROUTES ---

// 1. Auth Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email?.trim().toLowerCase();
        const trimmedPassword = password?.trim();

        // 1. Check Mock Credentials first (before any DB access)
        if (normalizedEmail === 'volunteer@example.com' && trimmedPassword === 'password123') {
            console.log('✅ Mock login successful');
            return res.status(200).json({
                success: true,
                token: 'mock-jwt-token-server-side',
                user: { id: 'mock-user-1', name: 'Mock Volunteer', email: normalizedEmail }
            });
        }

        // 2. Check if Firebase is available
        if (!db) {
            console.error('❌ Firebase not initialized. Only mock login is available.');
            return res.status(503).json({
                success: false,
                error: 'Database unavailable. Please contact support or use test credentials.'
            });
        }

        // 3. Check Firestore "appUsers" collection
        const usersRef = db!.collection('appUsers');
        const snapshot = await usersRef.where('email', '==', email).get();

        if (snapshot.empty) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        if (userData.password !== password) {
            return res.status(401).json({ success: false, error: 'Invalid credentials' });
        }

        // Success
        return res.status(200).json({
            success: true,
            token: 'firebase-custom-token-placeholder',
            user: { id: userDoc.id, name: userData.name, email: userData.email }
        });

    } catch (error) {
        console.error('❌ Login Error:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// 2. Scan Ticket
app.post('/api/scan', async (req, res) => {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] POST /api/scan - Payload:`, JSON.stringify(req.body));

    try {
        const { passId, scannerId, userId, passType, token } = req.body;

        if (!passId) return res.status(400).json({ status: 'invalid', error: 'Missing Pass ID' });

        console.log(`Scanning Pass: ${passId}, User: ${userId}, Type: ${passType}`);

        if (typeof passId === 'string' && passId.includes('invalid')) {
            return res.status(200).json({ status: 'invalid', error: 'Ticket explicitly marked invalid' });
        }

        // 0. INSTANT CACHE CHECK (High Volume Optimization)
        // If we know it's checked in, reject immediately (0ms latency)
        if (checkedInCache.has(passId)) {
            console.log(`Scan Result: duplicate (CACHE HIT). Duration: ${Date.now() - startTime}ms`);
            return res.status(200).json({
                status: 'duplicate',
                student: {
                    name: 'Cached Passenger', // We don't need full details for a duplicate rejection
                    passType: passType || 'General',
                    checkedIn: true,
                    firstCheckInTime: new Date().toISOString()
                }
            });
        }

        // Check if Firebase is available
        if (!db) {
            console.error('❌ Firebase not initialized. Cannot scan tickets.');
            return res.status(503).json({ status: 'invalid', error: 'Database unavailable' });
        }

        // PARALLEL EXECUTION: Kick off primary queries simultaneously
        const passRef = db.collection('passes').doc(passId);
        const scansRef = db.collection('scans');

        const passDocPromise = passRef.get();
        // Check for duplicate in parallel (assuming passId is the primary key)
        const duplicateCheckPromise = scansRef
            .where('passId', '==', passId)
            .where('status', '==', 'valid')
            .limit(1)
            .get();

        const [passDoc, duplicateRef] = await Promise.all([passDocPromise, duplicateCheckPromise]);

        let studentData = null;
        let passFound = false;

        if (passDoc.exists) {
            const passData = passDoc.data();
            passFound = true;

            studentData = {
                name: passData?.userName || passData?.name || 'Access Pass',
                passType: passData?.passType || passType || 'General',
                amountPaid: passData?.amount || passData?.price || 0,
                members: passData?.teamSnapshot?.members || null,
                checkedIn: passData?.checkedIn || false,
                checkedInAt: passData?.checkedInAt || null
            };

            // Populate Cache if already checked in
            if (passData?.checkedIn && !passData.teamSnapshot?.members) {
                checkedInCache.add(passId);
            }
        } else {
            // Fallback: Secondary lookup by field 'passId'
            // This path is slower and sequential, but necessary for robustness
            const querySnap = await db!.collection('passes').where('passId', '==', passId).limit(1).get();
            if (!querySnap.empty) {
                passFound = true;
                const d = querySnap.docs[0].data();
                studentData = {
                    name: d.userName || d.name || 'Access Pass',
                    passType: d.passType || passType || 'General',
                    amountPaid: d.amount || d.price || 0,
                    members: d.teamSnapshot?.members || null,
                    checkedIn: d.checkedIn || false,
                    checkedInAt: d.checkedInAt || null
                };

                // Populate Cache if already checked in
                if (d.checkedIn && !d.teamSnapshot?.members) {
                    checkedInCache.add(passId);
                }
            }
        }

        if (!passFound) {
            console.log(`Scan failed: Ticket not found. Duration: ${Date.now() - startTime}ms`);
            return res.status(200).json({ status: 'invalid', error: 'Ticket not found in database' });
        }

        // C. Check for Duplicate Scans
        // We use the duplicateRef from the parallel query
        const isActuallyCheckedIn = !duplicateRef.empty || studentData!.checkedIn === true;

        if (isActuallyCheckedIn && !studentData!.members) {
            // Update cache for next time
            checkedInCache.add(passId);

            let scanDate = studentData!.checkedInAt ? new Date(studentData!.checkedInAt) : new Date();

            if (!duplicateRef.empty) {
                const firstScan = duplicateRef.docs[0].data();
                if (firstScan.scannedAt?.toDate) scanDate = firstScan.scannedAt.toDate();
            }

            console.log(`Scan Result: duplicate. Duration: ${Date.now() - startTime}ms`);
            return res.status(200).json({
                status: 'duplicate',
                student: {
                    ...studentData,
                    firstCheckInTime: scanDate.toISOString()
                }
            });
        }

        console.log(`Scan Result: valid. Duration: ${Date.now() - startTime}ms`);
        // Return the document ID as _id so frontend knows which ID to confirm
        const studentInfo = {
            ...studentData,
            _id: passId
        };

        return res.status(200).json({ status: 'valid', student: studentInfo });

    } catch (error) {
        console.error('Scan Error:', error);
        res.status(500).json({ status: 'invalid', error: 'Server error' });
    }
});

// 3. Confirm Check-in
app.post('/api/scan/confirm', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/scan/confirm - Payload:`, JSON.stringify(req.body));
    try {
        const { passId, memberId } = req.body;

        // Check if Firebase is available
        if (!db) {
            console.error('❌ Firebase not initialized. Cannot confirm check-in.');
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        const passRef = db.collection('passes').doc(passId);

        if (memberId) {
            // 1. Individual check-in for group member
            const passDoc = await passRef.get();

            if (passDoc.exists) {
                const data = passDoc.data();
                if (data?.teamSnapshot?.members) {
                    const updatedMembers = data.teamSnapshot.members.map((m: any) =>
                        m.memberId === memberId ? { ...m, checkedIn: true, checkedInAt: new Date().toISOString() } : m
                    );

                    await passRef.update({
                        'teamSnapshot.members': updatedMembers
                    });
                }
            }
        } else {
            // 2. Standard Individual Pass Check-in
            // Update the main pass document to show it's been used
            await passRef.update({
                checkedIn: true,
                checkedInAt: new Date().toISOString()
            }).catch(async (err) => {
                // If doc update fails (e.g. not found by ID), try finding by passId field
                const query = await db!.collection('passes').where('passId', '==', passId).limit(1).get();
                if (!query.empty) {
                    await query.docs[0].ref.update({
                        checkedIn: true,
                        checkedInAt: new Date().toISOString()
                    });
                }
            });

            // Add to Instant Cache for future scans
            checkedInCache.add(passId);
        }

        // 3. Always add a record to the scans log
        await db!.collection('scans').add({
            passId,
            memberId: memberId || null,
            scannerId: 'device-id-placeholder',
            status: 'valid',
            scannedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Confirmed Check-in: ${passId} ${memberId ? `(Member: ${memberId})` : ''}`);
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Confirm Error:', error);
        res.status(500).json({ success: false, error: 'Failed to record check-in' });
    }
});

// Start Server
// Explicitly listen on 0.0.0.0 to be reachable from other devices on the same Wi-Fi
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on http://192.168.29.83:${PORT} [Mode: ${process.env.NODE_ENV}]`);
});

export default app;
