// Shot2AI's service worker: the toolbar button, shortcuts, right-click menu
// and the preview card's requests all arrive here. The card's actions run
// here, since a content script cannot reach 127.0.0.1 or other tabs.
import { deleteCapture, getCapture } from './captures.js';
import { startCapture, cropSelection, captureSavedRegion, captureVisible } from './capture.js';
import { syncToolbar } from './toolbar-setup.js';
import { showCard, openEditor, cardSend, cardSendMany, rememberRegion, fullPageCard, flagError } from './flow.js';
import { cancelFullPage } from './fullpage.js';
import { rebuildMenu, onMenuClick } from './menu.js';
import { saveImage, savedText } from './save.js';

chrome.runtime.onInstalled.addListener(() => { rebuildMenu(); syncToolbar().catch(() => {}); });
chrome.runtime.onStartup.addListener(() => { rebuildMenu(); syncToolbar().catch(() => {}); });
// All-site access taken away in Chrome's settings: the toolbar goes too.
chrome.permissions.onRemoved.addListener(() => { syncToolbar().catch(() => {}); });
chrome.storage.onChanged.addListener((changes) => {
  if (['defaultDestination', 'presets', 'customChats', 'prompts'].some((k) => k in changes)) rebuildMenu();
});
chrome.contextMenus.onClicked.addListener((info, tab) => { onMenuClick(info, tab).catch(flagError); });

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-area') startCapture(tab?.id).catch(flagError);
  if (command === 'capture-saved' && tab) savedRegionCard(tab).catch(flagError);
  if (command === 'capture-full' && tab) fullPageCard(tab).catch(flagError);
});

async function savedRegionCard(tab) {
  const result = await captureSavedRegion(tab);
  if (result) await showCard(tab.id, result.id, result.capture);
}

const handlers = {
  'remember-region': rememberRegion,
  'full-page': async (m, sender) => {
    const tab = m.tabId ? await chrome.tabs.get(m.tabId) : sender.tab;
    if (!tab) return { failed: true };
    // Started from the popup: answer at once so it can close; the capture goes on.
    fullPageCard(tab).catch(flagError);
    return { ok: true };
  },
  'cancel-full-page': async (m, sender) => { if (sender.tab) cancelFullPage(sender.tab.id); return { ok: true }; },
  // The floating toolbar's buttons. It has all-site access, which is what lets it capture.
  toolbar: async (m, sender) => {
    const tab = sender.tab;
    if (!tab) return { failed: true };
    if (m.action === 'area') await startCapture(tab.id);
    if (m.action === 'visible') { const { id, capture } = await captureVisible(tab); await showCard(tab.id, id, capture); }
    if (m.action === 'saved') await savedRegionCard(tab);
    if (m.action === 'full') await fullPageCard(tab);
    return { ok: true };
  },
  'capture-saved': async (m, sender) => { await savedRegionCard(sender.tab); return { ok: true }; },
  capture: (m) => startCapture(m.tabId).then((id) => ({ ok: true, id }), (e) => ({ error: e.message })),
  'card-send': cardSend,
  'card-send-many': cardSendMany,
  annotate: async (m, sender) => { await openEditor(m.id, sender.tab?.id, m.text); return { ok: true }; },
  save: async (m) => {
    const capture = await getCapture(m.id);
    if (!capture?.png) return { text: 'This screenshot is no longer available.' };
    return saveImage(capture.png, capture.url).then((r) => ({ ok: true, text: savedText(r), ...r }), () => ({ text: 'The screenshot could not be saved.' }));
  },
  'open-options': async () => { await chrome.runtime.openOptionsPage(); return { ok: true }; },
};

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'area-selected' && sender.tab) {
    cropSelection(message.id, message.rect, message.viewport)
      .then((capture) => capture && showCard(sender.tab.id, message.id, capture))
      .catch(flagError);
    return false;
  }
  if (message?.type === 'area-cancelled') { deleteCapture(message.id).catch(() => {}); return false; }
  const handle = handlers[message?.type];
  if (!handle) return false;
  Promise.resolve(handle(message, sender)).then(reply, (e) => reply({ failed: true, text: e?.message || 'Something went wrong.' }));
  return true;
});
