/**
 * E2EE Crypto Module — Web Crypto API helpers.
 *
 * All encryption uses AES-256-GCM with 12-byte random IVs.
 * Master key is derived via PBKDF2 (100 000 iterations, SHA-256).
 *
 * Wire format for encrypted text:  base64( IV‖ciphertext )
 * Wire format for encrypted bytes: raw    ( IV‖ciphertext )
 */

const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits — recommended for AES-GCM

// ─── Base64 helpers ─────────────────────────────────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ─── Master Key ─────────────────────────────────────────────────────────────

/**
 * Derive a MasterKey from the user's passphrase and the server salt.
 * The result is a *non-extractable* AES-GCM-256 key usable for
 * encrypt/decrypt/wrapKey/unwrapKey. It is deliberately non-extractable —
 * raw key bytes are never available to JavaScript. Persistence across
 * reloads is handled by `keyStore.ts`, which stores the CryptoKey object
 * itself (not exported bytes) in IndexedDB.
 */
export async function deriveMasterKey(
  passphrase: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = base64ToBytes(saltBase64);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      // Cast to ArrayBuffer: Web Crypto's BufferSource does not accept
      // Uint8Array<ArrayBufferLike> since that union includes SharedArrayBuffer.
      // base64ToBytes always produces a plain ArrayBuffer-backed Uint8Array.
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false, // non-extractable — raw key bytes never touch JS-readable storage
    ["wrapKey", "unwrapKey", "encrypt", "decrypt"],
  );
}

// ─── Paste Key ──────────────────────────────────────────────────────────────

/** Generate a fresh random AES-GCM-256 key for a single paste. */
export async function generatePasteKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true, // extractable — needed for URL hash export & key wrapping
    ["encrypt", "decrypt"],
  );
}

/** Wrap (encrypt) a PasteKey with the MasterKey.  Returns base64(IV‖wrapped). */
export async function wrapPasteKey(
  masterKey: CryptoKey,
  pasteKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await crypto.subtle.wrapKey("raw", pasteKey, masterKey, {
    name: "AES-GCM",
    iv,
  });
  const combined = new Uint8Array(IV_LENGTH + wrapped.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrapped), IV_LENGTH);
  return bytesToBase64(combined);
}

