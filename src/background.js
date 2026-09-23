// Capture flow: freeze the visible tab as an image, let the owner drag an
// area over it, crop that area at the screen's pixel density and show the
// quick preview card on the page. The card's actions (send, save, annotate)
// run here, since a content script cannot reach 127.0.0.1 or other tabs.
import { putCapture, getCapture, updateCapture, deleteCapture } from './captures.js';
import { sendToApp, outcomeText } from './bridge.js';
import { destinations, defaultDestination, settings, update, fileName } from './settings.js';
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

// The quick preview card, in the page the area came from.
async function showCard(tabId, id, capture) {
  const s = await settings();
  let saved = null;
  if (s.saveCopy) saved = await saveImage(capture.png, capture.url).then(savedText, () => 'The copy could not be saved.');
  const list = (await destinations()).map((d) => ({ id: d.id, name: d.name, kind: d.kind, origin: d.origin || null, host: d.url ? new URL(d.url).host : null }));
  const current = (await defaultDestination()).id;
  const pick = ['close', 'check', 'send', 'chevron', 'annotate', 'copy', 'download', 'retry'];
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/card.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (o) => window.__shot2aiShowCard(o),
    args: [{ id, png: await base64(capture.png), scale: capture.scale, destinations: list, current, acknowledged: s.acknowledged, saved, mod: (await isMac()) ? '⌘' : 'Ctrl+', icons: Object.fromEntries(pick.map((k) => [k, icons[k]])) }],
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
    if (outcome.ok) await update({ lastDestination: 'html2wp' });
    return { ...outcome, text: outcomeText(outcome) };
  }
  if (message.acknowledge) {
    const { acknowledged } = await settings();
    await update({ acknowledged: { ...acknowledged, [message.acknowledge]: true } });
  }
  const s = await settings();
  const result = await pasteIntoChat(destination, capture.png, message.text, fileName(s.filenamePattern, capture.url));
  if (result.ok) await update({ lastDestination: destination.id });
  return result;
}

async function flagError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#985a4b' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

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
