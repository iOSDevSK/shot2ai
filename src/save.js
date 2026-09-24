// Saving a copy: into the folder the owner chose (File System Access), or,
// when none is chosen or its access has lapsed, into a subfolder of
// Downloads through chrome.downloads.
import { getHandle } from './captures.js';
import { settings, fileName, cleanSubfolder } from './settings.js';
import { encode, EXTENSIONS } from './imaging.js';

export const FOLDER = 'save-folder';

async function toDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return `data:${blob.type || 'image/png'};base64,${btoa(text)}`;
}

// { granted, name } for the chosen folder, or null when there is none.
// `ask` may prompt, and only works in a page during a click.
export async function folderAccess(ask = false) {
  const handle = await getHandle(FOLDER).catch(() => null);
  if (!handle) return null;
  let state = await handle.queryPermission({ mode: 'readwrite' });
  if (state !== 'granted' && ask) state = await handle.requestPermission({ mode: 'readwrite' }).catch(() => 'denied');
  return { handle, name: handle.name, granted: state === 'granted' };
}

async function unique(dir, name) {
  const dot = name.lastIndexOf('.');
  const [stem, ext] = [name.slice(0, dot), name.slice(dot)];
  for (let i = 0; i < 100; i++) {
    const candidate = i ? `${stem} (${i})${ext}` : name;
    try { await dir.getFileHandle(candidate); } catch { return candidate; }
  }
  return `${stem}-${Date.now()}${ext}`;
}

// Saved in the owner's image format. Returns { where: 'folder'|'downloads', path, lapsed? }.
export async function saveImage(png, pageUrl, { ask = false } = {}) {
  const s = await settings();
  const blob = await encode(png, s);
  const name = fileName(s.filenamePattern, pageUrl, new Date(), EXTENSIONS[blob.type] || 'png');
  return saveBlob(blob, name, s, ask);
}

export async function saveText(text, pageUrl) {
  const s = await settings();
  return saveBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName(s.filenamePattern, pageUrl, new Date(), 'txt'), s, false);
}

async function saveBlob(blob, name, s, ask) {
  const folder = await folderAccess(ask);
  if (folder?.granted) {
    try {
      const file = await folder.handle.getFileHandle(await unique(folder.handle, name), { create: true });
      const out = await file.createWritable();
      await out.write(blob);
      await out.close();
      return { where: 'folder', path: `${folder.name}/${file.name}` };
    } catch { /* fall through to Downloads */ }
  }
  const sub = cleanSubfolder(s.saveSubfolder);
  const path = sub ? `${sub}/${name}` : name;
  const id = await chrome.downloads.download({ url: await toDataUrl(blob), filename: path, conflictAction: 'uniquify', saveAs: false });
  return { where: 'downloads', path: `Downloads/${path}`, id, lapsed: !!folder && !folder.granted };
}

export function savedText(result) {
  if (result.where === 'folder') return `Saved to ${result.path}`;
  return result.lapsed ? `Saved to ${result.path}. Allow the chosen folder again in Options.` : `Saved to ${result.path}`;
}
