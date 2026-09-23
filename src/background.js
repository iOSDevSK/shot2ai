// Shot2AI's service worker: the toolbar button, shortcuts, right-click menu
// and the preview card's requests all arrive here. The card's actions run
// here, since a content script cannot reach 127.0.0.1 or other tabs.
import { deleteCapture, getCapture } from './captures.js';
import { startCapture, cropSelection } from './capture.js';
import { showCard, openEditor, cardSend, cardSendMany, flagError } from './flow.js';
import { rebuildMenu, onMenuClick } from './menu.js';
import { saveImage, savedText } from './save.js';

chrome.runtime.onInstalled.addListener(rebuildMenu);
chrome.runtime.onStartup.addListener(rebuildMenu);
chrome.storage.onChanged.addListener((changes) => {
  if (['defaultDestination', 'presets', 'customChats', 'prompts'].some((k) => k in changes)) rebuildMenu();
});
chrome.contextMenus.onClicked.addListener((info, tab) => { onMenuClick(info, tab).catch(flagError); });

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-area') startCapture(tab?.id).catch(flagError);
});

const handlers = {
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
