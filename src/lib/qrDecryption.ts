import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16; // AES block size

/**
 * Get encryption key from environment variable
 * Falls back to default key if not set
 */
function getEncryptionKey(): Buffer {
    const key = process.env.QR_ENCRYPTION_KEY || 'c82a64c06c982ee1d50863aca97856cc';

    if (key.length !== 32) {
        throw new Error(
            `QR_ENCRYPTION_KEY must be exactly 32 characters (256 bits). ` +
            `Current length: ${key.length}`
        );
    }

    return Buffer.from(key, 'utf8');
}

/**
 * Decrypt QR data from hex string to object
 * 
 * @param encryptedText - Encrypted string in format "IV:ENCRYPTED_DATA"
 * @returns Decrypted object with pass data
 * 
 * @example
 * const encrypted = "a3f5b2c8d4e5f6g7:h8i9j0k1l2m3n4o5...";
 * const passData = decryptQRData(encrypted);
 * // Returns: { id: "pass_123", name: "John Doe", ... }
 */
export function decryptQRData(encryptedText: string): any {
    try {
        const key = getEncryptionKey();

        // Split IV and encrypted data
        const parts = encryptedText.split(':');
        if (parts.length !== 2) {
            throw new Error('Invalid encrypted data format. Expected "IV:DATA"');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];

        // Validate IV length
        if (iv.length !== IV_LENGTH) {
            throw new Error(`Invalid IV length. Expected ${IV_LENGTH} bytes, got ${iv.length}`);
        }

        // Create decipher
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        // Decrypt data
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        // Parse JSON
        return JSON.parse(decrypted);
    } catch (error) {
        throw new Error(
            `Failed to decrypt QR data: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Check if a QR code string is in encrypted format
 * 
 * @param data - QR code string to check
 * @returns true if data appears to be encrypted
 * 
 * @example
 * isEncryptedQR("a3f5b2c8:h8i9j0k1...") // true
 * isEncryptedQR("pass_abc123") // false
 */
export function isEncryptedQR(data: string): boolean {
    if (typeof data !== 'string') {
        return false;
    }

    // Check if data matches encrypted format (IV:DATA)
    // Both parts should be hex strings
    const parts = data.split(':');
    if (parts.length !== 2) {
        return false;
    }

    const [ivHex, encryptedHex] = parts;

    // Check if both parts are valid hex strings
    const hexPattern = /^[0-9a-f]+$/i;
    return hexPattern.test(ivHex) && hexPattern.test(encryptedHex);
}
