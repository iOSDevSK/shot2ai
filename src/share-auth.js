import { SHARE_ORIGIN } from './share-config.js';
const KEY = 'shareAuthorization', PENDING = 'shareAuthorizationPending';
// A human challenge may outlive the initial send. Keep its nonce usable for
// ten minutes, but keep each extension message below Chrome's five-minute cap.
const REQUEST_TTL = 10 * 60_000, WAIT_TTL = 4 * 60_000, CLOCK_SKEW = 5 * 60_000;
let flight;
function valid(value) {
  return value?.origin === SHARE_ORIGIN && /^v1\.[A-Za-z0-9_-]{43}\.\d{13}\.[A-Za-z0-9_-]{43}$/.test(value.token || '') && value.expiresAt > Date.now() + 60_000;
}
export async function authorizeSharing(force = false) {
  if (force) await chrome.storage.local.remove(KEY);
  const cached = (await chrome.storage.local.get(KEY))[KEY];
  if (valid(cached)) return cached.token;
  if (flight) return flight;
  flight = (async () => {
    const nonce = crypto.randomUUID(), expiresAt = Date.now() + REQUEST_TTL;
    const waitUntil = Date.now() + WAIT_TTL; let discard = false;
    // Create a blank owned tab first: even a very fast callback must be matched
    // against its stored tab id before it can save a credential.
    const tab = await chrome.tabs.create({ url: 'about:blank', active: true });
    await chrome.storage.local.set({ [PENDING]: { nonce, tabId: tab.id, expiresAt } });
    try {
      await chrome.tabs.update(tab.id, { url: `${SHARE_ORIGIN}/connect?extension=${chrome.runtime.id}&nonce=${nonce}` });
      while (Date.now() < waitUntil) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const value = (await chrome.storage.local.get(KEY))[KEY];
        if (valid(value)) return value.token;
        try { await chrome.tabs.get(tab.id); } catch {
          // The callback stores the credential and closes its tab. It can land
          // between the storage read above and this tab lookup.
          const completed = (await chrome.storage.local.get(KEY))[KEY];
          if (valid(completed)) return completed.token;
          discard = true; throw new Error('Sharing verification was closed. Choose Share again to retry.');
        }
      }
      throw new Error('Verification is still pending. Finish it in the verification tab, then choose Share again.');
    } finally {
      const current = (await chrome.storage.local.get(PENDING))[PENDING];
      if (current?.nonce === nonce && (discard || current.expiresAt <= Date.now())) await chrome.storage.local.remove(PENDING);
    }
  })();
  try { return await flight; } finally { flight = null; }
}
export async function acceptShareAuthorization(message, sender) {
  if (message?.type !== 'share-authorized') return { ok: false };
  let url; try { url = new URL(sender.url); } catch { return { ok: false }; }
  const pending = (await chrome.storage.local.get(PENDING))[PENDING];
  if (url.origin !== SHARE_ORIGIN || url.pathname !== '/connect' || sender.frameId !== 0) return { ok: false, reason: 'untrusted-sender' };
  if (!pending) return { ok: false, reason: 'request-missing' };
  if (pending.nonce !== message.nonce || pending.tabId !== sender.tab?.id) return { ok: false, reason: 'request-mismatch' };
  if (pending.expiresAt <= Date.now()) return { ok: false, reason: 'request-expired' };
  const value = { ...message.authorization, origin: SHARE_ORIGIN };
  // Expiry is signed by the server, whose clock need not equal the desktop's.
  // A small tolerance avoids rejecting a newly issued, valid 30-day credential.
  if (!valid(value) || value.expiresAt > Date.now() + 30 * 86400_000 + CLOCK_SKEW || Number(value.token.split('.')[2]) !== value.expiresAt) return { ok: false, reason: 'authorization-invalid' };
  await chrome.storage.local.set({ [KEY]: { origin: SHARE_ORIGIN, token: value.token, expiresAt: value.expiresAt } });
  await chrome.storage.local.remove(PENDING);
  return { ok: true };
}
