import { connect, pair } from './bridge.js';
import { paint } from './icons.js';
import { isMac, settings, choices, FIRST_DEFAULT, update, defaultPatch, sitePattern, cleanSubfolder, modelView, origin } from './settings.js';
import { acceptPastedImages } from './paste.js';
import { shortcuts } from './shortcuts.js';

paint();
const $ = (id) => document.getElementById(id);
// html2wp's own panels; the destination list above them is always there.
const panels = ['checking', 'offline', 'pairing', 'ready'];
const show = (name) => panels.forEach((p) => { $(p).hidden = p !== name; });
const setState = (text, tone = '') => { $('state').textContent = text; $('state').className = `status ${tone}`; $('state').hidden = !text; };
// The page to capture: the active tab, or ?tabId= when this page runs in a tab of its own.
const tabParam = Number(new URLSearchParams(location.search).get('tabId')) || null;

// html2wp's own status, shown only when html2wp is the chosen destination.
async function html2wpStatus() {
  show('checking');
  setState('Checking');
  const found = await connect();
  if (!found) { show('offline'); setState('Not running'); return; }
  const { status } = found;
  if (!status.paired) { show('pairing'); setState('Not paired'); $('code').focus(); return; }
  show('ready');
  setState('Paired', 'ok');
  $('project-name').textContent = status.project?.name || 'No project open';
  const available = !!status.chat?.available;
  $('chat-state').textContent = available ? 'Chat ready' : 'Chat busy';
  $('chat-state').className = `status ${available ? 'ok' : 'warn'}`;
  // The app's own words, as they are.
  $('chat-reason').hidden = available || !status.chat?.reason;
  $('chat-reason').textContent = status.chat?.reason || '';
}

function destState(state, tone, note = '', allow = null) {
  $('allow').hidden = !allow;
  $('allow').textContent = allow?.label || '';
  $('allow').onclick = allow?.run || null;
  $('dest-state').textContent = state;
  $('dest-state').className = `status ${tone}`;
  $('dest-state').hidden = !state;
  $('dest-note').textContent = note;
  $('dest-note').hidden = !note;
}

