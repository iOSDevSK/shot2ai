import { connect, pair } from './bridge.js';
import { paint } from './icons.js';
import { PRESETS, settings, update, sitePattern, fileName, cleanSubfolder, isMac, choices, FIRST_DEFAULT } from './settings.js';
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

// ---- default destination ------------------------------------------------

// Options opened from the popup's first-run list: #default=chatgpt.
const suggested = (location.hash.match(/^#default=([\w-]+)/) || [])[1] || null;
const describe = (d) => d.kind === 'html2wp' ? 'The html2wp app on this Mac' : d.kind === 'chat' ? hostOf(d.url)
  : d.kind === 'save' ? 'Save a copy on this computer; nothing is sent' : 'Copy to the clipboard; paste it anywhere';
async function renderDefault() {
  const s = await settings();
  const list = await choices();
  const chosen = list.find((d) => d.id === s.defaultDestination) || list.find((d) => d.id === FIRST_DEFAULT);
  const granted = chosen.kind !== 'chat' || await chrome.permissions.contains({ origins: [sitePattern(chosen.url)] });
  $('default-state').textContent = granted ? chosen.name : `${chosen.name} · needs permission`;
  $('default-state').className = `status ${granted ? 'ok' : 'warn'}`;
  $('allow-default').hidden = granted;
  $('allow-default').textContent = `Allow ${chosen.name}`;
  $('allow-default').onclick = async () => { await allow(chosen.url); await renderDefault(); };
  $('default-list').replaceChildren(...list.map((d) => {
    const row = document.createElement('label');
    row.className = `pick${d.id === suggested ? ' suggested' : ''}`;
    row.innerHTML = '<input type="radio" name="default"><div><strong></strong><br><small></small></div>';
    const radio = row.querySelector('input');
    radio.value = d.id;
    radio.checked = d.id === chosen.id;
    row.querySelector('strong').textContent = d.kind === 'html2wp' ? 'html2wp (Mac app)' : d.id === FIRST_DEFAULT ? `${d.name} (default)` : d.name;
    row.querySelector('small').textContent = describe(d);
    radio.addEventListener('change', async () => {
      fail('');
      // A web chat needs its site's permission first; asked during this click.
      if (d.kind === 'chat' && !(await allow(d.url))) { await renderDefault(); return; }
      const current = await settings();
      const presets = PRESETS.some((p) => p.id === d.id) ? { ...current.presets, [d.id]: true } : current.presets;
      await update({ defaultDestination: d.id, presets });
      await Promise.all([renderDefault(), renderDestinations()]);
    });
    return row;
  }));
}
if (suggested) {
  requestAnimationFrame(() => {
    if (suggested === 'custom') { $('add-chat').scrollIntoView({ block: 'center' }); $('chat-name').focus(); }
    else $('default').scrollIntoView({ block: 'start' });
  });
}

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
    box.checked = !!s.presets[p.id] || s.defaultDestination === p.id;
    // The default destination stays on; choose another default to turn it off.
    box.disabled = s.defaultDestination === p.id;
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
      await update({ customChats: current.customChats.filter((x) => x.id !== c.id), ...(current.defaultDestination === c.id ? { defaultDestination: FIRST_DEFAULT } : {}) });
      await Promise.all([renderDefault(), renderDestinations()]);
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
  await Promise.all([renderDefault(), renderDestinations()]);
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
$('pattern').addEventListener('change', (e) => update({ filenamePattern: e.target.value.trim() || 'shot2ai-{host}-{date}-{time}' }));
$('choose-folder').addEventListener('click', async () => {
  try {
    const handle = await window.showDirectoryPicker({ id: 'shot2ai', mode: 'readwrite' });
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

// ---- image format -------------------------------------------------------

async function renderFormat() {
  const s = await settings();
  for (const r of document.querySelectorAll('input[name="format"]')) r.checked = r.value === (s.imageFormat || 'png');
  $('quality').value = s.imageQuality;
  $('quality').disabled = s.imageFormat === 'png';
  $('quality-value').textContent = s.imageFormat === 'png' ? 'Lossless' : `${s.imageQuality} %`;
}
for (const r of document.querySelectorAll('input[name="format"]')) r.addEventListener('change', async () => { await update({ imageFormat: r.value }); await renderFormat(); });
$('quality').addEventListener('input', (e) => { $('quality-value').textContent = `${e.target.value} %`; });
$('quality').addEventListener('change', async (e) => { await update({ imageQuality: Number(e.target.value) }); await renderFormat(); });

// ---- paste --------------------------------------------------------------

$('paste-keys').innerHTML = `Press <kbd>${isMac ? '⌘V' : 'Ctrl+V'}</kbd> anywhere on this page to open a pasted image in the editor`;
acceptPastedImages();

await Promise.all([renderDefault(), refreshApp(), renderDestinations(), renderSaving(), renderFormat()]);
