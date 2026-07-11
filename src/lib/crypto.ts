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

// ─── Share Key (password-based sharing) ─────────────────────────────────────

/**
 * Derive a ShareKey from a user-provided share password and the paste slug.
 * The slug is used as the salt so the same password produces different keys
 * for different pastes.
 */
export async function deriveShareKey(
  password: string,
  slug: string,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const salt = enc.encode(slug);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey", "deriveBits"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    false,
    ["wrapKey", "unwrapKey"],
  );
}

/** Wrap a PasteKey with a ShareKey for sharing. Returns base64(IV‖wrapped). */
export async function wrapPasteKeyForShare(
  shareKey: CryptoKey,
  pasteKey: CryptoKey,
): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const wrapped = await crypto.subtle.wrapKey("raw", pasteKey, shareKey, {
    name: "AES-GCM",
    iv,
  });
  const combined = new Uint8Array(IV_LENGTH + wrapped.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(wrapped), IV_LENGTH);
  return bytesToBase64(combined);
}

/** Unwrap a PasteKey using a ShareKey (guest decryption). */
export async function unwrapPasteKeyFromShare(
  shareKey: CryptoKey,
  wrappedBase64: string,
): Promise<CryptoKey> {
  const combined = base64ToBytes(wrappedBase64);
  const iv = combined.slice(0, IV_LENGTH);
  const wrappedKey = combined.slice(IV_LENGTH);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    shareKey,
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
