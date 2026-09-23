import { connect, pair } from './bridge.js';
import { paint } from './icons.js';
import { isMac, settings, defaultDestination, sitePattern, cleanSubfolder } from './settings.js';
import { acceptPastedImages } from './paste.js';
import { shortcuts } from './shortcuts.js';

paint();
const $ = (id) => document.getElementById(id);
const panels = ['checking', 'offline', 'pairing', 'ready', 'other'];
const show = (name) => panels.forEach((p) => { $(p).hidden = p !== name; });
const setState = (text, tone = '') => { $('state').textContent = text; $('state').className = `status ${tone}`; $('state').hidden = !text; };
// The page to capture: the active tab, or ?tabId= when this page runs in a tab of its own.
const tabParam = Number(new URLSearchParams(location.search).get('tabId')) || null;
const openOptions = (hash = '') => chrome.tabs.create({ url: chrome.runtime.getURL(`src/options.html${hash}`) });

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

function other(name, host, state, tone, note = '', allow = null) {
  show('other');
  setState('');
  $('allow').hidden = !allow;
  $('allow').textContent = allow?.label || '';
  $('allow').onclick = allow?.run || null;
  $('dest-name').textContent = name;
  $('dest-host').textContent = host;
  $('dest-state').textContent = state;
  $('dest-state').className = `status ${tone}`;
  $('dest-note').textContent = note;
  $('dest-note').hidden = !note;
}

async function refresh() {
  const destination = await defaultDestination();
  if (destination.kind === 'html2wp') { await html2wpStatus(); return; }
  if (destination.kind === 'chat') {
    const host = new URL(destination.url).host;
    const origins = [sitePattern(destination.url)];
    const granted = await chrome.permissions.contains({ origins });
    // Asked on this click: Chrome shows its prompt for this one site.
    const allow = { label: `Allow ${destination.name}`, run: async () => { await chrome.permissions.request({ origins }).catch(() => false); await refresh(); } };
    other(destination.name, host, granted ? 'Site permission granted' : 'Needs permission', granted ? 'ok' : 'warn',
      granted ? '' : `Shot2AI needs your permission to paste screenshots into ${host}.`, granted ? null : allow);
    return;
  }
  const s = await settings();
  if (destination.kind === 'save') other('Save only', `Downloads/${cleanSubfolder(s.saveSubfolder) || ''}`.replace(/\/$/, ''), 'Ready', 'ok');
  else other('Copy only', 'The clipboard', 'Ready', 'ok');
}

$('change').addEventListener('click', () => openOptions('#default'));
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
$('capture-full').addEventListener('click', async () => {
  let tabId = tabParam;
  if (!tabId) [{ id: tabId } = {}] = await chrome.tabs.query({ active: true, currentWindow: true });
  const result = await chrome.runtime.sendMessage({ type: 'full-page', tabId });
  if (result?.ok && !tabParam) window.close();
});
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
  for (const [id, command] of [['key-area', 'capture-area'], ['key-full', 'capture-full']]) {
    $(id).textContent = keys[command] || '';
    $(id).hidden = !keys[command];
    $(id).title = 'Keyboard shortcut';
  }
});
// Read from the manifest, so the popup always names the build that is loaded.
$('version').textContent = `Shot2AI v${chrome.runtime.getManifest().version}`;
refresh();
