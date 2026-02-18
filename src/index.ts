import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import * as admin from 'firebase-admin';
import { db } from './firebase'; // Firestore instance
import { decryptQRData, isEncryptedQR } from './lib/qrDecryption';

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
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        env: process.env.NODE_ENV || 'development',
        firebase: !!db
    });
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

// 2. Get Events (New)
app.get('/api/events', async (req, res) => {
    try {
        if (!db) {
            // Full comprehensive defaults based on provided mapping
            return res.status(200).json([
                { id: 'gate', name: 'Gate Entry', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert', 'group_events'] },
                // Performance (Day, Proshow, Sana)
                { id: 'choreo', name: 'Choreo Showcase', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'rap-athon', name: 'Rap-a-thon', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'singing', name: 'Solo Singing', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'dual-dance', name: 'Dual Dance', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'cypher', name: 'Cypher', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'bob', name: 'Battle of Bands', allowedPassTypes: ['day_pass', 'sana_concert'] },
                // Creative (Day, Proshow, Sana)
                { id: 'paint-town', name: 'Paint the Town', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'filmfinatics', name: 'Filmfinatics', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'designers', name: 'Designers Onboard', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'frame-spot', name: 'Frame Spot', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                // Technical (Day, Proshow, Sana)
                { id: 'ctf', name: 'Upside Down CTF', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'mlops', name: 'MLOps Workshop', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'prompt-pixel', name: 'Prompt Pixel', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'model-mastery', name: 'Model Mastery', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                // Day + Sana
                { id: 'deadlock', name: 'Deadlock', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'crack-code', name: 'Crack the Code', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'web3-games', name: 'Building Games Web3', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'gaming', name: 'Gaming Event', allowedPassTypes: ['day_pass', 'sana_concert'] },
                // Strategic/Business (Day, Proshow, Sana)
                { id: 'ceo', name: 'The 90 Minute CEO', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'astrotrack', name: 'Astrotrack', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'channel-surf', name: 'Channel Surfing', allowedPassTypes: ['day_pass', 'proshow', 'sana_concert'] },
                { id: 'case-files', name: 'Case Files', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'summit', name: 'Mock Global Summit', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'lies', name: 'Chain of Lies', allowedPassTypes: ['day_pass', 'sana_concert'] },
                { id: 'exchange', name: 'Exchange Effect', allowedPassTypes: ['day_pass', 'sana_concert', 'group_events'] },
                // All Access / Group Only
                { id: 'treasure', name: 'Treasure Hunt', allowedPassTypes: ['sana_concert', 'group_events'] },
                { id: 'foss-treasure', name: 'FOSS Treasure Hunt', allowedPassTypes: ['sana_concert', 'group_events'] },
                { id: 'borderland', name: 'Borderland Protocol', allowedPassTypes: ['sana_concert', 'group_events'] }
            ]);
        }

        const eventsRef = db.collection('events');
        const snapshot = await eventsRef.get();

        if (snapshot.empty) {
            // Return defaults if collection is empty
            return res.status(200).json([
                { id: 'gate', name: 'Gate Entry', allowedPassTypes: ['GENERAL', 'VIP_PRO', 'STAFF', 'WORKSHOP'] }
            ]);
        }

        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        res.status(200).json(events);
    } catch (error) {
        console.error('❌ Events Fetch Error:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

// 2. Scan Ticket
app.post('/api/scan', async (req, res) => {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] POST /api/scan - Payload:`, JSON.stringify(req.body));

    try {
        let { passId, scannerId, userId, passType, token, event, eventId, eventName, passCategory, attendanceDate } = req.body;

        if (!passId) return res.status(400).json({ status: 'invalid', error: 'Missing Pass ID' });

        // NEW: Check if QR is encrypted and decrypt
        if (isEncryptedQR(passId)) {
            try {
                console.log(`[${new Date().toISOString()}] Encrypted QR detected, decrypting...`);
                const decryptedData = decryptQRData(passId);
                console.log('Decrypted QR data:', JSON.stringify(decryptedData));

                // Extract passId from decrypted data
                const originalPassId = passId;
                passId = decryptedData.id;

                // Optionally use other fields for enriched validation
                if (!passType && decryptedData.passType) {
                    passType = decryptedData.passType;
                }

                console.log(`Extracted Pass ID: ${passId} from encrypted QR`);
            } catch (decryptError: any) {
                console.error('QR decryption failed:', decryptError.message);
                return res.status(200).json({
                    status: 'invalid',
                    error: 'Invalid or corrupted QR code'
                });
            }
        }

        // Firestore paths cannot contain "//". Validate passId before using it in .doc() or query
        if (typeof passId === 'string' && passId.includes('//')) {
            console.warn(`[${new Date().toISOString()}] Rejected invalid Pass ID format: ${passId}`);
            return res.status(200).json({ status: 'invalid', error: 'Invalid Ticket Format' });
        }

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

    } catch (error: any) {
        console.error('Scan Error:', error);
        res.status(500).json({
            status: 'invalid',
            error: 'Server error',
            message: error.message
        });
    }
});

// 3. Confirm Check-in
app.post('/api/scan/confirm', async (req, res) => {
    console.log(`[${new Date().toISOString()}] POST /api/scan/confirm - Payload:`, JSON.stringify(req.body));
    try {
        let { passId, memberId } = req.body;

        if (!passId) return res.status(400).json({ success: false, error: 'Missing Pass ID' });

        // NEW: Check if QR is encrypted and decrypt
        if (isEncryptedQR(passId)) {
            try {
                console.log(`[${new Date().toISOString()}] Confirming encrypted QR, decrypting...`);
                const decryptedData = decryptQRData(passId);
                passId = decryptedData.id;
                console.log(`Extracted Pass ID: ${passId} for confirmation`);
            } catch (decryptError: any) {
                console.error('QR decryption failed during confirmation:', decryptError.message);
                return res.status(200).json({ success: false, error: 'Invalid QR format' });
            }
        }


        // Firestore paths cannot contain "//".
        if (typeof passId === 'string' && passId.includes('//')) {
            return res.status(400).json({ success: false, error: 'Invalid Pass ID format' });
        }

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

        // 4. Write to event_attendance collection for per-event tracking
        // Allows same person to attend multiple events on the same day
        const { eventId, eventName, passCategory, attendanceDate } = req.body;
        if (eventId) {
            const today = attendanceDate || new Date().toISOString().split('T')[0];
            // Per-event duplicate check: passId + eventId + date
            const existingAttendance = await db!.collection('event_attendance')
                .where('passId', '==', passId)
                .where('eventId', '==', eventId)
                .where('attendanceDate', '==', today)
                .limit(1)
                .get();

            if (existingAttendance.empty) {
                await db!.collection('event_attendance').add({
                    passId,
                    memberId: memberId || null,
                    eventId,
                    eventName: eventName || eventId,
                    passCategory: passCategory || null,
                    attendanceDate: today,
                    scannedAt: admin.firestore.FieldValue.serverTimestamp(),
                    isOfflineSync: false
                });
                console.log(`[event_attendance] Recorded: ${passId} @ ${eventId} on ${today}`);
            } else {
                console.log(`[event_attendance] Duplicate skipped: ${passId} @ ${eventId} on ${today}`);
            }
        }

        console.log(`Confirmed Check-in: ${passId} ${memberId ? `(Member: ${memberId})` : ''}`);
        res.status(200).json({ success: true });
    } catch (error: any) {
        console.error('Confirm Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record check-in',
            message: error.message
        });
    }
});

// 4. Unified Sync for Offline Scans
app.post('/api/sync', async (req, res) => {
    const startTime = Date.now();
    console.log(`[${new Date().toISOString()}] POST /api/sync - Payload:`, JSON.stringify(req.body));

    try {
        let { passId, scannerId, userId, passType, event, eventId, eventName, passCategory, attendanceDate, scannedAt } = req.body;

        if (!passId) return res.status(400).json({ success: false, error: 'Missing Pass ID' });

        // NEW: Check if QR is encrypted and decrypt
        if (isEncryptedQR(passId)) {
            try {
                console.log(`[${new Date().toISOString()}] Syncing encrypted QR, decrypting...`);
                const decryptedData = decryptQRData(passId);
                passId = decryptedData.id;
                if (!passType && decryptedData.passType) passType = decryptedData.passType;
                console.log(`Extracted Pass ID: ${passId} for sync`);
            } catch (decryptError: any) {
                console.error('QR decryption failed during sync:', decryptError.message);
                // For sync, we might want to still record it as invalid or just fail
                return res.status(200).json({ success: false, status: 'invalid', error: 'Invalid QR format' });
            }
        }


        // Check if Firebase is available
        if (!db) {
            console.error('❌ Firebase not initialized. Cannot sync.');
            return res.status(503).json({ success: false, error: 'Database unavailable' });
        }

        // 1. Validate Ticket Exists
        const passRef = db.collection('passes').doc(passId);
        const passDoc = await passRef.get();

        if (!passDoc.exists) {
            // Check secondary field
            const query = await db.collection('passes').where('passId', '==', passId).limit(1).get();
            if (query.empty) {
                return res.status(200).json({ success: false, status: 'invalid', error: 'Ticket not found' });
            }
            // If found by field, we use that ref
            const targetDoc = query.docs[0];
            const targetData = targetDoc.data();
            const targetRef = targetDoc.ref;

            // CONFLICT RESOLUTION: Use earlier timestamp
            let targetCheckedInAt = scannedAt ? new Date(scannedAt).toISOString() : new Date().toISOString();
            if (targetData.checkedIn && targetData.checkedInAt) {
                const dbTime = new Date(targetData.checkedInAt).getTime();
                const clientTime = scannedAt || Date.now();
                if (dbTime < clientTime) {
                    targetCheckedInAt = targetData.checkedInAt; // Keep earlier DB time
                }
            }

            await targetRef.update({
                checkedIn: true,
                checkedInAt: targetCheckedInAt
            });
        } else {
            const passData = passDoc.data();
            // CONFLICT RESOLUTION: Use earlier timestamp
            let targetCheckedInAt = scannedAt ? new Date(scannedAt).toISOString() : new Date().toISOString();
            if (passData?.checkedIn && passData?.checkedInAt) {
                const dbTime = new Date(passData.checkedInAt).getTime();
                const clientTime = scannedAt || Date.now();
                if (dbTime < clientTime) {
                    targetCheckedInAt = passData.checkedInAt; // Keep earlier DB time
                }
            }

            await passRef.update({
                checkedIn: true,
                checkedInAt: targetCheckedInAt
            });
        }

        // 2. Add to Instant Cache
        checkedInCache.add(passId);

        // 3. Record the Scan Log
        await db.collection('scans').add({
            passId,
            scannerId: scannerId || 'offline_device',
            userId: userId || null,
            event: event || 'Gate Entry',
            status: 'valid',
            scannedAt: scannedAt ? admin.firestore.Timestamp.fromMillis(scannedAt) : admin.firestore.FieldValue.serverTimestamp(),
            isOfflineSync: true
        });

        // 4. Write to event_attendance for per-event tracking
        // Per-event duplicate check: same person can attend multiple events on same day
        const today = attendanceDate || new Date().toISOString().split('T')[0];
        if (eventId) {
            const existingAttendance = await db.collection('event_attendance')
                .where('passId', '==', passId)
                .where('eventId', '==', eventId)
                .where('attendanceDate', '==', today)
                .limit(1)
                .get();

            if (existingAttendance.empty) {
                await db.collection('event_attendance').add({
                    passId,
                    eventId,
                    eventName: eventName || event || eventId,
                    passCategory: passCategory || passType || null,
                    attendanceDate: today,
                    scannerId: scannerId || 'offline_device',
                    scannedAt: scannedAt ? admin.firestore.Timestamp.fromMillis(scannedAt) : admin.firestore.FieldValue.serverTimestamp(),
                    isOfflineSync: true
                });
                console.log(`[event_attendance] Synced offline: ${passId} @ ${eventId} on ${today}`);
            } else {
                console.log(`[event_attendance] Duplicate skipped on sync: ${passId} @ ${eventId} on ${today}`);
            }
        }

        console.log(`Successfully synced offline scan: ${passId}. Duration: ${Date.now() - startTime}ms`);
        res.status(200).json({ success: true, status: 'valid' });

    } catch (error: any) {
        console.error('Sync Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to sync scan',
            message: error.message
        });
    }
});

// --- ERROR HANDLING ---

// 4. 404 Handler for undefined routes
app.use((req, res) => {
    console.warn(`[${new Date().toISOString()}] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({
        success: false,
        error: 'Route not found'
    });
});

// 5. Global Error Handler (Must be last)
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(`[${new Date().toISOString()}] GLOBAL ERROR:`, err);

    // Handle JSON parsing errors from express.json()
    if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
    }

    res.status(err.status || 500).json({
        success: false,
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
    });
});

// Start Server
// Explicitly listen on 0.0.0.0 to be reachable from other devices on the same Wi-Fi
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT} [Mode: ${process.env.NODE_ENV}]`);
});

export default app;
