// Reviewed configuration only. Never execute code or accept prompts from a page.
export const REGISTRY_URL = 'https://raw.githubusercontent.com/iOSDevSK/shot2ai/main/src/integration-registry.json';
const CACHE_MS = 15 * 60 * 1000;
const SCRIPT_ID = 'shot2ai-integrations';
const ALL_SITES = { origins: ['<all_urls>'] };
let loading;

export async function validateRegistry(value) {
  if (value?.schemaVersion !== 1 || !Array.isArray(value.integrations) || value.integrations.length > 500) throw new Error('Invalid website registry');
  const tags = new Set();
  for (const entry of value.integrations) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'prompt,tag,url' || typeof entry.prompt !== 'string' || !entry.prompt.trim() || entry.prompt.length > 8000) throw new Error('Invalid website registration');
    const url = new URL(entry.url);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.search || url.hash || url.href !== entry.url || !url.pathname.endsWith('/') || /[%*\\]/.test(entry.url) || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*[a-z0-9]$/.test(url.hostname)) throw new Error('Invalid website scope');
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(entry.url)))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (entry.tag !== `s2ai-${hash.slice(0, 16)}` || tags.has(entry.tag)) throw new Error('Invalid or duplicate website tag');
    tags.add(entry.tag);
  }
  return value;
}

export function matchesScope(scope, candidate) {
  try {
    const base = new URL(scope), url = new URL(candidate);
    if (url.username || url.password || url.origin !== base.origin) return false;
    // Decoding must not let an encoded slash or traversal escape a path scope.
    if (/%(?:2f|5c|2e)/i.test(url.pathname)) return false;
    return url.pathname === base.pathname.slice(0, -1) || url.pathname.startsWith(base.pathname);
  } catch { return false; }
}

export async function registry() {
  if (loading) return loading;
  loading = (async () => {
    const { integrationRegistry: cached } = await chrome.storage.local.get('integrationRegistry');
    let previous;
    try { previous = await validateRegistry(cached?.value); } catch { /* not a valid cache */ }
    if (previous && Number.isFinite(cached.at) && cached.at <= Date.now() && Date.now() - cached.at < CACHE_MS) return previous;
    try {
      const response = await fetch(REGISTRY_URL, { credentials: 'omit', cache: 'no-cache', redirect: 'error', signal: AbortSignal.timeout(5000) });
      if (!response.ok || Number(response.headers.get('content-length')) > 2_000_000) throw new Error('Registry unavailable');
      const text = await response.text();
      if (text.length > 2_000_000) throw new Error('Registry too large');
      const value = await validateRegistry(JSON.parse(text));
      await chrome.storage.local.set({ integrationRegistry: { at: Date.now(), value } });
      return value;
    } catch {
      const value = previous || await validateRegistry(await (await fetch(chrome.runtime.getURL('src/integration-registry.json'))).json());
      await chrome.storage.local.set({ integrationRegistry: { at: Date.now(), value } });
      return value;
    }
  })();
  try { return await loading; } finally { loading = null; }
}

export async function approvedIntegration(message, sender) {
  const { websiteIntegrations = false } = await chrome.storage.local.get('websiteIntegrations');
  if (!websiteIntegrations || !sender?.tab?.id || sender.frameId !== 0 || !await chrome.permissions.contains(ALL_SITES)) return null;
  if (typeof message.tag !== 'string' || !/^s2ai-[a-f0-9]{16}$/.test(message.tag)) return null;
  const entry = (await registry()).integrations.find(e => e.tag === message.tag);
  if (!entry || !matchesScope(entry.url, sender.url) || !matchesScope(entry.url, message.url || sender.url)) return null;
  const tab = await chrome.tabs.get(sender.tab.id).catch(() => null);
  if (!tab || tab.url !== sender.url) return null;
  const url = new URL(message.url || sender.url); url.hash = '';
  return { entry, tab, url: url.href };
}

let syncing = Promise.resolve();
export function syncIntegrations() {
  syncing = syncing.catch(() => {}).then(syncRegisteredIntegrations);
  return syncing;
}
async function syncRegisteredIntegrations() {
  const { websiteIntegrations = false } = await chrome.storage.local.get('websiteIntegrations');
  const allowed = await chrome.permissions.contains(ALL_SITES);
  if (websiteIntegrations && !allowed) await chrome.storage.local.set({ websiteIntegrations: false });
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [SCRIPT_ID] })).length > 0;
  const enabled = websiteIntegrations && allowed;
  if (enabled && !registered) await chrome.scripting.registerContentScripts([{ id: SCRIPT_ID, matches: ['http://*/*', 'https://*/*'], js: ['src/integration-content.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
  if (!enabled && registered) await chrome.scripting.unregisterContentScripts({ ids: [SCRIPT_ID] });
  return enabled;
}
