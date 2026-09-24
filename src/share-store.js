import { captureSnapshot } from './share-snapshot.js';
// Keep export snapshots separate: older running capture workers still open schema 2.
// Clear all removes both databases.
const TTL = 60 * 60 * 1000;
async function store(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open('shot2ai-exports', 1);
    request.onupgradeneeded = () => { for (const name of ['exports']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try { return await new Promise((resolve, reject) => {
    const tx = db.transaction('exports', mode), request = action(tx.objectStore('exports'));
    tx.oncomplete = () => resolve(request?.result); tx.onerror = () => reject(tx.error);
  }); } finally { db.close(); }
}
export async function pruneExports() {
  await store('readwrite', s => { const cursor = s.openCursor(); cursor.onsuccess = () => { const c = cursor.result; if (!c) return; if (c.value.expires <= Date.now()) c.delete(); c.continue(); }; });
}
export async function putExport(capture) {
  await pruneExports();
  const id = crypto.randomUUID();
  // Save only the conversation being shared; omit drafts, tokens and private chat URLs.
  const value = captureSnapshot(capture);
  await store('readwrite', s => s.put({ expires: Date.now() + TTL, value }, id));
  return id;
}
export async function getExport(id) {
  await pruneExports();
  return (await store('readonly', s => s.get(id)))?.value;
}
