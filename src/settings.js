// Shot2AI settings: the owner's choices, kept in chrome.storage.local, and the
// destinations a screenshot can go to. ChatGPT is the default out of the box;
// the owner can choose another in Options.
import chatgpt from './sites/chatgpt.js';
import claude from './sites/claude.js';
import gemini from './sites/gemini.js';
import perplexity from './sites/perplexity.js';

export const HTML2WP = { id: 'html2wp', name: 'html2wp', kind: 'html2wp' };
export const SAVE_ONLY = { id: 'save', name: 'Save only', kind: 'save' };
export const COPY_ONLY = { id: 'copy', name: 'Copy only', kind: 'copy' };
// Relative positions, snapped to the nearest step on ChatGPT's own slider.
// These are not assumptions about model-specific effort names or token budgets.
export const EFFORTS = [['0', 'Minimum'], ['25', 'Lower'], ['50', 'Middle'], ['75', 'Higher'], ['100', 'Maximum']];
// Web chats with a known composer, each in its own file under sites/: the
// message box, the send and stop buttons, the owner's messages and the chat's
// answers, so Shot2AI can send there, confirm the send and read the answer
// back. When one site changes its page, only its file needs updating. Any
// other chat uses the generic finder.
// Keep Gemini's adapter for later testing; it is not offered in this release.
export const HIDDEN_PRESETS = ['gemini'];
export const PRESETS = [chatgpt, claude, gemini, perplexity].filter(p => !HIDDEN_PRESETS.includes(p.id));
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
  // for the known chats (sites/), off for the owner's own chats, unless changed.
  autoSubmit: {},
  // The owner has read the terms notice for Send automatically (shown once).
  autoSubmitTermsAck: false,
  // The floating toolbar: off unless switched on in Options.
  toolbar: { enabled: false, collapsed: false },
  websiteIntegrations: false,
  toolbarHidden: {},
  toolbarPos: {},
  // Full-page capture stops at this height (CSS px), 5,000–50,000.
  fullPageMaxHeight: 20000,
  // Remembered capture regions by site origin, as fractions of the viewport.
  regions: {},
  // Destinations ticked for "Send to all selected".
  multiSend: [],
  // Web chats the owner has been told receive the screenshot (by origin).
  acknowledged: {},
  // The model the owner chose per known chat, by the name the chat shows
  // ('' or none: the chat's current model, nothing is switched).
  modelChoice: {},
  effortChoice: {},
  // The names last read from each known chat's own model picker: { names, at }.
  modelLists: {},
};

export async function settings() {
  const s = { ...DEFAULTS, ...(await chrome.storage.local.get(Object.keys(DEFAULTS))) };
  if (HIDDEN_PRESETS.includes(s.defaultDestination)) s.defaultDestination = FIRST_DEFAULT;
  s.multiSend = s.multiSend.filter(id => !HIDDEN_PRESETS.includes(id));
  return s;
}
export const update = (patch) => chrome.storage.local.set(patch);

// Send automatically: the known chats (sites/) unless the owner turned it off,
// their own chats only when turned on.
export const autoSubmitOn = (s, id) => s.autoSubmit?.[id] ?? PRESETS.some((p) => p.id === id);
// The chats whose answer Shot2AI can read back into the card.
export const readsAnswers = (d) => !!d?.answerSelectors?.length;

// A known chat's models as the popup and the card show them: the owner's
// choice, and the names read from the chat's picker (`live`), else the
// site's typical names, labelled as such.
export function modelView(s, d) {
  if (!d?.model) return null;
  const read = s.modelLists?.[d.id];
  const live = read?.version === chrome.runtime.getManifest().version && !!read?.names?.length;
  return { choice: s.modelChoice?.[d.id] || '', names: live ? read.names : d.model.typical || [], live, at: live ? read.at : 0, note: d.model.noPicker || null,
    effort: d.model.effort ? { choice: s.effortChoice?.[d.id] || '', options: d.model.effort.options || EFFORTS } : null };
}
// Names read from a chat's picker, kept for the popup and the card.
export async function cacheModels(d, names) {
  const list = [...new Set((names || []).map((n) => String(n).trim()).filter(Boolean))].slice(0, 40);
  if (!d?.model || !list.length) return;
  const { modelLists = {} } = await chrome.storage.local.get('modelLists');
  await update({ modelLists: { ...modelLists, [d.id]: { names: list, at: Date.now(), version: chrome.runtime.getManifest().version } } });
}

