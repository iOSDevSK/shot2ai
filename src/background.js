// Capture flow: freeze the visible tab as an image, let the owner drag an
// area over it, crop that area at the screen's pixel density and show the
// quick preview card on the page. The card's actions (send, save, annotate)
// run here, since a content script cannot reach 127.0.0.1 or other tabs.
import { putCapture, getCapture, updateCapture, deleteCapture } from './captures.js';
import { sendToApp, outcomeText } from './bridge.js';
import { destinations, defaultDestination, settings, update, fileName, actionLabel, COPY_ONLY } from './settings.js';
import { saveImage, savedText } from './save.js';
import { pasteIntoChat } from './webchat.js';
import { icons } from './icons.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isMac = async () => (await chrome.runtime.getPlatformInfo()).os === 'mac';

async function startCapture(tabId) {
  const tab = tabId ? await chrome.tabs.get(tabId) : (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
  if (!tab?.id) throw new Error('There is no page to capture.');
  if (!tab.active) {
    await chrome.tabs.update(tab.id, { active: true });
    await wait(200);
  }
  let shot;
  try {
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    throw new Error('Chrome does not allow capturing this page. Open the page you want to report and try again.');
  }
  const id = crypto.randomUUID();
  await putCapture(id, { shot: await (await fetch(shot)).blob(), url: tab.url || '', title: tab.title || '', tabId: tab.id, tabIndex: tab.index });
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/overlay.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (captureId) => window.__shot2aiSelectArea(captureId), args: [id] });
  } catch {
    await deleteCapture(id);
    throw new Error('Chrome does not allow selecting an area on this page. Open the page you want to report and try again.');
  }
  return id;
}

async function cropSelection(id, rect, viewport) {
  const capture = await getCapture(id);
  if (!capture?.shot) return null;
  const bitmap = await createImageBitmap(capture.shot);
  // The capture is in device pixels; the selection is in CSS pixels.
  const scale = bitmap.width / viewport.width;
  const x = Math.max(0, Math.round(rect.x * scale));
  const y = Math.max(0, Math.round(rect.y * scale));
  const width = Math.min(bitmap.width - x, Math.round(rect.width * scale));
  const height = Math.min(bitmap.height - y, Math.round(rect.height * scale));
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').drawImage(bitmap, x, y, width, height, 0, 0, width, height);
  bitmap.close();
  const png = await canvas.convertToBlob({ type: 'image/png' });
  await updateCapture(id, { shot: null, png, width, height, scale });
  return { ...capture, png, scale };
}

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// The whole visible part of the page, as a capture of its own.
async function captureVisible(tab) {
  if (!tab.active) {
    await chrome.tabs.update(tab.id, { active: true });
    await wait(200);
  }
  let shot;
  try {
    shot = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
  } catch {
    throw new Error('Chrome does not allow capturing this page.');
  }
  const [{ result: viewport }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => ({ width: innerWidth, height: innerHeight }) });
  const png = await (await fetch(shot)).blob();
  const bitmap = await createImageBitmap(png);
  const capture = { png, width: bitmap.width, height: bitmap.height, scale: bitmap.width / viewport.width, url: tab.url || '', title: tab.title || '', tabId: tab.id, tabIndex: tab.index };
  bitmap.close();
  const id = crypto.randomUUID();
  await putCapture(id, capture);
  return { id, capture };
}

// An image on the page: fetched as it is, or, when the site does not allow
// that, cut out of a capture of the visible page.
async function captureImage(src, tab) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error();
    const bitmap = await createImageBitmap(await response.blob());
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    canvas.getContext('2d').drawImage(bitmap, 0, 0);
    bitmap.close();
    const png = await canvas.convertToBlob({ type: 'image/png' });
    const capture = { png, width: canvas.width, height: canvas.height, scale: 1, url: tab.url || '', title: tab.title || '', tabId: tab.id, tabIndex: tab.index };
    const id = crypto.randomUUID();
    await putCapture(id, capture);
    return { id, capture };
  } catch {
    const [{ result: rect }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (url) => {
        const img = [...document.images].find((i) => i.currentSrc === url || i.src === url);
        const r = img?.getBoundingClientRect();
        return r && r.width > 2 && r.height > 2 ? { x: Math.max(0, r.x), y: Math.max(0, r.y), width: Math.min(r.width, innerWidth - Math.max(0, r.x)), height: Math.min(r.height, innerHeight - Math.max(0, r.y)), viewport: { width: innerWidth } } : null;
      },
      args: [src],
    });
    const whole = await captureVisible(tab);
    if (!rect) return whole;
    const bitmap = await createImageBitmap(whole.capture.png);
    const k = bitmap.width / rect.viewport.width;
    const [x, y, w, h] = [rect.x, rect.y, rect.width, rect.height].map((v) => Math.round(v * k));
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d').drawImage(bitmap, x, y, w, h, 0, 0, w, h);
    bitmap.close();
    const png = await canvas.convertToBlob({ type: 'image/png' });
    const capture = { ...whole.capture, png, width: w, height: h };
    await updateCapture(whole.id, { png, width: w, height: h });
    return { id: whole.id, capture };
  }
}

