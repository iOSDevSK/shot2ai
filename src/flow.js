// The preview card and what its buttons do.
import { getCapture, updateCapture, deleteCapture } from './captures.js';
import { addToStack, stackFor, unhideStack, STACK_CAP } from './stack.js';
import { sendToApp, outcomeText } from './bridge.js';
import { destinations, defaultDestination, settings, update, fileName, actionLabel, COPY_ONLY, prompts, defaultPromptText, chatOutcome, autoSubmitOn, readsAnswers } from './settings.js';
import { saveImage, savedText } from './save.js';
import { pasteIntoChat } from './webchat.js';
import { watchAnswer, TIMING } from './answer.js';
import { icons } from './icons.js';
import { encode, describe, EXTENSIONS } from './imaging.js';
import { captureFullPage, DEFAULT_MAX_HEIGHT } from './fullpage.js';
import { shortcuts } from './shortcuts.js';

const isMac = async () => (await chrome.runtime.getPlatformInfo()).os === 'mac';

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// A small JPEG of a capture for the card's thumbnail (the card is 280 px wide).
async function thumbnail(png) {
  const bitmap = await createImageBitmap(png);
  const room = Math.min(560 / bitmap.width, 264 / bitmap.height, 1);
  const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * room)), Math.max(1, Math.round(bitmap.height * room)));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}
const formatSignature = (s) => `${s.imageFormat}:${s.imageQuality}`;
const siteOf = (url) => { try { return new URL(url).origin; } catch { return null; } };

// A new capture joins the tab's stack and comes to the front of the card.
// `text` fills its message; `autoSend` sends it at once, and the card only
// shows the result.
export async function showCard(tabId, id, capture, { text = '', autoSend = false, note = '' } = {}) {
  const s = await settings();
  let saved = null;
  if (s.saveCopy) saved = await saveImage(capture.png, capture.url).then(savedText, () => 'The copy could not be saved.');
  const dropped = await addToStack(tabId, id, {
    thumb: await thumbnail(capture.png),
    // What a send to a web chat or a save will weigh, in the chosen format.
    meta: describe(await encode(capture.png, s), s),
    metaFormat: formatSignature(s),
    saved, note: note || null, message: text || await defaultPromptText(),
    result: null, sent: false, selected: false,
  });
  await showStack(tabId, { currentId: id, fresh: await base64(capture.png), autoSend, dropped });
}

// The tab's stack in the card: after a capture, after navigation, or from the popup.
export async function showStack(tabId, { currentId = null, fresh = null, autoSend = false, dropped = 0 } = {}) {
  unhideStack(tabId);
  const s = await settings();
  let list = await stackFor(tabId);
  // A restore leaves out what was already sent, except a chat's answer
  // (the owner closes that one).
  if (!fresh) {
    for (const c of list.filter((x) => x.sent && !x.answer)) await deleteCapture(c.id);
    list = list.filter((x) => !x.sent || x.answer);
  }
  if (!list.length) return false;
  const entries = [];
  for (const c of list) {
    // The format changed since this capture was taken: say what it weighs now.
    if (c.metaFormat !== formatSignature(s)) {
      c.meta = describe(await encode(c.png, s), s);
      await updateCapture(c.id, { meta: c.meta, metaFormat: formatSignature(s) });
    }
    const site = siteOf(c.url);
    entries.push({
      id: c.id, thumb: await base64(c.thumb), meta: c.meta, note: c.note, message: c.message || '', result: c.result || null,
      sent: !!c.sent, selected: !!c.selected, saved: c.saved || null, answer: c.answer || null, asked: c.asked || '',
      region: { canRemember: !!(c.region && site), hasSaved: !!(site && s.regions[site]) },
    });
  }
  const chosen = await defaultDestination();
  const brief = (d) => {
    const auto = d.kind === 'chat' && autoSubmitOn(s, d.id);
    return { id: d.id, name: d.name, kind: d.kind, origin: d.origin || null, host: d.url ? new URL(d.url).host : null, url: d.url || null, auto, answers: auto && readsAnswers(d) };
  };
  const destinationsNow = (await destinations()).map(brief);
  const pick = ['close', 'check', 'send', 'chevron', 'annotate', 'copy', 'download', 'retry', 'region', 'open', 'spinner', 'grip'];
  await chrome.scripting.executeScript({ target: { tabId }, files: ['src/card.js'] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (o) => window.__shot2aiStack(o),
    args: [{
      entries, currentId: currentId || entries.at(-1).id, fresh, autoSend, dropped, cap: STACK_CAP,
      destinations: destinationsNow, multi: s.multiSend.filter((d) => destinationsNow.some((x) => x.id === d)),
      main: { ...brief(chosen || COPY_ONLY), label: actionLabel(chosen) },
      prompts: (await prompts()).map(({ name, text: t }) => ({ name, text: t })),
      acknowledged: s.acknowledged, keys: await shortcuts(), mod: (await isMac()) ? '⌘' : 'Ctrl+', icons: Object.fromEntries(pick.map((k) => [k, icons[k]])),
      // Without a word from the service worker for this long, the card stops waiting for an answer.
      watchdog: TIMING.heartbeat * 4,
    }],
  });
  return true;
}

