/**
 * Local persistence for the E2EE master key.
 *
 * The master key is stored as a *non-extractable* `CryptoKey` object
 * directly in IndexedDB — browsers support structured-cloning `CryptoKey`
 * objects natively, so the object round-trips without ever calling
 * `exportKey`. Because the key is non-extractable, JavaScript (including
 * an XSS payload) can retrieve the `CryptoKey` handle and use it for
 * encrypt/decrypt/wrapKey/unwrapKey, but can never read out the raw key
 * bytes or exfiltrate them to persist/reuse elsewhere.
 *
 * This is strictly safer than exporting the raw key to a string in
 * `sessionStorage`, while still surviving page reloads and tab closures.
 */

const DB_NAME = "ghostbin-keystore";
const DB_VERSION = 1;
const STORE_NAME = "keys";
const KEY_ID = "master";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist the master key (must be a non-extractable CryptoKey). */
export async function saveMasterKey(key: CryptoKey): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(key, KEY_ID);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

/** Load the persisted master key, if any. Best-effort — returns null on any error. */
export async function loadMasterKey(): Promise<CryptoKey | null> {
  try {
    const db = await openDB();
    return await new Promise<CryptoKey | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(KEY_ID);
      req.onsuccess = () =>
        resolve((req.result as CryptoKey | undefined) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  } catch {
    return null;
  }
}

/** Remove the persisted master key (e.g. on logout). Best-effort. */
export async function clearMasterKey(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(KEY_ID);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // best-effort
  }
}

