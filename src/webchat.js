// Sending to a web chat (ChatGPT, Claude, Gemini, Perplexity, or any chat the
// owner adds): find its tab, attach the screenshot and put the message into
// its composer, and check the image really arrived. With Send automatically
// on (the four known chats unless turned off), Shot2AI also presses the
// chat's send button once the upload has finished and checks the message
// went, all in the chat's tab while it stays in the background: the owner
// stays on their page. Without it, the chat's tab comes to the front for Enter.
//
// The owner signs in to a chat once, in its own tab, and keeps that tab: it
// is the tab Shot2AI uses, so each screenshot continues the same conversation
// unless the owner asks for a new chat. A closed tab opens again, in the
// background, on the last conversation. Shot2AI never touches a sign-in page.
import { sitePattern, settings, update, autoSubmitOn, origin, cacheModels, legacyModelEffort } from './settings.js';
import { controlBackgroundFrames } from './background-frames.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// The page gives up on its own by then (see `deadline`); this is the backstop.
const SEND_LIMIT = 90000;

// A tab of this chat's site, or null (a sign-in page elsewhere, or a page
// Shot2AI may not read, has no address here).
const onSite = (tab, destination) => !!tab?.url && origin(tab.url) === destination.origin;

function loaded(tabId, timeout = 20000) {
  return new Promise((resolve) => {
    const done = () => { chrome.tabs.onUpdated.removeListener(listen); clearTimeout(timer); resolve(); };
    const listen = (id, info) => { if (id === tabId && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listen);
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') done(); }, done);
  });
}
// Loads `url` in the tab (in the background) and waits for that page, not
// for the one it had.
function navigate(tabId, url, timeout = 20000) {
  return new Promise((resolve) => {
    let started = false;
    const done = () => { chrome.tabs.onUpdated.removeListener(listen); clearTimeout(timer); resolve(); };
    const listen = (id, info) => { if (id !== tabId) return; if (info.status === 'loading') started = true; if (started && info.status === 'complete') done(); };
    const timer = setTimeout(done, timeout);
    chrome.tabs.onUpdated.addListener(listen);
    chrome.tabs.update(tabId, { url }).catch(done);
  });
}

// Runs inside the chat's page. Finds the composer (the preset's selectors
// first, then the largest visible editable field), attaches the image as a
// file and puts the message in. With auto-submit on, it then waits for the
// upload, presses the chat's send button (the preset's, or the nearest
// enabled button that is a submit button or is labelled Send) and checks the
// message went. Returns { ok, submitted, reason, baseline }: `ok` when the
// image and the message are in the composer; `reason` names what stopped it:
// login (a sign-in page, or the chat asks for one), plan (the chat says a
// plan or a limit stands in the way; `detail` has its words), noComposer,
// busy, notAttached, noText, uploadFailed, noSendButton or notConfirmed.
//
// The chat's tab is usually in the background, where the browser runs timers
// late (up to a minute apart), so every wait here ends on a change to the
// page, watched with a MutationObserver; its timer is only the deadline.
async function pasteInPage(files, text, selectors, submit) {
  if (submit.clearDraft && (!submit.draftUrl || location.href !== submit.draftUrl)) return { ok: false, reason: 'draftChanged' };
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
    const eligible = el => visible(el) && !el.closest('[inert], [aria-hidden="true"]') && !(submit.composerExclude && el.closest(submit.composerExclude)) && !el.disabled && !el.readOnly;
    for (const s of selectors) { const el = [...document.querySelectorAll(s)].find(eligible); if (el) return el; }
    if (submit.strictComposer) return null;
    const all = [...document.querySelectorAll('textarea, [contenteditable="true"], [contenteditable=""], [contenteditable="plaintext-only"]')].filter((el) => visible(el) && !el.disabled && !el.readOnly);
    return all.sort((a, b) => { const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect(); return rb.width * rb.height - ra.width * ra.height; })[0] || null;
  };
  // Signed out: a sign-in page instead of the message box. It is only looked
  // at, never filled in; the owner signs in once, in that tab. A sign-in
  // button next to a message box is not enough: some chats take messages
  // signed out, and what they refuse is caught when the image does not go.
  const words = /^(log ?in|sign ?in|sign up|log in or sign up|sign in with google|continue with (google|email|apple|microsoft))$/i;
  const signIn = () => anyVisible(submit.login.selectors)
    || [...document.querySelectorAll('a, button')].some((el) => visible(el) && words.test(el.textContent.replace(/\s+/g, ' ').trim()));
  if (submit.login.urls.some((u) => location.pathname.startsWith(u))) return { ok: false, reason: 'login' };
  // The page may still be loading: wait for the message box.
  let composer = await until(() => find() || (signIn() && 'login'), submit.wait);
  if (composer === 'login') composer = await until(find, 2500);
  if (!composer) return { ok: false, reason: signIn() ? 'login' : 'noComposer' };
  // What the chat says when it refuses: a plan or a limit, or a sign-in.
  const blocker = () => {
    for (const el of document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"], [role="alert"]')) {
      if (!visible(el)) continue;
      const raw = el.innerText || el.textContent || '';
      const said = raw.replace(/\s+/g, ' ').trim();
      const planWords = /\b(upgrade|subscribe|subscription|paid plan|pro plan|limit|quota)\b/i;
      if (planWords.test(said)) {
        const firstLine = raw.split('\n').map((s) => s.trim()).find(Boolean) || said;
        return { ok: false, reason: 'plan', detail: (planWords.test(firstLine) ? firstLine : said).slice(0, 160) };
      }
      if (/\b(log ?in|sign ?in|sign up)\b/i.test(said)) return { ok: false, reason: 'login' };
    }
    return null;
  };
  // Still answering the last message: nothing is touched.
  if (submit.on && anyVisible(submit.stop)) return { ok: false, reason: 'busy' };
  // The model the owner chose, switched in the chat's own picker (picker.js)
  // before anything is attached, and checked. If it cannot be, nothing is
  // sent. With the chat's current model, the picker is not touched at all.
  let model = null;
  if (submit.model) {
    const picker = window.__shot2aiPicker;
    const picked = !submit.model.want ? { ok: true } : picker ? await picker.choose(submit.model.picker, submit.model.want) : { ok: false, reason: 'modelPicker' };
    if (!picked.ok) return { ok: false, reason: picked.reason, detail: picked.detail || null, names: picked.names || [] };
    model = { name: picked.name, names: picked.names || [] };
    if (submit.model.effort !== '') {
      const adjusted = picker ? await picker.chooseEffort(submit.model.picker, submit.model.effort) : { ok: false, reason: 'effortPicker' };
      if (!adjusted.ok) return { ok: false, reason: adjusted.reason, names: model.names };
      model.effort = adjusted.name;
    }
    // The picker is closed; the message box must still be there.
    composer = find() || await until(find, 2000);
    if (!composer) return { ok: false, reason: 'noComposer' };
  }
  if (submit.conversationUrl && location.href !== submit.conversationUrl) return { ok: false, reason: 'conversationChanged' };
  const identity = (el) => {
    for (const attr of submit.messageIdentity || []) {
      const value = el.closest(`[${attr}]`)?.getAttribute(attr)?.trim();
      if (value) return `${attr}:${value}`;
    }
    return '';
  };
  const userMessages = () => { for (const s of submit.user) { const found = [...document.querySelectorAll(s)]; if (found.length) return found; } return []; };
  const normalize = value => String(value || '').replace(/\s+/g, ' ').trim();
  const baseline = { answers: count(submit.answers), user: count(submit.user), url: location.href,
    question: normalize(text), userKeys: userMessages().map(identity).filter(Boolean) };
  composer.focus();
  const makeFiles = () => files.map((f) => new File([Uint8Array.from(atob(f.base64), (c) => c.charCodeAt(0))], f.name, { type: f.type }));
  // The attachment area, where attached images show up as previews: the
  // site's own (sites/), the composer's form, or its nearest ancestor that
  // holds a file input or the send button.
  const holdsSend = (n) => submit.selectors.some((s) => n.querySelector(s)) || [...n.querySelectorAll('button')].some((b) => /\b(send|submit)\b/i.test(`${b.getAttribute('aria-label') || ''} ${b.title || ''}`));
  const up = (test) => { let n = composer; for (let i = 0; i < 8 && n.parentElement; i++) { n = n.parentElement; if (test(n)) return n; } return null; };
  const area = () => submit.area.map((s) => composer.closest(s)).find(Boolean) || composer.closest('form')
    || up((n) => n.querySelector('input[type=file]')) || up(holdsSend) || composer.parentElement || document.body;
  const previews = () => area().querySelectorAll(submit.attachments?.length ? submit.attachments.join(',') : 'img, [style*="background-image"], [data-testid*="attachment" i], [data-testid*="file" i], [aria-label*="remove" i]').length;
  const attachmentError = () => (submit.uploadErrors || []).some(s => [...area().querySelectorAll(s)].some(visible))
    ? { ok: false, reason: 'uploadFailed' } : null;
  // An earlier failed upload also disables Gemini's Send control. Leave it
  // visible for the owner; do not append another file to a failed draft.
  if (attachmentError() && !submit.clearDraft) return { ok: false, reason: 'uploadBlocked', url: location.href };
  const alerts = () => [...area().querySelectorAll('[role="alert"], [data-testid*="error" i]')].filter((el) => visible(el) && el.textContent.trim()).length;
  const draftText = () => String(composer.value ?? composer.innerText ?? '').trim();
  if (draftText() || previews() || attachmentError()) {
    if (!submit.clearDraft) return { ok: false, reason: 'draft', url: location.href };
    // Only the explicitly confirmed composer is cleared, using the site's
    // own attachment controls so its internal upload state changes too.
    if (area() === document.body || !area().contains(composer)
      || [...submit.user, ...submit.answers].some(selector => area().querySelector(selector))) return { ok: false, reason: 'draftNotCleared', url: location.href };
    for (let attempt = 0; previews() && attempt < 40; attempt++) {
      if (location.href !== submit.draftUrl) return { ok: false, reason: 'draftChanged' };
      const before = previews();
      const remove = [...area().querySelectorAll('button, [role="button"]')].find(el => {
        const label = `${el.getAttribute('aria-label') || ''} ${el.getAttribute('title') || ''}`.trim();
        const test = el.getAttribute('data-testid') || '';
        return !el.disabled && el.getAttribute('aria-disabled') !== 'true'
          && (/^(remove|delete|discard)(?:\s|$)/i.test(label) || /(?:remove|delete).*(?:file|image|attachment)|(?:file|image|attachment).*(?:remove|delete)/i.test(test));
      });
      if (!remove) return { ok: false, reason: 'draftNotCleared', url: location.href };
      remove.click();
      if (!await until(() => previews() < before, 1500)) return { ok: false, reason: 'draftNotCleared', url: location.href };
      composer = find();
      if (!composer) return { ok: false, reason: 'noComposer' };
    }
    if (previews()) return { ok: false, reason: 'draftNotCleared', url: location.href };
    composer.focus();
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const proto = composer instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(composer, '');
      composer.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (draftText()) {
      const range = document.createRange(); range.selectNodeContents(composer);
      const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('delete');
    }
    for (const input of area().querySelectorAll('input[type="file"]')) input.value = '';
    await new Promise(resolve => setTimeout(resolve, 100));
    composer = find();
    if (location.href !== submit.draftUrl) return { ok: false, reason: 'draftChanged' };
    if (!composer || draftText() || previews() || attachmentError()) return { ok: false, reason: 'draftNotCleared', url: location.href };
  }
  const before = previews();
  const alertsBefore = alerts();
  const attached = () => until(() => blocker() || attachmentError() || previews() > before, 6000);
  // 1. The chat's own file input: what its attach button uses, so it takes
  //    the image like a picked file. A synthetic paste is ignored by some
  //    chats (ChatGPT took only the text).
  if (files.length) {
    let ok = false;
    const acceptsFiles = (input) => {
      const types = input.accept.toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
      return !types.length || files.every((f) => types.some((type) => type === '*/*' || type === '*'
        || (type.startsWith('.') ? f.name.toLowerCase().endsWith(type)
          : type.endsWith('/*') ? f.type.toLowerCase().startsWith(type.slice(0, -1)) : f.type.toLowerCase() === type)));
    };
    const findFileInput = () => [...area().querySelectorAll('input[type=file]'), ...document.querySelectorAll('input[type=file]')].find((i) => !i.disabled && acceptsFiles(i));
    let input = findFileInput();
    let openedUpload = null;
    // Gemini creates its image input lazily when Upload and tools is opened.
    // Use that input rather than relying on synthetic clipboard/drop support.
    if (!input && submit.uploadButtons?.length) {
      const button = submit.uploadButtons.flatMap(s => [...document.querySelectorAll(s)]).find(visible);
      if (button && button.getAttribute('aria-expanded') !== 'true') {
        button.click(); openedUpload = button;
        input = await until(findFileInput, 2000);
      }
    }
    const closeUpload = () => {
      if (openedUpload?.isConnected && openedUpload.getAttribute('aria-expanded') === 'true') openedUpload.click();
      openedUpload = null;
    };
    if (input) {
      const data = new DataTransfer();
      for (const f of makeFiles()) data.items.add(f);
      try {
        input.files = data.files;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        ok = await attached();
      } finally { closeUpload(); }
      if (ok?.reason) return ok;
    }
    closeUpload();
    // 2. A paste of the files. 3. A drop on the composer.
    if (!ok) {
      const data = new DataTransfer();
      for (const f of makeFiles()) data.items.add(f);
      composer.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
      ok = await attached();
      if (ok?.reason) return ok;
    }
    if (!ok) {
      const data = new DataTransfer();
      for (const f of makeFiles()) data.items.add(f);
      for (const type of ['dragenter', 'dragover', 'drop']) composer.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
      ok = await attached();
      if (ok?.reason) return ok;
    }
    // Without the image nothing is typed or sent: the owner pastes it (it is
    // on the clipboard) and nothing half-done reaches the chat.
    if (!ok) return (await until(blocker, 1500)) || { ok: false, reason: 'notAttached' };
  }
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

  const usable = (b) => visible(b) && !b.disabled && !b.closest('[aria-disabled="true"]');
  const sendLike = (b) => (b.type === 'submit' && !!b.form) || /\b(send|submit)\b/i.test(`${b.getAttribute('aria-label') || ''} ${b.title || ''} ${b.textContent || ''}`);
  const findSend = () => {
    let known = false;
    for (const s of submit.selectors) {
      const buttons = [...document.querySelectorAll(s)].filter(visible);
      const b = buttons.find(usable); if (b) return b;
      known ||= buttons.length > 0;
    }
    // A known Send control may be disabled until uploading finishes. Do not
    // mistake another nearby button (Upload, microphone) for its fallback.
    if (known) return null;
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
  // A chat that drops the image may still send the text alone: its failure
  // is looked for before its send button, and once more before the click.
  const failed = () => attachmentError() || alerts() > alertsBefore || previews() < attachedCount;
  const ready = await until(() => (failed() && 'failed') || findSend(), 30000);
  if (ready === 'failed') return (await until(blocker, 1500)) || { ok: false, reason: 'uploadFailed' };
  if (!ready) return blocker() || { ok: true, submitted: false, reason: anySend() ? 'uploadFailed' : 'noSendButton' };
  // Past the service worker's patience: it has already told the owner.
  if (Date.now() > submit.deadline) return { ok: true, submitted: false, reason: 'notConfirmed' };
  if (failed()) return blocker() || { ok: false, reason: 'uploadFailed' };
  if (submit.conversationUrl && location.href !== submit.conversationUrl) return { ok: false, reason: 'conversationChanged' };
  ready.click();
  // It went when the chat shows a stop button, the owner's new message or a
  // new address, or empties its composer.
  const went = await until(() => anyVisible(submit.stop) || count(submit.user) > baseline.user || location.href !== baseline.url
    || (text ? !current() : previews() < attachedCount), 10000);
  return went ? { ok: true, submitted: true, baseline, url: location.href, model } : { ok: true, submitted: false, reason: 'notConfirmed' };
}

// The tab Shot2AI uses for each chat in this browser session, and whether it
// was showing a sign-in page. Kept in session storage: gone when Chrome quits.
async function remembered(destination) {
  const { chatTabs = {} } = await chrome.storage.session.get('chatTabs').catch(() => ({}));
  const kept = chatTabs[destination.id];
  const tab = kept ? await chrome.tabs.get(kept.tabId).catch(() => null) : null;
  return tab ? { tab, signIn: !!kept.signIn } : null;
}
async function remember(destination, tabId, signIn = false) {
  const { chatTabs = {} } = await chrome.storage.session.get('chatTabs').catch(() => ({}));
  await chrome.storage.session.set({ chatTabs: { ...chatTabs, [destination.id]: { tabId, signIn } } }).catch(() => {});
}
// The last conversation with a known chat (on this device), so a closed tab
// opens again where the owner left off.
export async function lastConversation(destination) {
  const { chatUrls = {} } = await chrome.storage.local.get('chatUrls');
  const url = chatUrls[destination.id];
  return url && origin(url) === destination.origin ? url : null;
}
export async function rememberConversation(destination, url) {
  if (!destination.preset || !url || origin(url) !== destination.origin) return;
  const { chatUrls = {} } = await chrome.storage.local.get('chatUrls');
  if (chatUrls[destination.id] !== url) await update({ chatUrls: { ...chatUrls, [destination.id]: url } });
}

// The chat's tab: the one Shot2AI used last, else the one of that site the
// owner used last (for the owner's own chats, one on the chat's address
// first). A remembered tab that went to another site is let go, unless it
// went there to sign in.
export async function findTab(destination) {
  const kept = await remembered(destination);
  const tabs = (await chrome.tabs.query({})).filter((t) => onSite(t, destination));
  const onAddress = (t) => (!destination.preset && t.url.startsWith(destination.url) ? 1 : 0);
  tabs.sort((a, b) => onAddress(b) - onAddress(a) || (b.lastAccessed || 0) - (a.lastAccessed || 0));
  const windows = [...new Set(tabs.map(t => t.windowId))];
  const candidates = tabs.map(t => ({ id: t.id, window: windows.indexOf(t.windowId) + 1, index: t.index + 1, title: (t.title || destination.name).slice(0, 100) }));
  if (kept && (onSite(kept.tab, destination) || kept.signIn)) return { ...kept, candidates };
  return tabs[0] ? { tab: tabs[0], signIn: false, candidates } : null;
}

// One screenshot or several (`blob` and `name` may be arrays). `newChat`
// starts a new conversation in the chat's tab instead of continuing it;
// `model` is the name of the model to switch to first (none: the chat's
// current model, and its picker is not touched).
// Returns { ok, submitted, autoSubmit, tabId, baseline, reason, modelUsed } | { needsPermission } | { failed, reason, detail, names, tabId }.
export async function pasteIntoChat(destination, blob, text, name, { newChat = false, model = null, effort, backgroundAnswer = false, continuation = null, targetTabId = null, clearDraft = false, draftUrl = null } = {}) {
  const blobs = Array.isArray(blob) ? blob : [blob];
  const names = Array.isArray(name) ? name : [name];
  if (!(await chrome.permissions.contains({ origins: [sitePattern(destination.url)] }))) return { needsPermission: true };
  // Never for html2wp: only web chats reach this function.
  const saved = await settings();
  const autoSubmit = !!continuation || !!clearDraft || autoSubmitOn(saved, destination.id);
  let want = model && destination.model ? model : null;
  let effortWant = !continuation && destination.model?.effort ? (typeof effort === 'string' ? effort : saved.effortChoice?.[destination.id] || '') : '';
  const found = continuation ? { tab: await chrome.tabs.get(continuation.tabId).catch(() => null) } : await findTab(destination);
  if (continuation && found.tab?.url !== continuation.url) {
    const matches = (await chrome.tabs.query({})).filter(t => t.url === continuation.url);
    found.tab = matches.length === 1 ? matches[0] : null;
  }
  if (continuation && (!found.tab || !onSite(found.tab, destination) || !continuation.url || found.tab.url !== continuation.url)) {
    return { failed: true, reason: 'conversationChanged' };
  }
  if (!continuation && targetTabId != null) {
    const chosen = Number.isInteger(targetTabId) && await chrome.tabs.get(targetTabId).catch(() => null);
    if (!chosen || !onSite(chosen, destination)) return { failed: true, reason: 'chatTabGone' };
    if (!found) return { failed: true, reason: 'chatTabGone' };
    found.tab = chosen;
  } else if (!continuation && found?.candidates?.length > 1) {
    return { failed: true, reason: 'multipleTabs', tabs: found.candidates, windows: new Set(found.candidates.map(t => t.window)).size };
  }
  let tab = found?.tab || null;
  // Loaded by Shot2AI just now: a page elsewhere means a sign-in page.
  let fresh = false;
  if (!tab) {
    // Sent automatically, the chat opens behind the owner's page, on the
    // last conversation unless a new chat is asked for.
    const url = (!newChat && await lastConversation(destination)) || destination.url;
    tab = await chrome.tabs.create({ url, active: !autoSubmit });
    await loaded(tab.id);
    fresh = true;
  } else if (newChat && onSite(tab, destination)) {
    await navigate(tab.id, destination.url);
    fresh = true;
  } else if (tab.discarded) {
    // Chrome unloaded it to save memory: load it again first.
    await chrome.tabs.reload(tab.id);
    await loaded(tab.id);
    fresh = true;
  }
  tab = await chrome.tabs.get(tab.id).catch(() => null);
  if (!tab) return { failed: true, reason: 'failed' };
  await remember(destination, tab.id);
  if (!onSite(tab, destination)) {
    if (fresh || found?.signIn) { await remember(destination, tab.id, true); return { failed: true, reason: 'login', tabId: tab.id }; }
    return { failed: true, reason: 'failed', tabId: tab.id };
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
  const frameToken = autoSubmit && destination.backgroundFrames ? crypto.randomUUID() : null;
  let keepFrames = false;
  const run = async (tabId, loadedNow) => {
    await controlBackgroundFrames(tabId, frameToken, 'start');
    const submit = {
      clearDraft: !!clearDraft, draftUrl,
      conversationUrl: continuation?.url || null,
      on: autoSubmit, selectors: destination.sendSelectors || [], stop: destination.stopSelectors || [],
      user: destination.userSelectors || [], answers: destination.answerSelectors || [], deadline: Date.now() + SEND_LIMIT - 10000,
      messageIdentity: destination.messageIdentity || [],
      login: { urls: destination.loginUrls || [], selectors: destination.loginSelectors || [] }, area: destination.areaSelectors || [], attachments: destination.attachmentSelectors || [],
      strictComposer: !!destination.strictComposer, composerExclude: destination.composerExclude || '',
      uploadButtons: destination.uploadButtonSelectors || [], uploadErrors: destination.uploadErrorSelectors || [],
      // A page that is already there shows its message box at once.
      wait: loadedNow ? 20000 : 6000,
      model: want || effortWant !== '' ? { want, effort: effortWant, picker: destination.model } : null,
    };
    if (submit.model) await chrome.scripting.executeScript({ target: { tabId }, files: ['src/picker.js'] });
    const script = chrome.scripting.executeScript({ target: { tabId }, func: pasteInPage, args: [files, text, destination.selectors || [], submit] });
    const late = wait(SEND_LIMIT).then(() => [{ result: { ok: false, reason: 'notConfirmed' } }]);
    // A long-idle tab can suspend both animation frames and the page's
    // fallback timers. Pulse from the extension while attaching, just as
    // the answer watcher does after sending. Waiting until submission is
    // too late when the attachment preview itself needs a frame.
    let sending = true;
    let pulseTimer;
    const pulse = async () => {
      if (!sending) return;
      try { await controlBackgroundFrames(tabId, frameToken, 'pulse'); } catch { /* closed/navigated tab: the send reports the failure */ }
      if (sending) pulseTimer = setTimeout(pulse, 400);
    };
    if (frameToken) pulseTimer = setTimeout(pulse, 400);
    try {
      const [{ result }] = await Promise.race([script, late]);
      return result;
    } finally {
      sending = false;
      clearTimeout(pulseTimer);
    }
  };
  try {
    let result = await run(tab.id, fresh || tab.status !== 'complete');
    // An old card can still carry Instant after settings were migrated.
    // modelMissing returns before editing the composer or attaching files;
    // retry once with the current model and a verified effort selection.
    const legacyEffort = !continuation && result?.reason === 'modelMissing'
      ? legacyModelEffort(destination, want, result.names) : null;
    if (legacyEffort !== null) {
      await cacheModels(destination, result.names);
      want = null;
      effortWant = effortWant || legacyEffort;
      result = await run(tab.id, false);
    }
    // A page of the chat without a message box (its settings, a list of
    // chats): the tab goes to the conversation, or a new chat, and tries again.
    if (!continuation && result?.reason === 'noComposer' && !fresh && destination.preset) {
      await navigate(tab.id, (!newChat && await lastConversation(destination)) || destination.url);
      const now = await chrome.tabs.get(tab.id).catch(() => null);
      if (!onSite(now, destination)) { await remember(destination, tab.id, true); return { failed: true, reason: 'login', tabId: tab.id }; }
      result = await run(tab.id, true);
    }
    if (result?.reason === 'login') await remember(destination, tab.id, true);
    if (result?.submitted) await rememberConversation(destination, result.url);
    // Whatever the picker showed on the way is the chat's list now.
    await cacheModels(destination, result?.model?.names || result?.names).catch(() => {});
    const about = { model: want, names: result?.names || null, pickerNote: destination.model?.noPicker || null };
    if (!result?.ok) return { failed: true, reason: result?.reason || 'failed', detail: result?.detail || null, notAttached: result?.reason === 'notAttached', draftUrl: result?.url || null, tabId: tab.id, ...about };
    keepFrames = backgroundAnswer && !!result.submitted;
    return { ok: true, submitted: !!result.submitted, autoSubmit, reason: result.reason || null, baseline: result.baseline || null, url: result.url || tab.url, tabId: tab.id, frameToken: keepFrames ? frameToken : null, modelUsed: result.model?.name || null, effortUsed: result.model?.effort || null, ...about };
  } catch {
    return { failed: true, reason: 'failed', tabId: tab.id };
  } finally {
    if (!keepFrames) await controlBackgroundFrames(tab.id, frameToken, 'stop').catch(() => {});
  }
}

// The names in the chat's own model picker, read in the tab the owner keeps
// (never one opened for it) and cached: open the picker, read, close it. Not
// while the chat answers, and not in a tab the owner is looking at.
export async function readModels(destination) {
  if (!destination?.model) return { skipped: 'noPicker' };
  if (!(await chrome.permissions.contains({ origins: [sitePattern(destination.url)] }))) return { skipped: 'permission' };
  const found = await findTab(destination);
  if (found?.candidates?.length > 1) return { skipped: 'multipleTabs', count: found.candidates.length, windows: new Set(found.candidates.map(t => t.window)).size };
  const tab = found?.tab;
  if (!tab || !onSite(tab, destination) || tab.discarded || tab.status !== 'complete') return { skipped: 'noTab' };
  if (tab.active && (await chrome.windows.get(tab.windowId).catch(() => null))?.focused) return { skipped: 'inUse' };
  try {
    const target = { tabId: tab.id };
    const [{ result: busy }] = await chrome.scripting.executeScript({ target, func: (stop) => stop.some((s) => [...document.querySelectorAll(s)].some((el) => el.getBoundingClientRect().width > 0)), args: [destination.stopSelectors || []] });
    if (busy) return { skipped: 'busy' };
    await chrome.scripting.executeScript({ target, files: ['src/picker.js'] });
    const [{ result }] = await chrome.scripting.executeScript({ target, func: (m) => window.__shot2aiPicker.read(m), args: [destination.model] });
    if (!result?.ok || !result.names.length) return { failed: true, reason: result?.reason || 'modelPicker' };
    await cacheModels(destination, result.names);
    return { ok: true, names: result.names, current: result.current };
  } catch {
    return { failed: true, reason: 'failed' };
  }
}

// "Open Claude tab", "Continue in Claude": the chat's tab to the front; when
// that one was closed, the last conversation (or the chat) in a new tab.
export async function openChatTab(tabId, destination, conversationUrl = null) {
  const tab = tabId ? await chrome.tabs.get(tabId).catch(() => null) : null;
  const pinned = conversationUrl && origin(conversationUrl) === destination?.origin ? conversationUrl : null;
  if (!tab || (pinned && tab.url !== pinned)) {
    if (!destination?.url) return;
    const opened = await chrome.tabs.create({ url: pinned || (await lastConversation(destination)) || destination.url, active: true });
    await remember(destination, opened.id);
    return;
  }
  await chrome.tabs.update(tab.id, { active: true });
  await chrome.windows.update(tab.windowId, { focused: true }).catch(() => {});
}
