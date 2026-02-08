export interface User {
    id: string;
    email: string;
    name: string;
}

export interface Student {
    passId: string;
    name: string;
    passType: string;
    amountPaid: number;
}

export interface Scan {
    passId: string;
    scannerId: string;
    status: 'valid' | 'duplicate' | 'invalid';
    scannedAt: string; // ISO string
}
