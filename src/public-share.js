import { authorizeSharing } from './share-auth.js';
import { captureSnapshot } from './share-snapshot.js';
import { SHARE_ORIGIN } from './share-config.js';
import { makeSharePreview } from './share-preview.js';

const PREFIX = 'publicShare:';
const pending = new Map();
export function validateShareURL(value) {
  try {
    const url = new URL(value);
    return url.origin === SHARE_ORIGIN && /^\/s\/[A-Za-z0-9_-]{32}$/.test(url.pathname) && !url.search && !url.hash && !url.username && !url.password;
  } catch { return false; }
}
export async function sharedLinks() {
  const entries = Object.entries(await chrome.storage.local.get(null)).filter(([key]) => key.startsWith(PREFIX));
  const expired = entries.filter(([, v]) => v.expiresAt <= Date.now()).map(([k]) => k);
  if (expired.length) await chrome.storage.local.remove(expired);
  return entries.filter(([, v]) => v.expiresAt > Date.now()).map(([key, value]) => ({ key, ...value })).sort((a, b) => b.createdAt - a.createdAt);
}
async function base64(blob) {
  const data = new Uint8Array(await blob.arrayBuffer()); let value = '';
  for (let i = 0; i < data.length; i += 32768) value += String.fromCharCode(...data.subarray(i, i + 32768));
  return btoa(value);
}
async function request(path, init) {
  if (!SHARE_ORIGIN) throw new Error('Public sharing is not configured yet. PDF and Markdown are available.');
  let response;
  try { response = await fetch(`${SHARE_ORIGIN}${path}`, { ...init, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(25_000) }); }
  catch { throw new Error('The sharing server could not be reached. Try again when connected.'); }
  if (!response.ok) {
    if (response.status === 401) { const error = new Error('Sharing verification expired.'); error.status = 401; throw error; }
    if (response.status === 507) throw new Error('A sharing storage limit was reached. Delete old shared links in Settings, or use PDF or Markdown.');
    if (response.status === 413) throw new Error('This conversation is too large to share. Use PDF or Markdown.');
    if (response.status === 429) throw new Error('Too many shared links. Try again later.');
    throw new Error('The sharing server could not complete the request. Try again later.');
  }
  return response;
}
export async function publishCapture(capture) {
  if (!SHARE_ORIGIN) throw new Error('Public sharing is not configured yet. PDF and Markdown are available.');
  const snapshot = captureSnapshot(capture);
  if (snapshot.kind !== 'text' && !(snapshot.png instanceof Blob)) throw new Error('The original image is no longer available.');
  if (snapshot.png?.size > 8 * 1024 * 1024) throw new Error('This image is too large to share. Use PDF or Markdown.');
  const preview = await makeSharePreview(snapshot);
  const body = JSON.stringify({ ...snapshot, png: snapshot.kind === 'text' ? null : await base64(snapshot.png), preview: await base64(preview) });
  if (new TextEncoder().encode(body).length > 12 * 1024 * 1024) throw new Error('This conversation is too large to share. Use PDF or Markdown.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body)))].map(n => n.toString(16).padStart(2, '0')).join('');
  const key = PREFIX + digest;
  if (pending.has(key)) return pending.get(key);
  const work = (async () => {
    const existing = (await chrome.storage.local.get(key))[key];
    if (existing?.expiresAt > Date.now() + 60_000 && validateShareURL(existing.url)) return existing;
    let response;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await authorizeSharing(attempt > 0);
      try { response = await request('/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body }); break; }
      catch (error) { if (error.status !== 401 || attempt) throw error; }
    }
    const result = await response.json();
    if (!validateShareURL(result.url) || !/^[A-Za-z0-9_-]{43}$/.test(result.deleteToken) || !Number.isFinite(result.expiresAt) || result.expiresAt <= Date.now()) throw new Error('The sharing server returned an invalid link.');
    const record = { url: result.url, deleteToken: result.deleteToken, expiresAt: result.expiresAt, createdAt: Date.now(), title: snapshot.turns[0]?.asked.slice(0, 160) || 'Shot2AI conversation' };
    await chrome.storage.local.set({ [key]: record });
    return record;
  })();
  pending.set(key, work);
  try { return await work; } finally { pending.delete(key); }
}
export async function deleteSharedLink(key) {
  if (!key.startsWith(PREFIX)) throw new Error('Invalid shared link.');
  const record = (await chrome.storage.local.get(key))[key];
  if (!record) return;
  if (!validateShareURL(record.url)) throw new Error('Unknown sharing server.');
  if (record.expiresAt > Date.now()) {
    // A missing link is already deleted; preserve the key on other failures for retry.
    const response = await fetch(`${SHARE_ORIGIN}/api/shares/${new URL(record.url).pathname.split('/').at(-1)}`, { method: 'DELETE', headers: { Authorization: `Bearer ${record.deleteToken}` }, credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', signal: AbortSignal.timeout(25_000) });
    if (!response.ok && response.status !== 404) throw new Error('The shared link could not be deleted. Try again later.');
  }
  await chrome.storage.local.remove(key);
}
export function socialURL(format, url) {
  if (!validateShareURL(url)) throw new Error('Invalid shared link.');
  if (format === 'whatsapp') return `whatsapp://send?text=${encodeURIComponent(url)}`;
  if (format === 'facebook') return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  if (format === 'x') return `https://x.com/intent/post?url=${encodeURIComponent(url)}`;
  throw new Error('Unknown sharing destination.');
}
