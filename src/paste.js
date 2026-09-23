// Pasting an image (a ⌘⇧4 or Win+Shift+S screenshot, say) into the popup or
// the options page opens it in the editor.
import { putCapture } from './captures.js';

// With a tab (the popup's), the image joins that tab's capture stack; otherwise,
// or when the tab cannot show the card, it opens in the editor.
export function acceptPastedImages(after = () => {}, tabId = null) {
  document.addEventListener('paste', async (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    const png = file.type === 'image/png' ? file : await toPng(file);
    if (tabId) {
      const bytes = new Uint8Array(await png.arrayBuffer());
      let text = '';
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      const r = await chrome.runtime.sendMessage({ type: 'import-image', tabId, png: btoa(text), scale: devicePixelRatio }).catch(() => null);
      if (r?.ok) { after(); return; }
    }
    const id = crypto.randomUUID();
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
