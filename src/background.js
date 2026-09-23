// Capture flow: freeze the visible tab as an image, let the owner drag an
// area over it, crop that area at the screen's pixel density and open the
// editor tab with it.
import { putCapture, getCapture, updateCapture, deleteCapture } from './captures.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (captureId) => window.__html2wpSelectArea(captureId), args: [id] });
  } catch {
    await deleteCapture(id);
    throw new Error('Chrome does not allow selecting an area on this page. Open the page you want to report and try again.');
  }
  return id;
}

async function cropSelection(id, rect, viewport) {
  const capture = await getCapture(id);
  if (!capture?.shot) return;
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
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/editor.html?id=${encodeURIComponent(id)}`), index: capture.tabIndex + 1, openerTabId: capture.tabId });
}

async function flagError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#985a4b' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}

chrome.commands.onCommand.addListener((command, tab) => {
  if (command === 'capture-area') startCapture(tab?.id).catch(flagError);
});

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type === 'capture') {
    startCapture(message.tabId).then((id) => reply({ ok: true, id }), (e) => reply({ error: e.message }));
    return true;
  }
  if (message?.type === 'area-selected' && sender.tab) {
    cropSelection(message.id, message.rect, message.viewport).catch(flagError);
  }
  if (message?.type === 'area-cancelled') deleteCapture(message.id).catch(() => {});
  return false;
});
