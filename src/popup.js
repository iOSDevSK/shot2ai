import { connect, pair } from './bridge.js';
import { paint } from './icons.js';
import { isMac } from './settings.js';
import { acceptPastedImages } from './paste.js';

paint();
const $ = (id) => document.getElementById(id);
const panels = ['checking', 'offline', 'pairing', 'ready'];
const show = (name) => panels.forEach((p) => { $(p).hidden = p !== name; });
const setState = (text, tone = '') => { $('state').textContent = text; $('state').className = `status ${tone}`; };
// The page to capture: the active tab, or ?tabId= when this page runs in a tab of its own.
const tabParam = Number(new URLSearchParams(location.search).get('tabId')) || null;

async function refresh() {
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
$('options').addEventListener('click', () => chrome.runtime.openOptionsPage());
$('paste-hint').innerHTML = `Or paste an image with <kbd>${isMac ? '⌘V' : 'Ctrl+V'}</kbd> to annotate it`;
acceptPastedImages(() => { if (!tabParam) window.close(); });
chrome.commands.getAll().then((commands) => {
  const key = commands.find((c) => c.name === 'capture-area')?.shortcut;
  $('shortcut').innerHTML = key ? `<kbd>${key.replace(/</g, '')}</kbd> captures from any page` : '';
});
refresh();