// The quick preview card, in the page the area came from. `text` fills the
// message; `autoSend` sends at once, and the card only shows the result.
async function showCard(tabId, id, capture, { text = '', autoSend = false } = {}) {
  const s = await settings();
  const chosen = await defaultDestination();
  let saved = null;
  if (s.saveCopy) saved = await saveImage(capture.png, capture.url).then(savedText, () => 'The copy could not be saved.');
  const brief = (d) => ({ id: d.id, name: d.name, kind: d.kind, origin: d.origin || null, host: d.url ? new URL(d.url).host : null });
  const list = (await destinations()).map(brief);
  const main = { ...brief(chosen || COPY_ONLY), label: actionLabel(chosen) };
  const pick = ['close', 'check', 'send', 'chevron', 'annotate', 'copy', 'download', 'retry'];
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/card.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (o) => window.__shot2aiShowCard(o),
    args: [{ id, png: await base64(capture.png), scale: capture.scale, destinations: list, main, text, autoSend, acknowledged: s.acknowledged, saved, mod: (await isMac()) ? '⌘' : 'Ctrl+', icons: Object.fromEntries(pick.map((k) => [k, icons[k]])) }],
  });
}

export async function openEditor(id, near, text = '') {
  const capture = await getCapture(id);
  const query = new URLSearchParams({ id });
  if (text) query.set('text', text);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/editor.html?${query}`), ...(capture?.tabIndex !== undefined ? { index: capture.tabIndex + 1 } : {}), ...(near ? { openerTabId: near } : {}) });
}

async function cardSend(message) {
  const capture = await getCapture(message.id);
  if (!capture?.png) return { failed: true, text: 'This screenshot is no longer available. Capture the area again.' };
  const list = await destinations();
  const destination = list.find((d) => d.id === message.destination);
  if (!destination) return { failed: true, text: 'This destination is no longer set up.' };
  if (destination.kind === 'html2wp') {
    const outcome = await sendToApp(message.text, capture.png);
    return { ...outcome, text: outcomeText(outcome) };
  }
  if (message.acknowledge) {
    const { acknowledged } = await settings();
    await update({ acknowledged: { ...acknowledged, [message.acknowledge]: true } });
  }
  const s = await settings();
  return pasteIntoChat(destination, capture.png, message.text, fileName(s.filenamePattern, capture.url));
}

async function flagError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#985a4b' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

// ---- right-click menu ---------------------------------------------------

const CONTEXTS = ['page', 'selection', 'image', 'link'];
async function menuItems() {
  const [list, chosen] = await Promise.all([destinations(), defaultDestination()]);
  const to = { copy: ['Capture and copy', 'Copy this image'], save: ['Capture and save', 'Save this image'] }[chosen.kind]
    || [`Capture and send to ${chosen.name}`, `Send this image to ${chosen.name}`];
  const item = (id, title, extra = {}) => ({ id, parentId: 'shot2ai', contexts: CONTEXTS, ...(title ? { title } : {}), ...extra });
  return [
    { id: 'shot2ai', title: 'Shot2AI', contexts: CONTEXTS },
    item('capture-area', 'Capture area…'),
    item('capture-visible', 'Capture visible page'),
    item('sep-1', '', { type: 'separator' }),
    item('send-to', 'Send to'),
    ...list.map((d) => ({ id: `dest:${d.id}`, parentId: 'send-to', title: d.name, type: 'radio', checked: d.id === chosen.id, contexts: CONTEXTS })),
    item('capture-send', to[0]),
    item('send-image', to[1], { contexts: ['image'] }),
    item('send-selection', 'Send selection with a screenshot', { contexts: ['selection'] }),
    item('sep-2', '', { type: 'separator' }),
    item('options', 'Options'),
  ];
}
// One rebuild at a time, so ids never clash.
let building = Promise.resolve();
function rebuildMenu() {
  building = building.then(async () => {
    await chrome.contextMenus.removeAll();
    for (const entry of await menuItems()) chrome.contextMenus.create(entry, () => void chrome.runtime.lastError);
  }).catch(() => {});
  return building;
}
chrome.runtime.onInstalled.addListener(rebuildMenu);
chrome.runtime.onStartup.addListener(rebuildMenu);
chrome.storage.onChanged.addListener((changes) => {
  if (['defaultDestination', 'presets', 'customChats'].some((k) => k in changes)) rebuildMenu();
});

// A click on the menu grants activeTab for that tab, as the toolbar button does.
async function onMenuClick(info, tab) {
  const id = String(info.menuItemId);
  if (id === 'options') { await chrome.runtime.openOptionsPage(); return; }
  if (id.startsWith('dest:')) { await update({ defaultDestination: id.slice(5) }); return; }
  if (!tab?.id) return;
  if (id === 'capture-area') { await startCapture(tab.id); return; }
  if (id === 'send-image' && info.srcUrl) {
    const { id: captureId, capture } = await captureImage(info.srcUrl, tab);
    await showCard(tab.id, captureId, capture);
    return;
  }
  const { id: captureId, capture } = await captureVisible(tab);
  if (id === 'capture-visible') await showCard(tab.id, captureId, capture);
  if (id === 'capture-send') await showCard(tab.id, captureId, capture, { autoSend: true });
  if (id === 'send-selection') await showCard(tab.id, captureId, capture, { text: (info.selectionText || '').trim().slice(0, 2000) });
}
chrome.contextMenus.onClicked.addListener((info, tab) => { onMenuClick(info, tab).catch(flagError); });

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-area') startCapture(tab?.id).catch(flagError);
});

const handlers = {
  capture: (m) => startCapture(m.tabId).then((id) => ({ ok: true, id }), (e) => ({ error: e.message })),
  'card-send': cardSend,
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
