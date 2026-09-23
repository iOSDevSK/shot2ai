// Sending to a web chat (ChatGPT, Claude, or any chat the owner adds): find
// or open its tab, then paste the screenshot and the message into its
// composer. Nothing is submitted; the owner presses Enter in that chat.
import { sitePattern } from './settings.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function loaded(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listen); clearTimeout(timer); resolve(); };
    const listen = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listen);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') done(); }, done);
  });
}

// Runs inside the chat's page. Finds the composer (the preset's selectors
// first, then the largest visible editable field), pastes the image as a
// file and puts the message in. Returns { ok, composer }.
async function pasteInPage(base64, text, name, selectors) {
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && getComputedStyle(el).visibility !== 'hidden'; };
  const find = () => {
    for (const s of selectors) { const el = [...document.querySelectorAll(s)].find(visible); if (el) return el; }
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')].filter((el) => visible(el) && !el.disabled && !el.readOnly);
    return all.sort((a, b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0] || null;
  };
  let composer = null;
  for (let i = 0; i < 40 && !composer; i++) { composer = find(); if (!composer) await new Promise((r) => setTimeout(r, 250)); }
  if (!composer) return { ok: false };
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const file = new File([bytes], name, { type: 'image/png' });
  composer.focus();
  const data = new DataTransfer();
  data.items.add(file);
  if (text) data.setData('text/plain', text);
  composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
  // A synthetic paste inserts nothing by itself: the chat takes the file,
  // and the message goes in as typed text unless the chat already added it.
  await new Promise((r) => setTimeout(r, 400));
  const current = () => (composer.value ?? composer.innerText ?? '');
  if (text && !current().includes(text)) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(composer, (composer.value ? `${composer.value}\n` : '') + text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      document.execCommand('insertText', false, text);
    }
  }
  return { ok: true, composer: composer.tagName.toLowerCase() };
}

// Returns { ok } | { needsPermission } | { failed }.
export async function pasteIntoChat(destination, blob, text, name) {
  if (!(await chrome.permissions.contains({ origins: [sitePattern(destination.url)] }))) return { needsPermission: true };
  // A tab already on the chat's address, else any tab of the same site.
  const tabs = (await chrome.tabs.query({})).filter((t) => t.url);
  let tab = tabs.find((t) => t.url.startsWith(destination.url)) || tabs.find((t) => { try { return new URL(t.url).origin === destination.origin; } catch { return false; } });
  if (!tab) {
    tab = await chrome.tabs.create({ url: destination.url, active: true });
    await loaded(tab.id);
  }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
  await wait(150);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  try {
    const [{ result }] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pasteInPage, args: [btoa(binary), text, name, destination.selectors || []] });
    return result?.ok ? { ok: true } : { failed: true };
  } catch {
    return { failed: true };
  }
}
