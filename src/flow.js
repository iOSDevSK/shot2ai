// The preview card and what its buttons do.
import { getCapture } from './captures.js';
import { sendToApp, outcomeText } from './bridge.js';
import { destinations, defaultDestination, settings, update, fileName, actionLabel, COPY_ONLY, prompts, defaultPromptText } from './settings.js';
import { saveImage, savedText } from './save.js';
import { pasteIntoChat } from './webchat.js';
import { icons } from './icons.js';
import { encode, describe, EXTENSIONS } from './imaging.js';

const isMac = async () => (await chrome.runtime.getPlatformInfo()).os === 'mac';

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// The quick preview card, in the page the area came from. `text` fills the
// message; `autoSend` sends at once, and the card only shows the result.
export async function showCard(tabId, id, capture, { text = '', autoSend = false } = {}) {
  const s = await settings();
  const chosen = await defaultDestination();
  let saved = null;
  if (s.saveCopy) saved = await saveImage(capture.png, capture.url).then(savedText, () => 'The copy could not be saved.');
  const brief = (d) => ({ id: d.id, name: d.name, kind: d.kind, origin: d.origin || null, host: d.url ? new URL(d.url).host : null });
  const list = (await destinations()).map(brief);
  const main = { ...brief(chosen || COPY_ONLY), label: actionLabel(chosen) };
  // What a send to a web chat or a save will weigh, in the chosen format.
  const meta = describe(await encode(capture.png, s), s);
  const pick = ['close', 'check', 'send', 'chevron', 'annotate', 'copy', 'download', 'retry'];
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/card.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (o) => window.__shot2aiShowCard(o),
    args: [{ id, png: await base64(capture.png), scale: capture.scale, destinations: list, main, meta, text: text || await defaultPromptText(), prompts: (await prompts()).map(({ name, text: t }) => ({ name, text: t })), autoSend, acknowledged: s.acknowledged, saved, mod: (await isMac()) ? '⌘' : 'Ctrl+', icons: Object.fromEntries(pick.map((k) => [k, icons[k]])) }],
  });
}

export async function openEditor(id, near, text = '') {
  const capture = await getCapture(id);
  const query = new URLSearchParams({ id });
  if (text) query.set('text', text);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/editor.html?${query}`), ...(capture?.tabIndex !== undefined ? { index: capture.tabIndex + 1 } : {}), ...(near ? { openerTabId: near } : {}) });
}

export async function cardSend(message) {
  const capture = await getCapture(message.id);
  if (!capture?.png) return { failed: true, text: 'This screenshot is no longer available. Capture the area again.' };
  const list = await destinations();
  const destination = list.find((d) => d.id === message.destination);
  if (!destination) return { failed: true, text: 'This destination is no longer set up.' };
  if (destination.kind === 'html2wp') {
    const outcome = await sendToApp(message.text, capture.png);
    return { ...outcome, text: outcomeText(outcome) };
  }
  if (message.acknowledge) {
    const { acknowledged } = await settings();
    await update({ acknowledged: { ...acknowledged, [message.acknowledge]: true } });
  }
  const s = await settings();
  const blob = await encode(capture.png, s);
  return pasteIntoChat(destination, blob, message.text, fileName(s.filenamePattern, capture.url, new Date(), EXTENSIONS[blob.type]));
}

export async function flagError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#985a4b' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}
