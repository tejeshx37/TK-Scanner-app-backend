import { db } from '../firebase';

async function inspectPass(passId: string) {
    console.log(`--- Inspecting Pass: ${passId} ---`);
    const doc = await db!.collection('passes').doc(passId).get();
    if (doc.exists) {
        console.log('Data:', JSON.stringify(doc.data(), null, 2));
    } else {
        const query = await db!.collection('passes').where('passId', '==', passId).get();
        if (!query.empty) {
            console.log('Found via field query:');
            console.log('Data:', JSON.stringify(query.docs[0].data(), null, 2));
        } else {
            console.log('Pass not found in passes collection.');
        }
    }
    process.exit(0);
}

inspectPass('TdabGGAHGyVHlFGwRv5z').catch(console.error);
