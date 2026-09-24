// Shot2AI settings: the owner's choices, kept in chrome.storage.local, and the
// destinations a screenshot can go to. ChatGPT is the default out of the box;
// the owner can choose another in Options.
export const HTML2WP = { id: 'html2wp', name: 'html2wp', kind: 'html2wp' };
export const SAVE_ONLY = { id: 'save', name: 'Save only', kind: 'save' };
export const COPY_ONLY = { id: 'copy', name: 'Copy only', kind: 'copy' };
// Web chats with a known composer. Any other chat uses the generic finder.
// For ChatGPT and Claude Shot2AI also knows the stop button (shown while the
// chat answers), the owner's messages and the chat's answers, so it can
// confirm a send and read the answer back. These follow the sites' pages as
// they are and may need updating when a site changes; every one has a
// fallback, and a send that cannot be confirmed says so in the card.
export const PRESETS = [
  {
    id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com/',
    selectors: ['#prompt-textarea', 'div[contenteditable="true"].ProseMirror'],
    sendSelectors: ['button[data-testid="send-button"]', '#composer-submit-button', 'button[aria-label="Send prompt"]'],
    stopSelectors: ['button[data-testid="stop-button"]', 'button[aria-label="Stop streaming"]', 'button[aria-label^="Stop" i]'],
    userSelectors: ['[data-message-author-role="user"]'],
    answerSelectors: ['[data-message-author-role="assistant"]'],
    contentSelectors: ['.markdown'],
    streamingSelectors: ['.result-streaming'],
  },
  {
    id: 'claude', name: 'Claude', url: 'https://claude.ai/new',
    selectors: ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
    sendSelectors: ['button[aria-label="Send message"]', 'button[aria-label="Send Message"]'],
    stopSelectors: ['button[aria-label="Stop response"]', 'button[aria-label^="Stop" i]'],
    userSelectors: ['[data-testid="user-message"]'],
    answerSelectors: ['[data-is-streaming]', '.font-claude-response', '.font-claude-message'],
    contentSelectors: ['.font-claude-response', '.font-claude-message', '.standard-markdown', '.progressive-markdown'],
    streamingSelectors: ['[data-is-streaming="true"]'],
  },
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
  // Web chats whose send button Shot2AI presses after pasting (by id): on
  // for ChatGPT and Claude, off for the owner's own chats, unless changed.
  autoSubmit: {},
  // The owner has read the terms notice for Send automatically (shown once).
  autoSubmitTermsAck: false,
  // The floating toolbar: off unless switched on in Options.
  toolbar: { enabled: false, collapsed: false },
  toolbarHidden: {},
  toolbarPos: {},
  // Full-page capture stops at this height (CSS px), 5,000–50,000.
  fullPageMaxHeight: 20000,
  // Remembered capture regions by site origin, as fractions of the viewport.
  regions: {},
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

// Send automatically: ChatGPT and Claude unless the owner turned it off,
// their own chats only when turned on.
export const autoSubmitOn = (s, id) => s.autoSubmit?.[id] ?? PRESETS.some((p) => p.id === id);
// The chats whose answer Shot2AI can read back into the card.
export const readsAnswers = (d) => !!d?.answerSelectors?.length;

// What the card or the editor says after a web-chat send, and whether it
// offers the chat's tab. Anything short of a confirmed send says what is
// left to do: `open` offers the tab, `retry` a second try.
export function chatOutcome(name, r) {
  if (r.submitted) return { tone: 'ok', text: `Sent to ${name}.` };
  switch (r.reason) {
    case 'noComposer': return { tone: 'warn', open: true, text: `${name}'s message box was not found, so nothing was sent. Are you signed in there?` };
    case 'busy': return { tone: 'warn', open: true, retry: true, text: `${name} is still answering in its tab, so nothing was sent. Send again when it finishes.` };
    case 'noText': return { tone: 'warn', open: true, text: `${name} took the screenshot but not your message, so nothing was sent. Finish it in the ${name} tab.` };
    case 'uploadFailed': return { tone: 'warn', open: true, text: `The screenshot did not upload to ${name}, so nothing was sent. See the ${name} tab.` };
    case 'noSendButton': return { tone: 'warn', open: true, text: `Pasted into ${name}. Its send button was not found; press Enter there.` };
    case 'notConfirmed': return { tone: 'warn', open: true, text: `Shot2AI pressed Send in ${name} but could not confirm it went. Check the ${name} tab.` };
    default: break;
  }
  if (r.ok) return { tone: 'ok', text: `Pasted into ${name}. Press Enter there to send.` };
  return null;
}
export const chatResultText = (name, r) => chatOutcome(name, r)?.text || '';
// The first-use notice for a web chat.
export function websiteNotice(names, hosts, many, auto, answers = false) {
  const sent = auto ? ` and will be sent automatically, without you reviewing ${many ? 'them' : 'it'}${answers ? '; the answer then shows here' : ''}. Some services restrict automated use in their terms; turn Send automatically off in Options to review first` : '';
  return `${names} ${many ? 'are websites' : 'is a website'}. The screenshot and message will go to ${hosts}, not only to this Mac${sent ? `,${sent}` : ''}.`;
}

export function origin(url) {
  try { return new URL(url).origin; } catch { return null; }
}
// The permission pattern for a chat's site (match patterns carry no port).
export function sitePattern(url) {
  const u = new URL(url);
  return `${u.protocol}//${u.hostname}/*`;
}

const chat = (c) => ({ ...c, kind: 'chat', selectors: c.selectors || [], sendSelectors: c.sendSelectors || [], origin: origin(c.url) });
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
// Choosing the default (the popup's list, Options): a preset chat chosen as
// the default is also turned on in the card's menu.
export function defaultPatch(id, s) {
  return { defaultDestination: id, ...(PRESETS.some((p) => p.id === id) ? { presets: { ...s.presets, [id]: true } } : {}) };
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
