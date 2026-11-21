const DB_NAME = 'ali-hub-local';
const DB_VERSION = 1;
let dbPromise;

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('This browser does not support local offline storage. Please use an up-to-date browser.'));
  if (!dbPromise) dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'id' });
        store.createIndex('user_section', ['user_id', 'section'], { unique: false });
      }
      if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox', { keyPath: 'opId', autoIncrement: true });
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    request.onerror = () => { dbPromise = null; reject(request.error || new Error('Could not open local storage.')); };
    request.onblocked = () => reject(new Error('Local storage is busy in another ALI HUB tab. Close other tabs and try again.'));
  });
  return dbPromise;
}

export async function getStorageInfo() {
  try {
    const estimate = await navigator.storage?.estimate?.();
    const persisted = await navigator.storage?.persisted?.();
    return {
      supported: Boolean(estimate),
      usage: Number(estimate?.usage || 0),
      quota: Number(estimate?.quota || 0),
      persisted: Boolean(persisted),
      percent: estimate?.quota ? Math.min(100, Math.round((estimate.usage || 0) / estimate.quota * 100)) : null,
    };
  } catch {
    return { supported: false, usage: 0, quota: 0, persisted: false, percent: null };
  }
}

export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch { /* Browser may decline persistent storage. */ }
  return false;
}

async function checkFileCapacity(file) {
  if (!file || !Number.isFinite(file.size)) throw new Error('Invalid document file.');
  const info = await getStorageInfo();
  if (info.quota > 0) {
    const available = Math.max(0, info.quota - info.usage);
    // Keep a small reserve so records and browser metadata can still be saved.
    const reserve = Math.min(10 * 1024 * 1024, Math.max(1024 * 1024, info.quota * 0.02));
    if (file.size > Math.max(0, available - reserve)) {
      throw new Error(`Not enough device storage for this file. Available: ${formatBytes(available)}. Free up space or choose a smaller file.`);
    }
  }
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index ? 1 : 0)} ${units[index]}`;
}

export async function storeGetAll(name) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(name, 'readonly').objectStore(name).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error('Could not read local data.'));
  });
}
export async function storeGet(name, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(name, 'readonly').objectStore(name).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Could not read this local item.'));
  });
}
export async function storePut(name, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => { const error = tx.error; reject(error?.name === 'QuotaExceededError' ? new Error('Device storage is full. Export a backup and free up device space before saving more data.') : (error || new Error('Could not save local data.'))); };
    tx.onabort = () => { const error = tx.error; reject(error?.name === 'QuotaExceededError' ? new Error('Device storage is full. Export a backup and free up device space before saving more data.') : (error || new Error('Local save was cancelled.'))); };
  });
}
export async function storeDelete(name, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, 'readwrite');
    tx.objectStore(name).delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not delete local data.'));
    tx.onabort = () => reject(tx.error || new Error('Local delete was cancelled.'));
  });
}
export async function storePutAndQueue(name, value, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([name, 'outbox'], 'readwrite');
    tx.objectStore(name).put(value);
    tx.objectStore('outbox').add(operation);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => { const error = tx.error; reject(error?.name === 'QuotaExceededError' ? new Error('Device storage is full. Export a backup and free up device space before saving more data.') : (error || new Error('Could not save the record and sync queue.'))); };
    tx.onabort = () => reject(tx.error || new Error('Record save and sync queue were cancelled.'));
  });
}

export async function queueOperation(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').add(operation);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Could not queue cloud sync.'));
    tx.onabort = () => reject(tx.error || new Error('Cloud sync queue update was cancelled.'));
  });
}
export async function clearOperation(opId) { return storeDelete('outbox', opId); }
export async function saveFile(id, file, metadata = {}) {
  await checkFileCapacity(file);
  return storePut('files', { id, file, metadata, saved_at: new Date().toISOString() });
}
export async function getFile(id) { return storeGet('files', id); }
export async function deleteFile(id) { return storeDelete('files', id); }
