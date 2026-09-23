import { connect, pair } from './bridge.js';
import { paint } from './icons.js';
import { PRESETS, settings, update, sitePattern, fileName, cleanSubfolder, isMac } from './settings.js';
import { getHandle, putHandle, deleteHandle } from './captures.js';
import { FOLDER } from './save.js';
import { acceptPastedImages } from './paste.js';

paint();
const $ = (id) => document.getElementById(id);
const hostOf = (url) => new URL(url).host;

// ---- html2wp ------------------------------------------------------------

async function refreshApp() {
  const found = await connect();
  const state = $('app-state');
  $('pair-form').hidden = true;
  $('app-project').hidden = true;
  if (!found) {
    state.textContent = 'Not running'; state.className = 'status err';
    $('app-note').textContent = 'Open the html2wp app on this Mac to pair or send.';
    return;
  }
  if (!found.status.paired) {
    state.textContent = 'Not paired'; state.className = 'status warn';
    $('pair-form').hidden = false;
    $('app-note').textContent = 'In html2wp, open Settings → Chrome extension and enter the 6-digit code shown there.';
    return;
  }
  state.textContent = 'Paired'; state.className = 'status ok';
  $('app-project').hidden = false;
  $('app-project-name').textContent = found.status.project?.name || 'No project open';
  $('app-note').textContent = found.status.chat?.available ? '' : found.status.chat?.reason || '';
}
$('code').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
  e.target.value = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
});
$('pair-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const result = await pair($('code').value.replace(/\D/g, ''));
  if (result === 'paired') { $('code').value = ''; await refreshApp(); return; }
  $('app-note').textContent = result === 'offline' ? 'html2wp stopped answering. Open the app and try again.' : 'That code did not match. Check Settings in html2wp; after five wrong codes, choose New code there.';
});

// ---- destinations -------------------------------------------------------

function fail(text) { $('dest-error').textContent = text; $('dest-error').hidden = !text; }
// Asked during the click, so Chrome can show its prompt for this one site.
async function allow(url) {
  const granted = await chrome.permissions.request({ origins: [sitePattern(url)] }).catch(() => false);
  if (!granted) fail(`Chrome did not allow the extension to use ${hostOf(url)}. Try again and choose Allow.`);
  return granted;
}
function row(name, url, control) {
  const el = document.createElement('div');
  el.className = 'dest';
  el.innerHTML = '<div><strong></strong><br><small></small></div><span class="push"></span>';
  el.querySelector('strong').textContent = name;
  el.querySelector('small').textContent = hostOf(url);
  el.append(control);
  return el;
}
async function renderDestinations() {
  const s = await settings();
  $('presets').replaceChildren(...PRESETS.map((p) => {
    const label = document.createElement('label');
    label.className = 'toggle';
    label.innerHTML = '<input type="checkbox"><span>Use</span>';
    const box = label.querySelector('input');
    box.checked = !!s.presets[p.id];
    box.setAttribute('aria-label', `Use ${p.name}`);
    box.addEventListener('change', async () => {
      fail('');
      if (box.checked && !(await allow(p.url))) { box.checked = false; return; }
      const current = await settings();
      await update({ presets: { ...current.presets, [p.id]: box.checked } });
    });
    return row(p.name, p.url, label);
  }));
  $('custom').replaceChildren(...s.customChats.map((c) => {
    const remove = document.createElement('button');
    remove.className = 'button text';
    remove.textContent = 'Remove';
    remove.addEventListener('click', async () => {
      const current = await settings();
      await update({ customChats: current.customChats.filter((x) => x.id !== c.id) });
      await renderDestinations();
    });
    return row(c.name, c.url, remove);
  }));
}
$('add-chat').addEventListener('submit', async (e) => {
  e.preventDefault();
  fail('');
  const name = $('chat-name').value.trim();
  let url;
  try { url = new URL($('chat-url').value.trim()); } catch { fail('Enter the chat\'s full address, starting with https://.'); return; }
  if (!/^https?:$/.test(url.protocol)) { fail('Enter an http or https address.'); return; }
  if (!(await allow(url.href))) return;
  const s = await settings();
  await update({ customChats: [...s.customChats, { id: `chat-${crypto.randomUUID().slice(0, 8)}`, name, url: url.href }] });
  $('chat-name').value = '';
  $('chat-url').value = '';
  await renderDestinations();
});

// ---- saving -------------------------------------------------------------

async function renderSaving() {
  const s = await settings();
  $('save-copy').checked = s.saveCopy;
  $('subfolder').value = s.saveSubfolder;
  $('pattern').value = s.filenamePattern;
  $('example').textContent = fileName($('pattern').value, 'https://example.com/pricing');
  const handle = await getHandle(FOLDER).catch(() => null);
  const granted = handle ? (await handle.queryPermission({ mode: 'readwrite' })) === 'granted' : false;
  $('folder-name').textContent = handle ? handle.name : `Downloads/${cleanSubfolder(s.saveSubfolder) || ''}`.replace(/\/$/, '');
  $('folder-state').hidden = !handle;
  $('folder-state').textContent = granted ? 'Allowed' : 'Needs permission';
  $('folder-state').className = `status ${granted ? 'ok' : 'warn'}`;
  $('allow-folder').hidden = !handle || granted;
  $('forget-folder').hidden = !handle;
}
$('save-copy').addEventListener('change', (e) => update({ saveCopy: e.target.checked }));
$('subfolder').addEventListener('change', async (e) => { await update({ saveSubfolder: cleanSubfolder(e.target.value) }); await renderSaving(); });
$('pattern').addEventListener('input', (e) => { $('example').textContent = fileName(e.target.value, 'https://example.com/pricing'); });
$('pattern').addEventListener('change', (e) => update({ filenamePattern: e.target.value.trim() || 'html2wp-{host}-{date}-{time}' }));
$('choose-folder').addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ id: 'html2wp-shots', mode: 'readwrite' });
    await putHandle(FOLDER, handle);
  } catch { /* the owner closed the picker */ }
  await renderSaving();
});
$('allow-folder').addEventListener('click', async () => {
  const handle = await getHandle(FOLDER);
  await handle?.requestPermission({ mode: 'readwrite' }).catch(() => {});
  await renderSaving();
});
$('forget-folder').addEventListener('click', async () => { await deleteHandle(FOLDER); await renderSaving(); });

// ---- paste --------------------------------------------------------------

$('paste-keys').innerHTML = `Press <kbd>${isMac ? '⌘V' : 'Ctrl+V'}</kbd> anywhere on this page to open a pasted image in the editor`;
acceptPastedImages();

await Promise.all([refreshApp(), renderDestinations(), renderSaving()]);
