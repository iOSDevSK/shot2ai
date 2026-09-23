// Shot2AI settings: the owner's choices, kept in chrome.storage.local, and the
// destinations a screenshot can go to. ChatGPT is the default out of the box;
// the owner can choose another in Options.
export const HTML2WP = { id: 'html2wp', name: 'html2wp', kind: 'html2wp' };
export const SAVE_ONLY = { id: 'save', name: 'Save only', kind: 'save' };
export const COPY_ONLY = { id: 'copy', name: 'Copy only', kind: 'copy' };
// Web chats with a known composer. Any other chat uses the generic finder.
export const PRESETS = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/', selectors: ['#prompt-textarea'] },
  { id: 'claude', name: 'Claude', url: 'https://claude.ai/new', selectors: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'] },
];
const DEFAULTS = {
  saveCopy: false,
  saveSubfolder: 'shot2ai',
  // Sends to web chats and saves: 'png' (lossless), 'jpeg' or 'webp' at imageQuality %.
  imageFormat: 'png',
  imageQuality: 90,
  filenamePattern: 'shot2ai-{host}-{date}-{time}',
  presets: {},
  customChats: [],
  // The destination the card's main button uses.
  defaultDestination: 'chatgpt',
  // Destinations ticked for "Send to all selected".
  multiSend: [],
  // The prompt that fills the message of every new capture, or null.
  defaultPrompt: null,
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

const chat = (c) => ({ ...c, kind: 'chat', selectors: c.selectors || [], origin: origin(c.url) });
export const FIRST_DEFAULT = 'chatgpt';

// Saved prompts. These four are there on first use; the owner may edit or delete them.
export const BUILTIN_PROMPTS = [
  { id: 'fix-bug', name: 'Fix this bug', text: 'This screenshot shows a bug. Find the cause and fix it.' },
  { id: 'explain', name: 'Explain this', text: 'Explain what this screenshot shows.' },
  { id: 'match-design', name: 'Match this design', text: 'Make my implementation match the design in this screenshot. List the differences first, then fix them.' },
  { id: 'whats-wrong', name: "What's wrong here?", text: 'What looks wrong in this screenshot? List the problems, the most important first.' },
];
// The owner's prompts, in their order. Seeded once, so a deleted built-in stays deleted.
export async function prompts() {
  const { prompts: saved } = await chrome.storage.local.get('prompts');
  if (Array.isArray(saved)) return saved;
  await update({ prompts: BUILTIN_PROMPTS });
  return BUILTIN_PROMPTS;
}
// The text of the default prompt, or '' when none is set.
export async function defaultPromptText() {
  const [list, s] = await Promise.all([prompts(), settings()]);
  return list.find((p) => p.id === s.defaultPrompt)?.text || '';
}
// Everything the owner can choose as the default: ChatGPT, Claude, html2wp,
// their own chats, then Copy only and Save only.
export async function choices() {
  const s = await settings();
  return [...PRESETS.map(chat), HTML2WP, ...s.customChats.map(chat), COPY_ONLY, SAVE_ONLY];
}
// The send menu: the preset chats the owner turned on or chose, html2wp,
// then their own chats.
export async function destinations() {
  const s = await settings();
  const on = (p) => s.presets[p.id] || s.defaultDestination === p.id;
  return [...PRESETS.filter(on).map(chat), HTML2WP, ...s.customChats.map(chat)];
}
// The default destination; ChatGPT unless the owner chose another.
export async function defaultDestination() {
  const s = await settings();
  const list = await choices();
  return list.find((d) => d.id === s.defaultDestination) || list.find((d) => d.id === FIRST_DEFAULT);
}
// The main button's words: "Send to ChatGPT", "Save", or "Copy" when nothing is chosen.
export function actionLabel(destination) {
  if (!destination || destination.kind === 'copy') return 'Copy';
  if (destination.kind === 'save') return 'Save';
  return `Send to ${destination.name}`;
}

const pad = (n) => String(n).padStart(2, '0');
// A file name from the owner's pattern: {host}, {date} (YYYY-MM-DD), {time} (HHMMSS).
export function fileName(pattern, pageUrl, when = new Date(), ext = 'png') {
  let host = 'screenshot';
  try { host = new URL(pageUrl).hostname || host; } catch { /* pasted image or no page */ }
  const date = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
  const time = `${pad(when.getHours())}${pad(when.getMinutes())}${pad(when.getSeconds())}`;
  const name = (pattern || DEFAULTS.filenamePattern).replaceAll('{host}', host).replaceAll('{date}', date).replaceAll('{time}', time);
  return `${name.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[.\s-]+|[.\s]+$/g, '').slice(0, 120) || 'screenshot'}.${ext}`;
}
export function cleanSubfolder(value) {
  return String(value || '').split(/[\\/]+/).map((p) => p.replace(/[:*?"<>|\u0000-\u001f]+/g, '-').trim()).filter((p) => p && p !== '.' && p !== '..').join('/');
}

// ⌘ on a Mac, Ctrl elsewhere.
export const isMac = /mac/i.test(globalThis.navigator?.userAgentData?.platform ?? globalThis.navigator?.platform ?? '');
export const modKey = isMac ? '⌘' : 'Ctrl+';
