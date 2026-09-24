// Sending to a web chat (ChatGPT, Claude, or any chat the owner adds): find
// or open its tab, attach the screenshot and put the message into its
// composer, and check the image really arrived. With Send automatically on
// (ChatGPT and Claude unless turned off), Shot2AI also presses the chat's
// send button once the upload has finished and checks the message went, all
// in the chat's tab while it stays in the background: the owner stays on
// their page. Without it, the chat's tab comes to the front for Enter.
import { sitePattern, settings, autoSubmitOn } from './settings.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The page gives up on its own by then (see `deadline`); this is the backstop.
const SEND_LIMIT = 90000;

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
// first, then the largest visible editable field), attaches the image as a
// file and puts the message in. With auto-submit on, it then waits for the
// upload, presses the chat's send button (the preset's, or the nearest
// enabled button that is a submit button or is labelled Send) and checks the
// message went. Returns { ok, submitted, reason, baseline }: `ok` when the
// image and the message are in the composer; `reason` names what stopped it.
//
// The chat's tab is usually in the background, where the browser runs timers
// late (up to a minute apart), so every wait here ends on a change to the
// page, watched with a MutationObserver; its timer is only the deadline.
async function pasteInPage(files, text, selectors, submit) {
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 20 && r.height > 10 && getComputedStyle(el).visibility !== 'hidden'; };
  const until = (check, ms) => new Promise((resolve) => {
    let observer = null;
    let timer = 0;
    const finish = (value) => { observer?.disconnect(); clearTimeout(timer); resolve(value); };
    const first = check();
    if (first) { finish(first); return; }
    observer = new MutationObserver(() => { const value = check(); if (value) finish(value); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => finish(check() || null), ms);
  });
  const anyVisible = (list) => list.some((s) => [...document.querySelectorAll(s)].some(visible));
  const count = (list) => { for (const s of list) { const n = document.querySelectorAll(s).length; if (n) return n; } return 0; };
  const find = () => {
    for (const s of selectors) { const el = [...document.querySelectorAll(s)].find(visible); if (el) return el; }
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')].filter((el) => visible(el) && !el.disabled && !el.readOnly);
    return all.sort((a, b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0] || null;
  };
  // The page may still be loading, or signed out: no message box at all.
  const composer = await until(find, 20000);
  if (!composer) return { ok: false, reason: 'noComposer' };
  // Still answering the last message: nothing is touched.
  if (submit.on && anyVisible(submit.stop)) return { ok: false, reason: 'busy' };
  const baseline = { answers: count(submit.answers), user: count(submit.user), url: location.href };
  composer.focus();
  const makeFiles = () => files.map((f) => new File([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
  // The attachment area: the composer's form, or its nearest ancestor that
  // holds a file input. Attached images show up there as previews.
  const area = () => composer.closest('form') || (() => { let n = composer; for (let i = 0; i < 8 && n.parentElement; i++) { n = n.parentElement; if (n.querySelector('input[type=file]')) return n; } return composer.parentElement || document.body; })();
  const previews = () => area().querySelectorAll('img, [style*="background-image"], [data-testid*="attachment" i], [data-testid*="file" i], [aria-label*="remove" i]').length;
  const alerts = () => [...area().querySelectorAll('[role="alert"], [data-testid*="error" i]')].filter((el) => visible(el) && el.textContent.trim()).length;
  const before = previews();
  const alertsBefore = alerts();
  const attached = () => until(() => previews() > before, 6000);
  // 1. The chat's own file input: what its attach button uses, so it takes
  //    the image like a picked file. A synthetic paste is ignored by some
  //    chats (ChatGPT took only the text).
  let ok = false;
  const input = [...area().querySelectorAll('input[type=file]'), ...document.querySelectorAll('input[type=file]')].find((i) => !i.disabled && (!i.accept || /image|\*/.test(i.accept)));
  if (input) {
    const data = new DataTransfer();
    for (const f of makeFiles()) data.items.add(f);
    input.files = data.files;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    ok = await attached();
  }
  // 2. A paste of the files. 3. A drop on the composer.
  if (!ok) {
    const data = new DataTransfer();
    for (const f of makeFiles()) data.items.add(f);
    composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    ok = await attached();
  }
  if (!ok) {
    const data = new DataTransfer();
    for (const f of makeFiles()) data.items.add(f);
    for (const type of ['dragenter', 'dragover', 'drop']) composer.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
    ok = await attached();
  }
  // Without the image nothing is typed or sent: the owner pastes it (it is
  // on the clipboard) and nothing half-done reaches the chat.
  if (!ok) return { ok: false, reason: 'notAttached' };
  const attachedCount = previews();

  // The message. A paste of the text is what ChatGPT's and Claude's editors
  // take in a background tab; typing it (execCommand) and an input event
  // are the fallbacks, and the text is checked after each.
  const flat = (t) => String(t).replace(/\s+/g, ' ').trim();
  const current = () => flat(composer.value ?? composer.innerText ?? '');
  const has = () => !text || current().includes(flat(text));
  if (!has()) {
    composer.focus();
    if (composer instanceof HTMLTextAreaElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(composer, (composer.value ? `${composer.value}\n` : '') + text);
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      if (!(await until(has, 1200))) { composer.focus(); document.execCommand('insertText', false, text); }
      if (!(await until(has, 1200))) composer.dispatchEvent(new InputEvent('beforeinput', { inputType: 'insertText', data: text, bubbles: true, cancelable: true }));
    }
    await until(has, 1500);
  }
  if (!submit.on) return { ok: true, submitted: false };
  // With the image but not the message, nothing is sent.
  if (!has()) return { ok: false, reason: 'noText' };

  const usable = (b) => visible(b) && !b.disabled && b.getAttribute('aria-disabled') !== 'true';
  const sendLike = (b) => b.type === 'submit' || /\b(send|submit)\b/i.test(`${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.textContent || ''}`);
  const findSend = () => {
    for (const s of submit.selectors) { const b = [...document.querySelectorAll(s)].find(usable); if (b) return b; }
    const box = composer.getBoundingClientRect();
    let scope = composer;
    for (let i = 0; i < 8 && scope.parentElement; i++) {
      scope = scope.parentElement;
      const near = [...scope.querySelectorAll('button')].filter((b) => usable(b) && sendLike(b));
      if (near.length) {
        const distance = (b) => { const r = b.getBoundingClientRect(); return Math.hypot(r.left - box.right, r.top - box.bottom); };
        return near.sort((a, b) => distance(a) - distance(b))[0];
      }
    }
    return null;
  };
  const anySend = () => submit.selectors.some((s) => document.querySelector(s))
    || [...(composer.closest('form') || document).querySelectorAll('button')].some((b) => visible(b) && sendLike(b));
  // No send button at all (3 s), or one the chat keeps disabled while the
  // image uploads (30 s). The upload failed when the chat shows an error or
  // drops the preview.
  if (!(await until(anySend, 3000))) return { ok: true, submitted: false, reason: 'noSendButton' };
  const failed = () => alerts() > alertsBefore || previews() < attachedCount;
  const ready = await until(() => findSend() || (failed() && 'failed'), 30000);
  if (ready === 'failed') return { ok: false, reason: 'uploadFailed' };
  if (!ready) return { ok: true, submitted: false, reason: anySend() ? 'uploadFailed' : 'noSendButton' };
  // Past the service worker's patience: it has already told the owner.
  if (Date.now() > submit.deadline) return { ok: true, submitted: false, reason: 'notConfirmed' };
  ready.click();
  // It went when the chat shows a stop button, the owner's new message or a
  // new address, or empties its composer.
  const went = await until(() => anyVisible(submit.stop) || count(submit.user) > baseline.user || location.href !== baseline.url
    || (text ? !current() : previews() < attachedCount), 10000);
  return went ? { ok: true, submitted: true, baseline } : { ok: true, submitted: false, reason: 'notConfirmed' };
}

// One screenshot or several (`blob` and `name` may be arrays).
// Returns { ok, submitted, autoSubmit, tabId, baseline, reason } | { needsPermission } | { failed, reason, tabId }.
export async function pasteIntoChat(destination, blob, text, name) {
  const blobs = Array.isArray(blob) ? blob : [blob];
  const names = Array.isArray(name) ? name : [name];
  if (!(await chrome.permissions.contains({ origins: [sitePattern(destination.url)] }))) return { needsPermission: true };
  // Never for html2wp: only web chats reach this function.
  const autoSubmit = autoSubmitOn(await settings(), destination.id);
  // A tab already on the chat's address, else any tab of the same site.
  const tabs = (await chrome.tabs.query({})).filter((t) => t.url);
  let tab = tabs.find((t) => t.url.startsWith(destination.url)) || tabs.find((t) => { try { return new URL(t.url).origin === destination.origin; } catch { return false; } });
  if (!tab) {
    // Sent automatically, the chat opens behind the owner's page.
    tab = await chrome.tabs.create({ url: destination.url, active: !autoSubmit });
    await loaded(tab.id);
  } else if (tab.discarded) {
    // Chrome unloaded it to save memory: load it again first.
    await chrome.tabs.reload(tab.id);
    await loaded(tab.id);
  }
  // The owner presses Enter there: the chat comes to the front.
  if (!autoSubmit) {
    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
    await wait(150);
  }
  const files = [];
  for (const [index, b] of blobs.entries()) {
    const bytes = new Uint8Array(await b.arrayBuffer());
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    files.push({ base64: btoa(binary), type: b.type || 'image/png', name: names[index] || names[0] });
  }
  const submit = {
    on: autoSubmit, selectors: destination.sendSelectors || [], stop: destination.stopSelectors || [],
    user: destination.userSelectors || [], answers: destination.answerSelectors || [], deadline: Date.now() + SEND_LIMIT - 10000,
  };
  try {
    const run = chrome.scripting.executeScript({ target: { tabId: tab.id }, func: pasteInPage, args: [files, text, destination.selectors || [], submit] });
    const late = wait(SEND_LIMIT).then(() => [{ result: { ok: false, reason: 'notConfirmed' } }]);
    const [{ result }] = await Promise.race([run, late]);
    if (!result?.ok) return { failed: true, reason: result?.reason || 'failed', notAttached: result?.reason === 'notAttached', tabId: tab.id };
    return { ok: true, submitted: !!result.submitted, autoSubmit, reason: result.reason || null, baseline: result.baseline || null, tabId: tab.id };
  } catch {
    return { failed: true, reason: 'failed', tabId: tab.id };
  }
}

// "Open Claude tab", "Continue in Claude": the chat's tab to the front, or
// the chat's address in a new tab when that one was closed.
export async function openChatTab(tabId, url) {
  const tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  if (!tab) { if (url) await chrome.tabs.create({ url, active: true }); return; }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}
