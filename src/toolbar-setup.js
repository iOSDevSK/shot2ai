// Registering the floating toolbar's content script. It runs on every page,
// so it needs access to all sites; that is asked for only when the owner
// switches the toolbar on, and dropped when they switch it off.
const ID = 'shot2ai-toolbar';
export const ALL_SITES = { origins: ['<all_urls>'] };

// Registered exactly while the toolbar is on and all-site access is granted.
export async function syncToolbar() {
  const { toolbar } = await chrome.storage.local.get('toolbar');
  const allowed = await chrome.permissions.contains(ALL_SITES);
  const registered = (await chrome.scripting.getRegisteredContentScripts({ ids: [ID] })).length > 0;
  const wanted = !!toolbar?.enabled && allowed;
  if (wanted && !registered) {
    await chrome.scripting.registerContentScripts([{ id: ID, matches: ['http://*/*', 'https://*/*'], js: ['src/toolbar.js'], runAt: 'document_idle', persistAcrossSessions: true }]);
  }
  if (!wanted && registered) await chrome.scripting.unregisterContentScripts({ ids: [ID] });
  return wanted;
}
