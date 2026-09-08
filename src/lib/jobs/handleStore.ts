// IndexedDB store for the file handle and the last-good snapshot.
//
// Two reasons this is not localStorage:
//   1. A FileSystemFileHandle is structured-cloneable but NOT JSON-serialisable,
//      so localStorage physically cannot hold it.
//   2. A 90-day snapshot with bodies runs to megabytes and would fight the
//      resume library for the same ~5MB quota, which is exactly the failure
//      ../storage.ts exists to prevent.
'use client';

import type { JobsSnapshot } from './snapshot';

const DB_NAME = 'jobs-forge';
const DB_VERSION = 1;
const STORE_HANDLES = 'handles';
const STORE_CACHE = 'cache';
const STORE_META = 'meta';

export interface FileMeta {
  name: string;
  lastModified: number;
  size: number;
  readAt: number;
}

export interface CachedSnapshot {
  meta: FileMeta;
  snapshot: JobsSnapshot;
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      // Private mode and some embedded contexts refuse outright.
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of [STORE_HANDLES, STORE_CACHE, STORE_META]) {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

async function withStore<T>(
  store: string,
  mode: IDBTransactionMode,
  fn: (s: IDBObjectStore) => IDBRequest
): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise<T | null>((resolve) => {
    try {
      const tx = db.transaction(store, mode);
      const req = fn(tx.objectStore(store));
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export function putHandle(h: FileSystemFileHandle): Promise<unknown> {
  return withStore(STORE_HANDLES, 'readwrite', (s) => s.put(h, 'snapshot'));
}

export function getHandle(): Promise<FileSystemFileHandle | null> {
  return withStore<FileSystemFileHandle>(STORE_HANDLES, 'readonly', (s) => s.get('snapshot'));
}

export function clearHandle(): Promise<unknown> {
  return withStore(STORE_HANDLES, 'readwrite', (s) => s.delete('snapshot'));
}

/** The parsed snapshot, so a reload does not re-parse megabytes of JSON. */
export function putCache(c: CachedSnapshot): Promise<unknown> {
  return withStore(STORE_CACHE, 'readwrite', (s) => s.put(c, 'last'));
}

export function getCache(): Promise<CachedSnapshot | null> {
  return withStore<CachedSnapshot>(STORE_CACHE, 'readonly', (s) => s.get('last'));
}

export function clearCache(): Promise<unknown> {
  return withStore(STORE_CACHE, 'readwrite', (s) => s.delete('last'));
}

export function putMeta<T>(key: string, value: T): Promise<unknown> {
  return withStore(STORE_META, 'readwrite', (s) => s.put(value, key));
}

export function getMeta<T>(key: string): Promise<T | null> {
  return withStore<T>(STORE_META, 'readonly', (s) => s.get(key));
}