/** Unwrap (decrypt) a PasteKey with the MasterKey. */
export async function unwrapPasteKey(
  masterKey: CryptoKey,
  wrappedBase64: string,
): Promise<CryptoKey> {
  const combined = base64ToBytes(wrappedBase64);
  const iv = combined.slice(0, IV_LENGTH);
  const wrappedKey = combined.slice(IV_LENGTH);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    masterKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

// ─── Share Key (8-char access-code based sharing) ───────────────────────────

const ACCESS_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACCESS_CODE_LENGTH = 8;
// PBKDF2 iterations for client-side key stretching of the access code.
// High iteration count is important: a 6M-character space must be slow to
// brute-force even if an attacker captures the server-side verifier.
const SHARE_PBKDF2_ITERATIONS = 600_000;

/**
 * Generate a random 8-character alphanumeric access code.
 * Uses an unambiguous alphabet (no 0/O/I/l confusion).
 */
export function generateAccessCode(): string {
  // Rejection-sampling approach: discard any byte >= 240 (the largest
  // multiple of 30 that fits in a u8) so that every remaining byte maps
  // uniformly to one of the 30 alphabet characters.
  // Without rejection, bytes 0-15 would be picked ~3.5% of the time vs
  // ~3.1% for bytes 16-29, a measurable bias that reduces entropy.
  const REJECT_THRESHOLD = Math.floor(256 / ACCESS_CODE_CHARS.length) * ACCESS_CODE_CHARS.length; // 240
  let result = '';
  while (result.length < ACCESS_CODE_LENGTH) {
    // Request extra bytes to reduce the number of iterations needed
    const bytes = crypto.getRandomValues(new Uint8Array(ACCESS_CODE_LENGTH * 2));
    for (let i = 0; i < bytes.length && result.length < ACCESS_CODE_LENGTH; i++) {
      if (bytes[i] < REJECT_THRESHOLD) {
        result += ACCESS_CODE_CHARS[bytes[i] % ACCESS_CODE_CHARS.length];
      }
    }
  }
  return result;
}

/**
 * Derive two cryptographically separate secrets from the access code + slug.
 *
 * Flow:
 *   masterBits = PBKDF2(accessCode, salt=slug, 600_000 iters, SHA-256, 512 bits)
 *   unlockKey  = HKDF-Expand(masterBits, info="unlock")  → AES-GCM-256 key
 *   authSecret = HKDF-Expand(masterBits, info="auth")    → 32-byte hex string
 *
 * - `unlockKey` wraps/unwraps the paste key in the browser. The server never
 *   sees it and therefore cannot decrypt the paste.
 * - `authSecret` is sent to the server during unlock. The server hashes it
 *   with PBKDF2+salt and compares to the stored verifier. Because `authSecret`
 *   ≠ `unlockKey`, the server learning `authSecret` gives it no decryption
 *   capability.
 */
export async function deriveShareSecrets(
  accessCode: string,
  slug: string,
): Promise<{ unlockKey: CryptoKey; authSecret: string }> {
  const enc = new TextEncoder();

  // Step 1: PBKDF2 to stretch the low-entropy access code into 512 bits
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(accessCode),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const masterBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: enc.encode(slug) as unknown as ArrayBuffer,
      iterations: SHARE_PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    512, // 64 bytes — 32 for unlock, 32 for auth
  );

  // Step 2: HKDF to split into two independent outputs
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    masterBits,
    "HKDF",
    false,
    ["deriveKey", "deriveBits"],
  );

  // Derive the AES-GCM unlock key (used to wrap/unwrap the paste key)
  const unlockKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as unknown as ArrayBuffer,
      info: enc.encode("unlock") as unknown as ArrayBuffer,
    },
    hkdfKey,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false, // non-extractable — raw key bytes never touch JS
    ["wrapKey", "unwrapKey"],
  );

  // Derive the auth bits (sent to server for hash verification)
  const authBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0) as unknown as ArrayBuffer,
      info: enc.encode("auth") as unknown as ArrayBuffer,
    },
    hkdfKey,
    256, // 32 bytes
  );
  const authSecret = bytesToBase64(new Uint8Array(authBits));

  return { unlockKey, authSecret };
}

/** Wrap a PasteKey with the share unlockKey for guest sharing. Returns base64(IV‖wrapped). */
export async function wrapPasteKeyForShare(
  unlockKey: CryptoKey,
  pasteKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await crypto.subtle.wrapKey("raw", pasteKey, unlockKey, {
    name: "AES-GCM",
    iv,
  });
  const combined = new Uint8Array(IV_LENGTH + wrapped.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrapped), IV_LENGTH);
  return bytesToBase64(combined);
}

/** Unwrap a PasteKey using the share unlockKey (guest decryption). */
export async function unwrapPasteKeyFromShare(
  unlockKey: CryptoKey,
  wrappedBase64: string,
): Promise<CryptoKey> {
  const combined = base64ToBytes(wrappedBase64);
  const iv = combined.slice(0, IV_LENGTH);
  const wrappedKey = combined.slice(IV_LENGTH);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    unlockKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

// ─── Text encryption ────────────────────────────────────────────────────────

/** Encrypt a UTF-8 string → base64(IV‖ciphertext). */
export async function encryptText(
  key: CryptoKey,
  plaintext: string,
): Promise<string> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return bytesToBase64(combined);
}

/** Decrypt base64(IV‖ciphertext) → UTF-8 string. */
export async function decryptText(
  key: CryptoKey,
  data: string,
): Promise<string> {
  const combined = base64ToBytes(data);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );
  return new TextDecoder().decode(plaintext);
}

// ─── Binary encryption (files) ──────────────────────────────────────────────

/** Encrypt raw bytes → ArrayBuffer(IV‖ciphertext). */
export async function encryptBytes(
  key: CryptoKey,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data,
  );
  const combined = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), IV_LENGTH);
  return combined.buffer;
}

/** Decrypt ArrayBuffer(IV‖ciphertext) → raw bytes. */
export async function decryptBytes(
  key: CryptoKey,
  data: ArrayBuffer,
): Promise<ArrayBuffer> {
  const combined = new Uint8Array(data);
  const iv = combined.slice(0, IV_LENGTH);
  const ciphertext = combined.slice(IV_LENGTH);
  return crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}
