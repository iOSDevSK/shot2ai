// Pasting an image (a ⌘⇧4 or Win+Shift+S screenshot, say) into the popup or
// the options page opens it in the editor.
import { putCapture } from './captures.js';

export function acceptPastedImages(after = () => {}) {
  document.addEventListener('paste', async (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    const id = crypto.randomUUID();
    const png = file.type === 'image/png' ? file : await toPng(file);
    await putCapture(id, { png, scale: devicePixelRatio, url: '', title: 'Pasted image' });
    await chrome.tabs.create({ url: chrome.runtime.getURL(`src/editor.html?id=${id}`) });
    after();
  });
}

async function toPng(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  return canvas.convertToBlob({ type: 'image/png' });
}