// Several captures of the stack to the default destination at once. A web
// chat gets them in one message; html2wp as many as it takes per message.
export async function sendCaptures(message) {
  const s = await settings();
  const destination = await defaultDestination();
  const captures = [];
  for (const id of message.ids) { const c = await getCapture(id); if (c?.png) captures.push({ ...c, id }); }
  if (!captures.length) return { ok: false, text: 'These screenshots are no longer available.' };
  if (destination.kind === 'save') {
    for (const c of captures) await saveImage(c.png, c.url).catch(() => {});
    return { ok: true, sentIds: captures.map((c) => c.id), text: `Saved ${captures.length} screenshots` };
  }
  if (destination.kind === 'html2wp') {
    const outcome = await sendToApp(message.text, captures.map((c) => c.png));
    return { ...outcome, ok: !!outcome.ok, sentIds: outcome.ok ? captures.slice(0, outcome.count).map((c) => c.id) : [], text: outcomeText(outcome) };
  }
  if (destination.kind !== 'chat') return { ok: false, text: 'Choose a destination in Options to send several screenshots.' };
  if (message.acknowledge) await update({ acknowledged: { ...s.acknowledged, [message.acknowledge]: true } });
  const blobs = [];
  for (const c of captures) blobs.push(await encode(c.png, s));
  const names = captures.map((c, i) => fileName(s.filenamePattern, c.url, new Date(Date.now() + i * 1000), EXTENSIONS[blobs[i].type]));
  const r = await pasteIntoChat(destination, blobs, message.text, names, { newChat: !!message.newChat });
  if (r.needsPermission) return { ok: false, sentIds: [], text: `Allow the extension to use ${new URL(destination.url).host} in Options first.` };
  if (r.submitted) return { ok: true, sentIds: captures.map((c) => c.id), text: `Sent ${captures.length} screenshots to ${destination.name}.`, tabId: r.tabId };
  if (r.ok && !r.autoSubmit) return { ok: true, sentIds: captures.map((c) => c.id), text: `Pasted ${captures.length} screenshots into ${destination.name}. Press Enter there to send.`, tabId: r.tabId };
  if (r.notAttached) return { ok: false, sentIds: [], text: `${destination.name} did not take the images, so nothing was sent.`, tabId: r.tabId };
  return { ok: false, sentIds: [], text: chatOutcome(destination.name, r)?.text || `The screenshots could not be pasted into ${destination.name}.`, tabId: r.tabId, open: !!r.tabId };
}

export async function openEditor(id, near, text = '') {
  const capture = await getCapture(id);
  const query = new URLSearchParams({ id });
  if (text) query.set('text', text);
  await chrome.tabs.create({ url: chrome.runtime.getURL(`src/editor.html?${query}`), ...(capture?.tabIndex !== undefined ? { index: capture.tabIndex + 1 } : {}), ...(near ? { openerTabId: near } : {}) });
}

