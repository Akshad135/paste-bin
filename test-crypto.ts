import { webcrypto } from 'crypto';

const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12;
const PBKDF2_ITERATIONS = 100000;

function bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
}

function base64ToBytes(base64: string): Uint8Array {
    return new Uint8Array(Buffer.from(base64, 'base64'));
}

async function run() {
    const crypto = webcrypto as any;
    
    // 1. Generate master key
    const masterKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
    );

    // 2. Generate paste key
    const pasteKey = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt']
    );

    // Encrypt some text with pasteKey
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const enc = new TextEncoder();
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        pasteKey,
        enc.encode("Hello World")
    );
    const combinedEncText = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
    combinedEncText.set(iv);
    combinedEncText.set(new Uint8Array(ciphertext), IV_LENGTH);
    const encryptedTextBase64 = bytesToBase64(combinedEncText);

    // Wrap pasteKey with masterKey
    const iv2 = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const wrappedPasteKey = await crypto.subtle.wrapKey(
        'raw',
        pasteKey,
        masterKey,
        { name: 'AES-GCM', iv: iv2 },
    );
    const combinedEncKey = new Uint8Array(IV_LENGTH + wrappedPasteKey.byteLength);
    combinedEncKey.set(iv2);
    combinedEncKey.set(new Uint8Array(wrappedPasteKey), IV_LENGTH);
    const encryptedPasteKeyBase64 = bytesToBase64(combinedEncKey);

    // --- The Share Flow ---
    const password = "123456";
    const slug = "test-slug";

    // Unwrap pasteKey
    const combined = base64ToBytes(encryptedPasteKeyBase64);
    const iv3 = combined.slice(0, IV_LENGTH);
    const wrappedKey3 = combined.slice(IV_LENGTH);
    const unwrappedPasteKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedKey3,
        masterKey,
        { name: 'AES-GCM', iv: iv3 },
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt'],
    );

    // Derive share key
    const salt = enc.encode(slug);
    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey', 'deriveBits'],
    );
    const shareKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        keyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['wrapKey', 'unwrapKey'],
    );

    // Wrap for share
    const iv4 = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const wrappedForShare = await crypto.subtle.wrapKey(
        'raw',
        unwrappedPasteKey,
        shareKey,
        { name: 'AES-GCM', iv: iv4 },
    );
    const combined4 = new Uint8Array(IV_LENGTH + wrappedForShare.byteLength);
    combined4.set(iv4);
    combined4.set(new Uint8Array(wrappedForShare), IV_LENGTH);
    const sharedEncryptedKey = bytesToBase64(combined4);

    // --- The Guest Flow ---
    // Derive share key again
    const guestKeyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        'PBKDF2',
        false,
        ['deriveKey', 'deriveBits'],
    );
    const guestShareKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt,
            iterations: PBKDF2_ITERATIONS,
            hash: 'SHA-256',
        },
        guestKeyMaterial,
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        false,
        ['wrapKey', 'unwrapKey'],
    );

    // Unwrap from share
    const combined5 = base64ToBytes(sharedEncryptedKey);
    const iv5 = combined5.slice(0, IV_LENGTH);
    const wrappedKey5 = combined5.slice(IV_LENGTH);
    const guestPasteKey = await crypto.subtle.unwrapKey(
        'raw',
        wrappedKey5,
        guestShareKey,
        { name: 'AES-GCM', iv: iv5 },
        { name: 'AES-GCM', length: AES_KEY_LENGTH },
        true,
        ['encrypt', 'decrypt'],
    );

    // Decrypt text
    const combined6 = base64ToBytes(encryptedTextBase64);
    const iv6 = combined6.slice(0, IV_LENGTH);
    const ct6 = combined6.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv6 },
        guestPasteKey,
        ct6
    );

    console.log("SUCCESS:", new TextDecoder().decode(decrypted));
}

run().catch(console.error);
