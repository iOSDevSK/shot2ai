// Captures live in the extension's own IndexedDB between the capture, the
// preview card and the editor tab. They leave this browser only when the
// owner sends, copies or saves them. The chosen save folder's handle is kept
// here too.
const DB = 'shot2ai-captures';
const STORE = 'captures';
const HANDLES = 'handles';
// Captures older than this are removed the next time one is saved.
const KEEP_MS = 24 * 60 * 60 * 1000;

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      for (const name of [STORE, HANDLES]) if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run(mode, action, store = STORE) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(store, mode);
      const req = action(tx.objectStore(store));
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
export const getHandle = (key) => run('readonly', (s) => s.get(key), HANDLES);
export const putHandle = (key, handle) => run('readwrite', (s) => s.put(handle, key), HANDLES);
export const deleteHandle = (key) => run('readwrite', (s) => s.delete(key), HANDLES);
// Every capture, with its id.
export async function allCaptures() {
  const [keys, values] = await Promise.all([run('readonly', (s) => s.getAllKeys()), run('readonly', (s) => s.getAll())]);
  return keys.map((id, index) => ({ ...values[index], id }));
}