export async function cardSend(message, sender) {
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
  const r = await pasteIntoChat(destination, blob, message.text, fileName(s.filenamePattern, capture.url, new Date(), EXTENSIONS[blob.type]), { newChat: !!message.newChat });
  const outcome = chatOutcome(destination.name, r);
  // Sent to a chat whose answer Shot2AI reads (sites/): the card turns into the answer card.
  if (r.submitted && readsAnswers(destination) && sender?.tab && await getCapture(message.id)) {
    await updateCapture(message.id, { asked: message.text || '' });
    watchAnswer({ captureId: message.id, originTabId: sender.tab.id, chatTabId: r.tabId, destination, baseline: r.baseline });
    return { ...r, ...outcome, watching: true };
  }
  return outcome ? { ...r, ...outcome } : r;
}

// A full page, with its progress on the page; the result opens in the card.
export async function fullPageCard(tab) {
  const s = await settings();
  const maxHeight = Math.min(50000, Math.max(5000, Number(s.fullPageMaxHeight) || DEFAULT_MAX_HEIGHT));
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/progress.js'] });
  const say = (text) => chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (t) => window.__shot2aiProgress(t), args: [text] }).catch(() => {});
  await say('Preparing…');
  try {
    const result = await captureFullPage(tab, { maxHeight, progress: (done, total) => void say(`Capturing ${done}/${total}…`) });
    if (result.cancelled) return null;
    await say('Joining…');
    for (const part of result.parts) await showCard(tab.id, part.id, part.capture, { note: result.note });
    return result;
  } finally {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.__shot2aiProgressDone?.() }).catch(() => {});
  }
}

// "Remember this region": the area capture's region, kept for its site.
export async function rememberRegion(message) {
  const capture = await getCapture(message.id);
  let site = null;
  try { site = new URL(capture?.url).origin; } catch { /* no page address */ }
  if (!capture?.region || !site) return { failed: true };
  const { regions } = await settings();
  await update({ regions: { ...regions, [site]: capture.region } });
  return { ok: true };
}

// Several destinations at once. html2wp goes through the bridge while the web
// chats run one after another: each one's tab has to come to the front.
export async function cardSendMany(message) {
  const capture = await getCapture(message.id);
  if (!capture?.png) return { failed: true, text: 'This screenshot is no longer available. Capture the area again.' };
  const s = await settings();
  if (message.acknowledge?.length) await update({ acknowledged: { ...s.acknowledged, ...Object.fromEntries(message.acknowledge.map((o) => [o, true])) } });
  const list = (await destinations()).filter((d) => message.destinations.includes(d.id));
  const app = list.find((d) => d.kind === 'html2wp');
  const appResult = app ? sendToApp(message.text, capture.png) : null;
  const results = [];
  for (const d of list.filter((x) => x.kind === 'chat')) {
    const blob = await encode(capture.png, s);
    const r = await pasteIntoChat(d, blob, message.text, fileName(s.filenamePattern, capture.url, new Date(), EXTENSIONS[blob.type]));
    results.push({ id: d.id, name: d.name, ok: !!(r.submitted || (r.ok && !r.autoSubmit)), text: manyText(r) });
  }
  if (app) {
    const outcome = await appResult;
    results.unshift({ id: 'html2wp', name: 'html2wp', ok: !!outcome.ok, text: outcomeText(outcome) });
  }
  return { results };
}

// One destination's line in "Send to all selected".
function manyText(r) {
  if (r.submitted) return 'Sent';
  if (r.needsPermission) return 'Needs permission in Options';
  const line = {
    noSendButton: 'Pasted; send button not found, press Enter there', notAttached: 'The image did not attach; nothing sent, it is on the clipboard',
    login: 'Log in there once, keep the tab open; nothing sent', plan: 'It did not take the image (a plan or a sign-in?); nothing sent',
    noComposer: 'Message box not found; nothing sent', busy: 'Still answering; nothing sent', noText: 'The message did not go in; nothing sent',
    uploadFailed: 'The upload failed; nothing sent', notConfirmed: 'Send not confirmed; check its tab',
  }[r.reason];
  if (line) return line;
  return r.ok ? 'Pasted; press Enter there' : 'Could not paste; it is on the clipboard';
}

export async function flagError() {
  await chrome.action.setBadgeBackgroundColor({ color: '#985a4b' });
  await chrome.action.setBadgeText({ text: '!' });
  setTimeout(() => chrome.action.setBadgeText({ text: '' }), 4000);
}
