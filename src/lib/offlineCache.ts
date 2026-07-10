// IndexedDB-based offline cache for paste data
// Two stores: 'pasteList' (page → PasteListResponse) and 'pastes' (slug → Paste)

import type { Paste, PasteListResponse } from "./api";
import { isSessionActive } from "./keyStore";

const DB_NAME = "pastebin-offline";
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("pasteList")) {
        db.createObjectStore("pasteList");
      }
      if (!db.objectStoreNames.contains("pastes")) {
        db.createObjectStore("pastes");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txGet<T>(storeName: string, key: string): Promise<T | undefined> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

function txPut(storeName: string, key: string, value: unknown): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value, key);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
        tx.oncomplete = () => db.close();
        tx.oncomplete = () => db.close();
      }),
  );
}

export function clearOfflineCache(): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(["pasteList", "pastes"], "readwrite");
        tx.objectStore("pasteList").clear();
        tx.objectStore("pastes").clear();
        reqComplete(tx, db, resolve, reject);
      }),
  );
}

function reqComplete(
  tx: IDBTransaction,
  db: IDBDatabase,
  resolve: () => void,
  reject: (err: any) => void,
) {
  tx.oncomplete = () => {
    db.close();
    resolve();
  };
  tx.onerror = () => {
    db.close();
    reject(tx.error);
  };
}

// --- Paste List ---

export function cachePasteList(
  page: number,
  data: PasteListResponse,
): Promise<void> {
  if (!isSessionActive()) return Promise.resolve();
  return txPut("pasteList", `page-${page}`, { ...data, cachedAt: Date.now() });
}

export function getCachedPasteList(
  page: number,
): Promise<(PasteListResponse & { cachedAt: number }) | undefined> {
  return txGet("pasteList", `page-${page}`);
}

// --- Individual Pastes ---

export function cachePaste(slug: string, paste: Paste): Promise<void> {
  if (!isSessionActive()) return Promise.resolve();
  return txPut("pastes", slug, { ...paste, cachedAt: Date.now() });
}

export function getCachedPaste(
  slug: string,
): Promise<(Paste & { cachedAt: number }) | undefined> {
  return txGet("pastes", slug);
}

/**
 * Remove a single cached paste. Used when the server has confirmed the
 * paste is gone (deleted, expired, or access revoked) so the stale cached
 * copy doesn't keep resurfacing on future offline/failed-fetch loads.
 */
export function deleteCachedPaste(slug: string): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction("pastes", "readwrite");
        tx.objectStore("pastes").delete(slug);
        reqComplete(tx, db, resolve, reject);
      }),
  );
}

// --- Cache all pastes from a list response (for individual view offline) ---

export async function cachePastesFromList(pastes: Paste[]): Promise<void> {
  if (!isSessionActive()) return Promise.resolve();
  try {
    const db = await openDB();
    const tx = db.transaction("pastes", "readwrite");
    const store = tx.objectStore("pastes");
    for (const paste of pastes) {
      store.put({ ...paste, cachedAt: Date.now() }, paste.slug);
    }
    await new Promise<void>((resolve, reject) => {
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
    // Silently fail — caching is best-effort
  }
}
