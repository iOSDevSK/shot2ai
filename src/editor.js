// The screenshot editor: annotate the captured area, add a message and send
// both into the chat of the project open in html2wp.
//
// Tools, colours, stroke sizes and the arrow's geometry follow better-shot
// (https://github.com/iOSDevSK/better-shot, BSD-3-Clause, see
// licenses/better-shot-LICENSE), adapted from SwiftUI to a 2D canvas.
import { connect, pair, sendToApp, outcomeText } from './bridge.js';
import { getCapture, deleteCapture } from './captures.js';
import { icons, paint } from './icons.js';
import { destinations, defaultDestination, settings, update, sitePattern, fileName, modKey, isMac, actionLabel, COPY_ONLY, prompts, defaultPromptText, chatResultText, websiteNotice } from './settings.js';
import { saveImage, savedText } from './save.js';
import { pasteIntoChat } from './webchat.js';
import { encode, EXTENSIONS } from './imaging.js';

paint();
document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;
const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

// better-shot's AnnotationSwatch values, in sRGB.
const SWATCHES = [
  ['Red', '#f73833'], ['Orange', '#ff8714'], ['Yellow', '#ffd12e'], ['Green', '#2eb85c'],
  ['Blue', '#2e7aff'], ['Purple', '#8c4df2'], ['Black', '#050506'], ['White', '#f5f5f5'],
];
// better-shot draws with a 4 pt stroke by default.
const SIZES = [['Thin', 2], ['Regular', 4], ['Bold', 7]];
const TOOL_KEYS = { a: 'arrow', r: 'rect', t: 'text', h: 'highlight', b: 'blur' };

let image = null;        // the captured area, as an ImageBitmap
let scale = 1;           // device pixels per CSS pixel of the captured page
let tool = 'arrow';
let color = SWATCHES[0][1];
let size = 4;
let items = [];
let undone = [];
let draft = null;
let editingText = null;  // { x, y } in image pixels while the text field is open
let target = null;       // { port, project } once the app says the chat is open

// ---- drawing ------------------------------------------------------------

// better-shot's AnnotationArrowGeometry for a straight arrow: an open head
// whose length follows the stroke, never more than a third of the arrow.
function arrowHead(a, b, lineWidth) {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length < 0.5) return null;
  const back = { x: (a.x - b.x) / length, y: (a.y - b.y) / length };
  const head = Math.min(Math.max(13 * scale, lineWidth * 4.4), length * 0.34);
  const turn = (v, angle) => ({ x: v.x * Math.cos(angle) - v.y * Math.sin(angle), y: v.x * Math.sin(angle) + v.y * Math.cos(angle) });
  const one = turn(back, Math.PI * 0.2);
  const two = turn(back, -Math.PI * 0.2);
  return [{ x: b.x + one.x * head, y: b.y + one.y * head }, b, { x: b.x + two.x * head, y: b.y + two.y * head }];
}
const box = (item) => ({ x: Math.min(item.a.x, item.b.x), y: Math.min(item.a.y, item.b.y), w: Math.abs(item.b.x - item.a.x), h: Math.abs(item.b.y - item.a.y) });
const fontSize = (item) => (12 + item.size * 2.5) * scale;

