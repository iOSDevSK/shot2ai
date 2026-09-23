// The owner's choices, kept in chrome.storage.local, and the destinations a
// screenshot can go to. html2wp is always first and the default.
export const HTML2WP = { id: 'html2wp', name: 'html2wp', kind: 'html2wp' };
// Web chats with a known composer. Any other chat uses the generic finder.
export const PRESETS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', selectors: ['#prompt-textarea'] },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', selectors: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'] },
];
const DEFAULTS = {
  saveCopy: false,
  saveSubfolder: 'html2wp-shots',
  filenamePattern: 'html2wp-{host}-{date}-{time}',
  presets: {},
  customChats: [],
  lastDestination: 'html2wp',
  // Web chats the owner has been told receive the screenshot (by origin).
  acknowledged: {},
};

export async function settings() {
  return { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
}
export const update = (patch) => chrome.storage.local.set(patch);

export function origin(url) {
  try { return new URL(url).origin; } catch { return null; }
}
// The permission pattern for a chat's site (match patterns carry no port).
export function sitePattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

// html2wp, then the enabled presets, then the owner's own chats.
export async function destinations() {
  const s = await settings();
  const chats = [
    ...PRESETS.filter((p) => s.presets[p.id]).map((p) => ({ ...p, kind: 'chat' })),
    ...s.customChats.map((c) => ({ ...c, kind: 'chat', selectors: [] })),
  ];
  return [HTML2WP, ...chats.map((c) => ({ ...c, origin: origin(c.url) }))];
}
// The last destination used, while it still exists; otherwise html2wp.
export async function defaultDestination() {
  const [list, s] = await Promise.all([destinations(), settings()]);
  return list.find((d) => d.id === s.lastDestination) || HTML2WP;
}

const pad = (n) => String(n).padStart(2, '0');
// A file name from the owner's pattern: {host}, {date} (YYYY-MM-DD), {time} (HHMMSS).
export function fileName(pattern, pageUrl, when = new Date()) {
  let host = 'screenshot';
  try { host = new URL(pageUrl).hostname || host; } catch { /* pasted image or no page */ }
  const date = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  const time = `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  const name = (pattern || DEFAULTS.filenamePattern).replaceAll('{host}', host).replaceAll('{date}', date).replaceAll('{time}', time);
  return `${name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 120) || 'screenshot'}.png`;
}
export function cleanSubfolder(value) {
  return String(value || '').split(/[\\/]+/).map((p) => p.replace(/[:*?"<>|\u0000-\u001f]+/g, '-').trim()).filter((p) => p && p !== '.' && p !== '..').join('/');
}

// ⌘ on a Mac, Ctrl elsewhere.
export const isMac = /mac/i.test(globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? '');
export const modKey = isMac ? '⌘' : 'Ctrl+';
