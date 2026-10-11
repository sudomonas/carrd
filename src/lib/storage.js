// Draft persistence. Text state and design go to localStorage as separate
// keys; image blobs go to IndexedDB (never base64 in localStorage).
const SOURCE_KEY = 'carrd:v1:source';
const DESIGN_KEY = 'carrd:v1:design';

export function readDraft() {
  try {
    const source = JSON.parse(localStorage.getItem(SOURCE_KEY) ?? 'null');
    const design = JSON.parse(localStorage.getItem(DESIGN_KEY) ?? 'null');
    return { source, design, error: null };
  } catch (e) {
    return { source: null, design: null, error: e };
  }
}

/** Returns null on success or an Error (quota, private mode…). */
export function writeDraft(source, design) {
  try {
    localStorage.setItem(SOURCE_KEY, JSON.stringify(source));
    localStorage.setItem(DESIGN_KEY, JSON.stringify(design));
    return null;
  } catch (e) {
    return e;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(SOURCE_KEY);
    localStorage.removeItem(DESIGN_KEY);
  } catch {
    /* storage unavailable: nothing to clear */
  }
}

const DB_NAME = 'carrd';
const STORE = 'assets';
let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }).catch((e) => {
    dbPromise = null;
    throw e;
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const putAsset = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getAsset = (id) => tx('readonly', (s) => s.get(id));
export const deleteAsset = (id) => tx('readwrite', (s) => s.delete(id));

/** Session key for text handed from the landing page's demo to the studio. */
export const HANDOFF_KEY = 'carrd:handoff';
