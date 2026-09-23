// Capturing: an area the owner drags, the whole visible page, or one image.
import { putCapture, getCapture, updateCapture, deleteCapture } from './captures.js';

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startCapture(tabId) {
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

export async function cropSelection(id, rect, viewport) {
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

// The whole visible part of the page, as a capture of its own.
export async function captureVisible(tab) {
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
export async function captureImage(src, tab) {
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