// What the card or the editor says after a web-chat send, and whether it
// offers the chat's tab. Anything short of a confirmed send says what is
// left to do: `open` offers the tab, `retry` a second try.
export function chatOutcome(name, r, textOnly = false) {
  if (r.submitted) {
    const used = [r.modelUsed, r.effortUsed ? `effort: ${r.effortUsed}` : null].filter(Boolean).join(' · ');
    return { tone: 'ok', text: `Sent to ${name}${used ? ` (${used})` : ''}.` };
  }
  // The chosen model could not be switched to: nothing went, and the card
  // offers to send with the chat's current model instead (`current`).
  const lists = r.names?.length ? ` It lists: ${r.names.join(', ')}.` : '';
  switch (r.reason) {
    case 'effortPicker': return { tone: 'warn', open: true, current: true, text: `${name}'s Thinking effort control was not found. Nothing was sent.` };
    case 'effortUnsupported': return { tone: 'warn', open: true, current: true, text: `${name}'s Thinking effort control could not be adjusted reliably. Nothing was sent.` };
    case 'effortNotSet': return { tone: 'warn', open: true, current: true, text: `${name} did not confirm the chosen Thinking effort. Nothing was sent.` };
    case 'modelPicker': return { tone: 'warn', open: true, current: true, text: r.pickerNote ? `${name}: ${r.pickerNote}. Nothing was sent.` : `${name}'s model picker was not found, so ${r.model} could not be chosen. Nothing was sent.` };
    case 'modelMissing': return { tone: 'warn', open: true, current: true, text: `${name} has no model called “${r.model}” now.${lists} Nothing was sent.` };
    case 'modelAmbiguous': return { tone: 'warn', open: true, current: true, text: `“${r.model}” matches several of ${name}'s models (${r.detail}); choose one in the popup. Nothing was sent.` };
    case 'modelPlan': return { tone: 'warn', open: true, current: true, text: r.detail ? `${name}: “${r.detail.replace(/[\s.!]+$/, '')}”. Nothing was sent.` : `${name} did not switch to ${r.model}; it may need a paid plan. Nothing was sent.` };
    case 'modelNotSwitched': return { tone: 'warn', open: true, current: true, text: `${name} did not switch to ${r.model}. Nothing was sent.` };
    default: break;
  }
  switch (r.reason) {
    case 'login': return { tone: 'warn', open: true, retry: 'Send again', text: `Log in to ${name} once, then keep the tab open. Your ${textOnly ? 'selected text' : 'screenshot'} waits here; nothing was sent.` };
    case 'plan': return { tone: 'warn', open: true, text: `${name} did not take the screenshot${r.detail ? `: “${r.detail.replace(/[\s.!]+$/, '')}”` : ''}. It may need a sign-in or a paid plan. Nothing was sent.` };
    case 'noComposer': return { tone: 'warn', open: true, text: `${name}'s message box was not found, so nothing was sent. Are you signed in there?` };
    case 'busy': return { tone: 'warn', open: true, retry: true, text: `${name} is still answering in its tab, so nothing was sent. Send again when it finishes.` };
    case 'draft': return { tone: 'warn', open: true, text: 'There is an unsent message or attachment in the chat. Send or clear it there first.' };
    case 'noText': return { tone: 'warn', open: true, text: `${name} ${textOnly ? 'did not take your message' : 'took the screenshot but not your message'}, so nothing was sent. Finish it in the ${name} tab.` };
    case 'uploadBlocked': return { tone: 'warn', open: true, text: `Remove the failed attachment in ${name}, then send again. Nothing was sent.` };
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
// A known chat (sites/): its tab and its conversation are remembered.
const preset = (p) => chat({ ...p, preset: true });
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
// Order defines the default; legacy defaultPrompt IDs are intentionally ignored.
export async function defaultPromptText() {
  return (await prompts())[0]?.text || '';
}
// Resolve at send time too: clearing a message still uses the current default.
export async function promptText(text) {
  return typeof text === 'string' && text.trim() ? text : await defaultPromptText();
}
// Everything the owner can choose as the default: ChatGPT, Claude, Gemini, Perplexity, html2wp,
// their own chats, then Copy only and Save only.
export async function choices() {
  const s = await settings();
  return [...PRESETS.map(preset), HTML2WP, ...s.customChats.map(chat), COPY_ONLY, SAVE_ONLY];
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
  return [...PRESETS.filter(on).map(preset), HTML2WP, ...s.customChats.map(chat)];
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