function drawItem(item) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lineWidth = item.size * scale;
  if (item.tool === 'arrow') {
    ctx.strokeStyle = item.color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(item.a.x, item.a.y);
    ctx.lineTo(item.b.x, item.b.y);
    const head = arrowHead(item.a, item.b, lineWidth);
    if (head) { ctx.moveTo(head[0].x, head[0].y); ctx.lineTo(head[1].x, head[1].y); ctx.lineTo(head[2].x, head[2].y); }
    ctx.stroke();
  } else if (item.tool === 'rect') {
    const { x, y, w, h } = box(item);
    ctx.strokeStyle = item.color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(12 * scale, Math.max(3 * scale, Math.min(w, h) * 0.08)));
    ctx.stroke();
  } else if (item.tool === 'highlight') {
    const { x, y, w, h } = box(item);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 3 * scale);
    ctx.fill();
  } else if (item.tool === 'blur') {
    const { x, y, w, h } = box(item);
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = `blur(${Math.max(6, Math.min(w, h) / 8, 9 * scale)}px)`;
    ctx.drawImage(image, 0, 0);
  } else if (item.tool === 'text') {
    const px = fontSize(item);
    ctx.font = `700 ${px}px ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'top';
    const light = item.color === '#f5f5f5' || item.color === '#ffd12e';
    item.text.split('\n').forEach((line, i) => {
      const ly = item.y + i * px * 1.25;
      ctx.lineWidth = px * 0.2;
      ctx.strokeStyle = light ? 'rgba(20,24,20,.85)' : 'rgba(255,255,255,.92)';
      ctx.strokeText(line, item.x, ly);
      ctx.fillStyle = item.color;
      ctx.fillText(line, item.x, ly);
    });
  }
  ctx.restore();
}

function render() {
  if (!image) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0);
  for (const item of items) drawItem(item);
  if (draft) drawItem(draft);
  $('undo').disabled = !items.length;
  $('redo').disabled = !undone.length;
}

function fit() {
  if (!image) return;
  const area = $('canvas-area');
  const width = image.width / scale;
  const height = image.height / scale;
  const room = Math.min(1.6, (area.clientWidth - 8) / width, (area.clientHeight - 26) / height);
  canvas.style.width = `${Math.floor(width * room)}px`;
  canvas.style.height = `${Math.floor(height * room)}px`;
}

// ---- input --------------------------------------------------------------

function point(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(canvas.width, (e.clientX - r.left) * (canvas.width / r.width))),
    y: Math.max(0, Math.min(canvas.height, (e.clientY - r.top) * (canvas.height / r.height))),
  };
}
function commit(item) {
  items.push(item);
  undone = [];
  render();
}

canvas.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || !image) return;
  if (editingText) { finishText(true); return; }
  const p = point(e);
  if (tool === 'text') { e.preventDefault(); openText(p); return; }
  canvas.setPointerCapture(e.pointerId);
  draft = { tool, color, size, a: p, b: p };
});
// The text field keeps focus: the click that opened it must not take it away.
canvas.addEventListener('mousedown', (e) => { if (tool === 'text' || editingText) e.preventDefault(); });
canvas.addEventListener('pointermove', (e) => {
  if (!draft) return;
  draft.b = point(e);
  render();
});
canvas.addEventListener('pointerup', () => {
  if (!draft) return;
  const item = draft;
  draft = null;
  const big = item.tool === 'arrow' ? Math.hypot(item.b.x - item.a.x, item.b.y - item.a.y) >= 6 * scale : box(item).w >= 4 * scale && box(item).h >= 4 * scale;
  if (big) commit(item); else render();
});

const textField = $('text-input');
function openText(p) {
  const r = canvas.getBoundingClientRect();
  const ratio = r.width / canvas.width;
  editingText = p;
  Object.assign(textField.style, {
    left: `${p.x * ratio}px`, top: `${p.y * ratio}px`,
    fontSize: `${fontSize({ size }) * ratio}px`, color,
  });
  textField.textContent = '';
  textField.hidden = false;
  textField.focus();
}
function finishText(keep) {
  if (!editingText) return;
  const text = textField.innerText.replace(/\n+$/, '');
  const at = editingText;
  editingText = null;
  textField.hidden = true;
  if (keep && text.trim()) commit({ tool: 'text', color, size, x: at.x, y: at.y, text });
}
textField.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { e.preventDefault(); finishText(false); }
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishText(true); }
});
textField.addEventListener('blur', () => finishText(true));

function undo() { if (items.length) { undone.push(items.pop()); render(); } }
function redo() { if (undone.length) { items.push(undone.pop()); render(); } }
$('undo').addEventListener('click', undo);
$('redo').addEventListener('click', redo);

function selectTool(next) {
  tool = next;
  for (const b of document.querySelectorAll('[data-tool]')) b.setAttribute('aria-checked', String(b.dataset.tool === tool));
  $('frame').dataset.tool = tool;
}
for (const b of document.querySelectorAll('[data-tool]')) b.addEventListener('click', () => selectTool(b.dataset.tool));

for (const [name, value] of SWATCHES) {
  const b = document.createElement('button');
  b.className = 'swatch';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', name);
  b.title = name;
  b.innerHTML = `<i style="--c:${value}"></i>`;
  b.addEventListener('click', () => {
    color = value;
    for (const s of $('swatches').children) s.setAttribute('aria-checked', String(s === b));
    if (editingText) textField.style.color = color;
  });
  b.setAttribute('aria-checked', String(value === color));
  $('swatches').append(b);
}
for (const [name, value] of SIZES) {
  const b = document.createElement('button');
  b.className = 'size';
  b.setAttribute('role', 'radio');
  b.setAttribute('aria-label', `${name} stroke`);
  b.title = `${name} stroke`;
  b.innerHTML = `<i style="width:${value + 3}px;height:${value + 3}px"></i>`;
  b.addEventListener('click', () => {
    size = value;
    for (const s of $('sizes').children) s.setAttribute('aria-checked', String(s === b));
  });
  b.setAttribute('aria-checked', String(value === size));
  $('sizes').append(b);
}

document.addEventListener('keydown', (e) => {
  const typing = e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.target === textField;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); void submit(); return; }
  if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && TOOL_KEYS[e.key.toLowerCase()]) selectTool(TOOL_KEYS[e.key.toLowerCase()]);
});

// ---- output -------------------------------------------------------------

function flattened() {
  finishText(true);
  render();
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
let toastTimer = 0;
function toast(text) {
  $('toast').textContent = text;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2200);
}
async function toClipboard(withText) {
  const items = { 'image/png': flattened() };
  const text = $('message').value.trim();
  if (withText && text) items['text/plain'] = new Blob([text], { type: 'text/plain' });
  try { await navigator.clipboard.write([new ClipboardItem(items)]); return true; } catch { return false; }
}
$('copy').addEventListener('click', async () => {
  if (!image) return;
  toast((await toClipboard(false)) ? 'Copied to clipboard' : 'Chrome did not allow copying. Use Save instead.');
});
async function saveCopy() {
  if (!image) return;
  try { toast(savedText(await saveImage(await flattened(), source.url, { ask: true }))); } catch { toast('The screenshot could not be saved.'); }
}
$('save').addEventListener('click', () => void saveCopy());

// ---- sending ------------------------------------------------------------

function showResult(tone, text, actions = []) {
  const box = $('result');
  box.className = `notice ${tone}`;
  box.textContent = text;
  if (actions.length) {
    const row = document.createElement('div');
    row.className = 'actions';
    for (const [name, run, primary] of actions) {
      const b = document.createElement('button');
      b.className = `button${primary ? ' primary' : ''}`;
      b.textContent = name;
      b.addEventListener('click', run);
      row.append(b);
    }
    box.append(row);
  }
  box.hidden = !text;
}
function setTarget(name, note, state, tone = '') {
  $('target-name').textContent = name;
  $('target-note').textContent = note;
  $('target-state').textContent = state;
  $('target-state').className = `status ${tone}`;
}
function setSend(label, busy = false) {
  $('send-label').textContent = label;
  $('send').disabled = busy;
  $('more').disabled = busy;
  const icon = { 'Try again': 'retry', Sent: 'check', Copy: 'copy', Save: 'download' }[label] || 'send';
  $('send').querySelector('svg').outerHTML = icons[icon];
}

// The main button's destination: the owner's default, or Copy while none is chosen.
let destination = COPY_ONLY;
function choose(next) {
  destination = next;
  setSend(actionLabel(next));
  $('privacy').textContent = next.kind === 'chat'
    ? `${next.name} is a website: the screenshot and message go to ${new URL(next.url).host}. Nothing is submitted until you press Enter there.`
    : next.kind === 'html2wp' ? 'The screenshot and message go only to the html2wp app on this Mac (127.0.0.1).'
      : 'Nothing leaves this computer. Choose where screenshots go in Options.';
  $('pair-form').hidden = true;
  if (!image) $('send').disabled = $('more').disabled = true;
  if (next.kind === 'chat') setTarget(next.name, new URL(next.url).host, 'Website', 'warn');
  else if (next.kind === 'copy') setTarget('Clipboard', 'Paste it anywhere', 'Copy', 'ok');
  else if (next.kind === 'save') setTarget('Save only', 'A copy on this computer', 'Save', 'ok');
  else void check();
}

// Ask the app where the message would go and whether its chat is open now.
async function check() {
  const found = await connect();
  if (destination.kind !== 'html2wp') return;
  $('pair-form').hidden = true;
  if (!found) { setTarget('html2wp', 'The app is not running', 'Offline', 'err'); return; }
  const { status } = found;
  if (!status.paired) { setTarget('html2wp', 'Not paired with this browser', 'Not paired', 'warn'); $('pair-form').hidden = false; return; }
  const name = status.project?.name || 'No project open';
  if (!status.chat?.available) setTarget(name, status.project ? 'Open project' : 'html2wp', 'Busy', 'warn');
  else setTarget(name, 'Open project', 'Chat ready', 'ok');
}

let sending = false;
async function submit(target = destination, confirmed = false) {
  if (sending || !image) return;
  $('menu').hidden = true;
  if (target.kind === 'copy') { toast((await toClipboard(true)) ? 'Copied to clipboard' : 'Chrome did not allow copying. Use Save instead.'); return; }
  if (target.kind === 'save') { await saveCopy(); return; }
  if (target !== destination) choose(target);
  const text = $('message').value.trim();
  if (target.kind === 'chat') {
    // Asked during the click: Chrome shows its own prompt the first time.
    const granted = await chrome.permissions.request({ origins: [sitePattern(target.url)] }).catch(() => false);
    if (!granted) { showResult('warn', `Chrome did not allow the extension to use ${new URL(target.url).host}. Send again and choose Allow.`); return; }
    const s = await settings();
    if (!confirmed && !s.acknowledged[target.origin]) {
      showResult('warn', websiteNotice(target.name, new URL(target.url).host, false, !!s.autoSubmit[target.id]),
        [['Continue', () => void submit(target, true), true], ['Cancel', () => showResult('', '')]]);
      return;
    }
    await update({ acknowledged: { ...s.acknowledged, [target.origin]: true } });
    sending = true;
    setSend('Sending…', true);
    const png = await flattened();
    // Copied first, while this page has focus: the fallback if pasting fails.
    const copied = await toClipboard(true);
    const encoded = await encode(png, s);
    const r = await pasteIntoChat(target, encoded, text, fileName(s.filenamePattern, source.url, new Date(), EXTENSIONS[encoded.type]));
    sending = false;
    setSend(actionLabel(destination));
    if (r.ok) { showResult(r.submitted || !r.autoSubmit ? 'ok' : 'warn', chatResultText(target.name, r)); return; }
    showResult(copied ? 'warn' : 'err', copied ? `Copied. Paste with ${modKey}V in ${target.name}.` : `The screenshot could not be pasted into ${target.name}. Use Copy, then paste it there.`);
    return;
  }
  sending = true;
  setSend('Sending…', true);
  showResult('', '');
  const outcome = await sendToApp(text, await flattened());
  sending = false;
  if (outcome.ok) {
    showResult('ok', outcomeText(outcome));
    setSend('Sent', true);
    if (captureId) await deleteCapture(captureId).catch(() => {});
    setTimeout(() => window.close(), 1800);
    return;
  }
  // The app's own reason, shown as it is; the annotation stays.
  showResult(outcome.reason !== undefined ? 'warn' : outcome.unpaired ? 'warn' : 'err', outcomeText(outcome));
  setSend('Try again');
  await check();
}
$('send').addEventListener('click', () => void submit());
$('prompt').addEventListener('change', () => { $('message').value = $('prompt').value; $('prompt').selectedIndex = 0; $('message').focus(); });
$('more').addEventListener('click', async () => {
  const menu = $('menu');
  if (!menu.hidden) { menu.hidden = true; return; }
  menu.innerHTML = '<div class="head">Send to</div>';
  for (const d of await destinations()) {
    const b = document.createElement('button');
    b.setAttribute('role', 'menuitem');
    b.innerHTML = '<span></span><small></small>';
    b.querySelector('span').textContent = d.name;
    b.querySelector('small').textContent = d.kind === 'html2wp' ? 'this Mac' : new URL(d.url).host;
    b.addEventListener('click', () => void submit(d));
    menu.append(b);
  }
  menu.insertAdjacentHTML('beforeend', '<a href="options.html" target="_blank">Add a chat in Options…</a>');
  menu.hidden = false;
});
document.addEventListener('click', (e) => { if (!e.target.closest('.split')) $('menu').hidden = true; });

$('code').addEventListener('input', (e) => {
  const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
  e.target.value = digits.length > 3 ? `${digits.slice(0, 3)} ${digits.slice(3)}` : digits;
});
$('pair-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('code').value.replace(/\D/g, '');
  if (code.length !== 6) { showResult('warn', 'Enter all 6 digits of the code.'); return; }
  $('pair').disabled = true;
  const result = await pair(code);
  $('pair').disabled = false;
  if (result === 'paired') { $('code').value = ''; showResult('', ''); await check(); return; }
  showResult('err', result === 'offline'
    ? 'html2wp stopped answering. Open the app and try again.'
    : 'That code did not match. Check Settings in html2wp; after five wrong codes, choose New code there.');
});

// ---- start --------------------------------------------------------------

const params = new URLSearchParams(location.search);
const captureId = params.get('id');
let source = { url: '', title: '' };

async function load(png, meta, pixelScale) {
  image = await createImageBitmap(png);
  scale = pixelScale || 1;
  items = [];
  undone = [];
  canvas.width = image.width;
  canvas.height = image.height;
  source = meta;
  $('page-title').textContent = meta.title || 'Screenshot';
  $('page-url').textContent = meta.url || '';
  document.title = `${meta.title || 'Screenshot'} · Shot2AI`;
  $('missing').hidden = true;
  $('frame').hidden = false;
  $('send').disabled = $('more').disabled = false;
  fit();
  render();
  $('message').focus();
}

// A pasted image (a ⌘⇧4 screenshot, say) replaces the one being edited.
document.addEventListener('paste', (e) => {
  const file = [...(e.clipboardData?.files || [])].find((f) => f.type.startsWith('image/'));
  if (!file) return;
  e.preventDefault();
  finishText(false);
  void load(file, { title: 'Pasted image', url: '' }, devicePixelRatio);
  showResult('', '');
});

async function start() {
  selectTool('arrow');
  const capture = captureId ? await getCapture(captureId).catch(() => null) : null;
  const keys = isMac ? '<kbd>⌘V</kbd>' : '<kbd>Ctrl+V</kbd>';
  if (!capture?.png) {
    if (captureId) $('missing-title').textContent = 'This screenshot is no longer available';
    $('missing-text').innerHTML = captureId
      ? `Capture the area again, or paste an image with ${keys}.`
      : `Press ${keys} to paste an image${isMac ? ', for example a screenshot taken with <kbd>⌘⇧4</kbd>' : ''}.`;
    $('missing').hidden = false;
    $('send').disabled = $('more').disabled = true;
  } else {
    await load(capture.png, { title: capture.title, url: capture.url }, capture.scale);
  }
  if (params.get('text')) $('message').value = params.get('text');
  else if (!$('message').value) $('message').value = await defaultPromptText();
  // A saved prompt fills the message; it can still be edited.
  for (const p of await prompts()) $('prompt').append(new Option(p.name, p.text));
  $('prompt').hidden = $('prompt').options.length < 2;
  choose((await defaultDestination()) || COPY_ONLY);
}
addEventListener('resize', fit);
await start();