// The destinations, in the order Options lists them: "Claude — claude.ai".
const optionText = (d, s) => {
  if (d.kind === 'html2wp') return 'html2wp (Mac app) — this Mac';
  if (d.kind === 'chat') return `${d.name} — ${new URL(d.url).host}`;
  if (d.kind === 'save') return `Save only — ${`Downloads/${cleanSubfolder(s.saveSubfolder) || ''}`.replace(/\/$/, '')}`;
  return 'Copy only — the clipboard';
};
// The model for the chosen chat: "Use selected model in chat" (nothing is
// switched), or one of the names read from the chat's own picker in its tab,
// else its typical names, labelled as such. Kept per chat.
const ago = (at) => { const m = Math.round((Date.now() - at) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };
const READ_EVERY = 10 * 60 * 1000;
const asked = new Set();
function renderModels(d) {
  const view = modelView(loaded, d);
  $('model-row').hidden = !view;
  $('effort-row').hidden = !view?.effort;
  if (view?.effort) {
    $('effort-select').replaceChildren(new Option("Use selected effort in chat", ''), ...view.effort.options.map(([value, label]) => new Option(label, value)));
    $('effort-select').value = view.effort.choice;
  }
  if (!view) return;
  const options = [new Option("Use selected model in chat", '')];
  const group = (label, names) => { const g = document.createElement('optgroup'); g.label = label; g.append(...names.map((n) => new Option(n, n))); return g; };
  if (view.names.length) options.push(group(view.live ? `In ${d.name} now` : 'Typical names (may be out of date)', view.names));
  if (view.choice && !view.names.includes(view.choice)) options.push(group('Your choice (not in the list now)', [view.choice]));
  $('model-select').replaceChildren(...options);
  $('model-select').value = view.choice;
  $('model-note').textContent = view.live ? `Read from your ${d.name} tab ${ago(view.at)}.`
    : view.note ? `${d.name}: ${view.note}. Keep ${d.name} open in a tab to read its list.`
    : `Typical names. Keep ${d.name} open in a tab, signed in, to read its own list.`;
  if (!view.choice) $('model-note').textContent += ' The model already selected in your chat will be used.';
  // Check all windows even when the cached model list is still fresh.
  chrome.tabs.query({}).then(tabs => {
    if ($('dest-select').value !== d.id) return;
    const matches = tabs.filter(t => t.url && origin(t.url) === d.origin);
    if (matches.length < 2) return;
    const windows = new Set(matches.map(t => t.windowId)).size;
    $('model-note').textContent = `${matches.length} ${d.name} tabs are open in ${windows} ${windows === 1 ? 'window' : 'windows'}. Choose the target tab when sending from your capture card.`;
  }).catch(() => {});
  // Read again from the chat's own picker (in the tab kept open), now and then.
  if (Date.now() - view.at > READ_EVERY && !asked.has(d.id)) {
    asked.add(d.id);
    chrome.runtime.sendMessage({ type: 'read-models', destination: d.id }).catch(() => {});
  }
}
$('model-select').addEventListener('change', () => {
  const d = list.find((x) => x.id === $('dest-select').value);
  if (d && loaded) update({ modelChoice: { ...loaded.modelChoice, [d.id]: $('model-select').value } });
});
$('effort-select').addEventListener('change', () => {
  const d = list.find((x) => x.id === $('dest-select').value);
  if (d?.model?.effort && loaded) update({ effortChoice: { ...loaded.effortChoice, [d.id]: $('effort-select').value } });
});

let list = [];
let loaded = null;
async function refresh() {
  [list, loaded] = await Promise.all([choices(), settings()]);
  const destination = list.find((d) => d.id === loaded.defaultDestination) || list.find((d) => d.id === FIRST_DEFAULT);
  const select = $('dest-select');
  select.replaceChildren(...list.map((d) => new Option(optionText(d, loaded), d.id, false, d.id === destination.id)));
  select.value = destination.id;
  renderModels(destination);
  if (destination.kind === 'html2wp') { destState(''); await html2wpStatus(); return; }
  show('none');
  setState('');
  if (destination.kind === 'chat') {
    const host = new URL(destination.url).host;
    const origins = [sitePattern(destination.url)];
    const granted = await chrome.permissions.contains({ origins });
    // Asked on this click: Chrome shows its prompt for this one site.
    const allow = { label: `Allow ${destination.name}`, run: async () => { await chrome.permissions.request({ origins }).catch(() => false); await refresh(); } };
    destState(granted ? 'Site permission granted' : 'Needs permission', granted ? 'ok' : 'warn',
      granted ? '' : `Shot2AI needs your permission to send screenshots to ${host}.`, granted ? null : allow);
    return;
  }
  destState('Ready', 'ok');
}
// Changed right here. Saved first: Chrome's permission prompt can close the
// popup, and the choice must not be lost with it. Then, for a web chat, the
// prompt for its site, asked during this change.
$('dest-select').addEventListener('change', () => {
  const d = list.find((x) => x.id === $('dest-select').value);
  if (!d || !loaded) return;
  // The list redraws from storage.onChanged below.
  update(defaultPatch(d.id, loaded));
  if (d.kind === 'chat') chrome.permissions.request({ origins: [sitePattern(d.url)] }).catch(() => false).then(refresh);
});
// Changed in Options (or the right-click menu) while the popup is open.
chrome.storage.onChanged.addListener((changes) => {
  if (['defaultDestination', 'customChats', 'saveSubfolder', 'modelChoice', 'modelLists', 'effortChoice'].some((k) => k in changes)) void refresh();
});
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('recheck').addEventListener('click', refresh);
$('code').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
  e.target.value = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
  $('pair-error').hidden = true;
});
$('pair-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('code').value.replace(/\D/g, '');
  if (code.length !== 6) { $('pair-error').textContent = 'Enter all 6 digits of the code.'; $('pair-error').hidden = false; return; }
  $('pair').disabled = true;
  const result = await pair(code);
  $('pair').disabled = false;
  if (result === 'paired') { await refresh(); return; }
  $('pair-error').textContent = result === 'offline'
    ? 'html2wp stopped answering. Open the app and try again.'
    : 'That code did not match. Check Settings in html2wp; after five wrong codes, choose New code there.';
  $('pair-error').hidden = false;
});
// Captures still waiting in this tab's stack: bring the card back.
async function stackButton() {
  let tabId = tabParam;
  if (!tabId) [{ id: tabId } = {}] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabId) return;
  const { count = 0 } = (await chrome.runtime.sendMessage({ type: 'stack-count', tabId }).catch(() => null)) || {};
  $('show-stack').hidden = !count;
  $('show-stack').textContent = `Show ${count} capture${count === 1 ? '' : 's'} on this page`;
  $('show-stack').onclick = async () => { await chrome.runtime.sendMessage({ type: 'show-stack', tabId }); if (!tabParam) window.close(); };
}
stackButton();
$('capture').addEventListener('click', async () => {
  $('capture').disabled = true;
  $('capture-error').hidden = true;
  let tabId = tabParam;
  if (!tabId) [{ id: tabId } = {}] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ type: 'capture', tabId });
  $('capture').disabled = false;
  if (result?.ok) { if (!tabParam) window.close(); return; }
  $('capture-error').textContent = result?.error || 'The page could not be captured.';
  $('capture-error').hidden = false;
});
$('paste-hint').innerHTML = `Or paste an image with <kbd>${isMac ? '⌘V' : 'Ctrl+V'}</kbd> to annotate it`;
(async () => {
  let tabId = tabParam;
  if (!tabId) [{ id: tabId } = {}] = await chrome.tabs.query({ active: true, currentWindow: true });
  acceptPastedImages(() => { if (!tabParam) window.close(); }, tabId);
})();
// The keys Chrome has for these actions now (the owner may have changed them).
shortcuts().then((keys) => {
  for (const [id, command] of [['key-area', 'capture-area']]) {
    $(id).textContent = keys[command] || '';
    $(id).hidden = !keys[command];
    $(id).title = 'Keyboard shortcut';
  }
});
// Read from the manifest, so the popup always names the build that is loaded.
$('version').textContent = `Shot2AI v${chrome.runtime.getManifest().version}`;
refresh();
