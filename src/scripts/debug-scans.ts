import { db } from '../firebase';

async function debugCheckIns() {
    console.log('--- Debugging Check-ins ---');

    const scansSnap = await db!.collection('scans').where('passId', '==', 'TdabGGAHGyVHlFGwRv5z').get();
    console.log(`Found ${scansSnap.size} records for TdabGGAHGyVHlFGwRv5z:`);
    scansSnap.forEach(doc => {
        const data = doc.data();
        console.log(`- Scan Record ID: ${doc.id}, status: ${data.status}, scannedAt: ${data.scannedAt?.toDate?.() || 'no date'}`);
    });

    // 2. Check if any duplicate query works manually
    if (scansSnap.size > 0) {
        const firstPassId = scansSnap.docs[0].data().passId;
        console.log(`\nTesting duplicate query for passId: ${firstPassId}`);
        const dup = await db!.collection('scans')
            .where('passId', '==', firstPassId)
            .where('status', '==', 'valid')
            .get();
        console.log(`Manual Query Result: ${dup.size} matches found.`);
    }

    process.exit(0);
}

debugCheckIns().catch(console.error);
