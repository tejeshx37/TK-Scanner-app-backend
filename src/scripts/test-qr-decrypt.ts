import { decryptQRData, isEncryptedQR } from '../lib/qrDecryption';

// Test with a sample encrypted QR from the main website
// Replace this with an actual encrypted QR string from your system
const testEncrypted = "b6ded7414b24cf7443762b5e98ea6726:75b4e4a8d3cfe1bd73db39fcacbea72c8145dd347204976ed9cfb5e27718f72125ea801133592a1423cfddcd59c4239593338c38cf625a9b550fc049fb67c13e7a745bdff7ad808c1da40f4ead911f210d987f0a5f48a6f2b8fe03184dcf77f9360cd86e8a48a7a0a5f69bbd691ff9233a4fa84df484101f3ee16075408b2aa2d306c1deb2298c09dd67aa3f7c7b55024e5d9236436452eabab22d0fb0d8e07d";

console.log('='.repeat(60));
console.log('QR Code Decryption Test');
console.log('='.repeat(60));
console.log();

console.log('Testing QR string:', testEncrypted.substring(0, 50) + '...');
console.log('Is encrypted format:', isEncryptedQR(testEncrypted));
console.log();

if (!isEncryptedQR(testEncrypted)) {
    console.log('❌ Not in encrypted format (IV:DATA)');
    console.log('   Expected format: hex_iv:hex_encrypted_data');
    process.exit(1);
}

try {
    console.log('Attempting decryption...');
    const result = decryptQRData(testEncrypted);

    console.log('✅ Decryption successful!');
    console.log();
    console.log('Decrypted data:');
    console.log(JSON.stringify(result, null, 2));
    console.log();
    console.log('Pass ID:', result.id);
    console.log('Name:', result.name || result.teamName || 'N/A');
    console.log('Pass Type:', result.passType);
    console.log('Events:', result.events?.join(', ') || 'N/A');
    console.log('Days:', result.days?.join(', ') || 'N/A');

} catch (error: any) {
    console.log('❌ Decryption failed!');
    console.log('Error:', error.message);
    console.log();
    console.log('Troubleshooting:');
    console.log('1. Check that QR_ENCRYPTION_KEY matches the main website backend');
    console.log('2. Verify the encrypted string is complete and not truncated');
    console.log('3. Ensure the QR was generated with the same encryption key');
    process.exit(1);
}

console.log();
console.log('='.repeat(60));
console.log('Test completed successfully!');
console.log('='.repeat(60));
