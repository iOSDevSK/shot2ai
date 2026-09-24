// Shot2AI's service worker: the toolbar button, shortcuts, right-click menu
// and the preview card's requests all arrive here. The card's actions run
// here, since a content script cannot reach 127.0.0.1 or other tabs.
import { deleteCapture, getCapture, updateCapture, putCapture } from './captures.js';
import { startCapture, cropSelection, captureSavedRegion, captureVisible } from './capture.js';
import { syncToolbar } from './toolbar-setup.js';
import { showCard, showStack, sendCaptures, openEditor, cardSend, cardSendMany, rememberRegion, fullPageCard, flagError } from './flow.js';
import { stackFor, clearStack, hideStack, stackHidden } from './stack.js';
import { cancelFullPage } from './fullpage.js';
import { rebuildMenu, onMenuClick } from './menu.js';
import { saveImage, savedText } from './save.js';
import { stopAnswer, stopAnswersFor } from './answer.js';
import { openChatTab } from './webchat.js';
import { choices, PRESETS, origin } from './settings.js';

chrome.runtime.onInstalled.addListener((details) => {
  rebuildMenu();
  syncToolbar().catch(() => {});
  // Up from 0.3 or older, where ChatGPT and Claude only pasted: the first send
  // to each says once more that it now goes automatically.
  if (details.reason === 'update' && /^0\.[0-3]\./.test(details.previousVersion || '')) {
    chrome.storage.local.get('acknowledged').then(({ acknowledged = {} }) => {
      for (const p of PRESETS) delete acknowledged[origin(p.url)];
      return chrome.storage.local.set({ acknowledged });
    }).catch(() => {});
  }
});
chrome.runtime.onStartup.addListener(() => { rebuildMenu(); syncToolbar().catch(() => {}); });
// All-site access taken away in Chrome's settings: the toolbar goes too.
chrome.permissions.onRemoved.addListener(() => { syncToolbar().catch(() => {}); });
chrome.storage.onChanged.addListener((changes) => {
  if (['defaultDestination', 'presets', 'customChats', 'prompts'].some((k) => k in changes)) rebuildMenu();
});
// Keys changed at chrome://extensions/shortcuts: the menu titles follow.
chrome.commands.onChanged?.addListener(() => rebuildMenu());
chrome.contextMenus.onClicked.addListener((info, tab) => { onMenuClick(info, tab).catch(flagError); });

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-area') startCapture(tab?.id).catch(flagError);
  if (command === 'capture-saved' && tab) savedRegionCard(tab).catch(flagError);
  if (command === 'capture-full' && tab) fullPageCard(tab).catch(flagError);
  if (command === 'capture-visible' && tab) captureVisible(tab).then(({ id, capture }) => showCard(tab.id, id, capture)).catch(flagError);
  if (command === 'show-stack' && tab) showStack(tab.id).catch(flagError);
});

async function savedRegionCard(tab) {
  const result = await captureSavedRegion(tab);
  if (result) await showCard(tab.id, result.id, result.capture);
}

async function png64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// The stack survives navigation within the tab: it comes back once the new
// page has loaded (where Shot2AI may draw on it), unless it was put away.
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.status !== 'complete' || stackHidden(tabId)) return;
  stackFor(tabId).then((list) => { if (list.some((c) => !c.sent || c.answer)) return showStack(tabId); return null; }).catch(() => {});
});
chrome.tabs.onRemoved.addListener((tabId) => { stopAnswersFor(tabId); clearStack(tabId).catch(() => {}); });

const handlers = {
  // The card keeps each capture's message, result and state here.
  'stack-update': async (m) => {
    const allowed = ['message', 'result', 'sent', 'selected', 'saved'];
    await updateCapture(m.id, Object.fromEntries(Object.entries(m.patch || {}).filter(([k]) => allowed.includes(k))));
    return { ok: true };
  },
  'stack-remove': async (m) => { stopAnswer(m.id); await deleteCapture(m.id); return { ok: true }; },
  'stack-clear': async (m, sender) => { if (sender.tab) { stopAnswersFor(sender.tab.id); await clearStack(sender.tab.id); } return { ok: true }; },
  'stack-hide': async (m, sender) => { if (sender.tab) hideStack(sender.tab.id); return { ok: true }; },
  'stack-png': async (m) => { const c = await getCapture(m.id); return c?.png ? { png: await png64(c.png) } : {}; },
  'show-stack': async (m) => ({ ok: await showStack(m.tabId) }),
  'stack-count': async (m) => ({ count: (await stackFor(m.tabId)).filter((c) => !c.sent || c.answer).length }),
  'send-captures': sendCaptures,
  // A pasted image (from the popup) joins the tab's stack like a capture.
  'import-image': async (m) => {
    const tab = await chrome.tabs.get(m.tabId).catch(() => null);
    if (!tab) return { ok: false };
    const png = new Blob([Uint8Array.from(atob(m.png), (c) => c.charCodeAt(0))], { type: 'image/png' });
    const bitmap = await createImageBitmap(png);
    const capture = { png, width: bitmap.width, height: bitmap.height, scale: m.scale || 1, url: tab.url || '', title: 'Pasted image', tabId: tab.id, tabIndex: tab.index, kind: 'pasted' };
    bitmap.close();
    const id = crypto.randomUUID();
    await putCapture(id, capture);
    try { await showCard(tab.id, id, capture); return { ok: true }; } catch { await deleteCapture(id); return { ok: false }; }
  },
  'remember-region': rememberRegion,
  'rebuild-menu': async () => { await rebuildMenu(); return { ok: true }; },
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
  // "Open Claude tab", "Continue in Claude".
  'open-chat': async (m) => { await openChatTab(m.tabId, (await choices()).find((d) => d.id === m.destination)?.url); return { ok: true }; },
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
