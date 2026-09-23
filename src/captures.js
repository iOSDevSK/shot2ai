// Captures live in the extension's own IndexedDB between the capture, the
// area selection and the editor tab. They never leave this browser except
// through the html2wp bridge on 127.0.0.1.
const DB = 'html2wp-captures';
const STORE = 'captures';
// Captures older than this are removed the next time one is saved.
const KEEP_MS = 24 * 60 * 60 * 1000;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, action) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const req = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(req?.result);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function putCapture(id, value) {
  const old = Date.now() - KEEP_MS;
  const keys = await run('readonly', (s) => s.getAllKeys());
  for (const key of keys) {
    const item = await run('readonly', (s) => s.get(key));
    if (!item || item.createdAt < old) await run('readwrite', (s) => s.delete(key));
  }
  await run('readwrite', (s) => s.put({ ...value, createdAt: Date.now() }, id));
}
export const getCapture = (id) => run('readonly', (s) => s.get(id));
export const updateCapture = async (id, patch) => {
  const item = await getCapture(id);
  if (item) await run('readwrite', (s) => s.put({ ...item, ...patch }, id));
};
export const deleteCapture = (id) => run('readwrite', (s) => s.delete(id));
