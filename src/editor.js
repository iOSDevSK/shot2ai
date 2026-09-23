// The screenshot editor: annotate the captured area, add a message and send
// both into the chat of the project open in html2wp.
//
// Tools, colours, stroke sizes and the arrow's geometry follow better-shot
// (https://github.com/iOSDevSK/better-shot, BSD-3-Clause, see
// licenses/better-shot-LICENSE), adapted from SwiftUI to a 2D canvas.
import { connect, pair, send } from './bridge.js';
import { getCapture, deleteCapture } from './captures.js';
import { icons, paint } from './icons.js';

paint();
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
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 1600);
}
$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': flattened() })]);
    toast('Copied to clipboard');
  } catch {
    toast('Chrome did not allow copying. Use Download instead.');
  }
});
$('download').addEventListener('click', async () => {
  const blob = await flattened();
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const link = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `html2wp-screenshot-${stamp}.png` });
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  toast('Saved to Downloads');
});

async function base64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// ---- sending ------------------------------------------------------------

function showResult(tone, text) {
  $('result').className = `notice ${tone}`;
  $('result').textContent = text;
  $('result').hidden = !text;
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
  const icon = label === 'Try again' ? 'retry' : label === 'Sent' ? 'check' : 'send';
  $('send').querySelector('svg').outerHTML = icons[icon];
}

// Ask the app where the message would go and whether its chat is open now.
async function check() {
  target = null;
  const found = await connect();
  $('pair-form').hidden = true;
  if (!found) {
    setTarget('html2wp', 'The app is not running', 'Offline', 'err');
    return { problem: 'html2wp is not running. Open the app on this Mac, then try again.' };
  }
  const { status } = found;
  if (!status.paired) {
    setTarget('html2wp', 'Not paired with this browser', 'Not paired', 'warn');
    $('pair-form').hidden = false;
    return { problem: 'Pair with html2wp first.' };
  }
  const name = status.project?.name || 'No project open';
  if (!status.chat?.available) {
    setTarget(name, status.project ? 'Open project' : 'html2wp', 'Busy', 'warn');
    return { reason: status.chat?.reason || '' };
  }
  setTarget(name, 'Open project', 'Chat ready', 'ok');
  target = { port: found.port, project: status.project };
  return {};
}

let sending = false;
async function submit() {
  if (sending || !image) return;
  sending = true;
  setSend('Sending…', true);
  showResult('', '');
  const state = await check();
  if (state.problem) { showResult(state.problem.startsWith('Pair') ? 'warn' : 'err', state.problem); setSend('Try again'); sending = false; return; }
  // The app's own reason, shown as it is; the annotation stays.
  if (state.reason !== undefined) { showResult('warn', state.reason); setSend('Try again'); sending = false; return; }
  const png = await flattened();
  const outcome = await send(target.port, target.project.id, $('message').value.trim(), await base64(png));
  sending = false;
  if (outcome.ok) {
    showResult('ok', `Sent to ${target.project.name}`);
    setSend('Sent', true);
    $('send').disabled = true;
    await deleteCapture(captureId).catch(() => {});
    setTimeout(() => window.close(), 1800);
    return;
  }
  if (outcome.reason) showResult('warn', outcome.reason);
  else if (outcome.unpaired) { showResult('warn', 'html2wp no longer knows this browser. Pair again with a new code.'); await check(); }
  else if (outcome.tooLarge) showResult('err', 'The screenshot is larger than 10 MB. Capture a smaller area.');
  else showResult('err', 'html2wp stopped answering. Check that the app is open, then try again.');
  setSend('Try again');
}
$('send').addEventListener('click', () => void submit());

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

const captureId = new URLSearchParams(location.search).get('id');
async function load() {
  const capture = captureId ? await getCapture(captureId).catch(() => null) : null;
  if (!capture?.png) { $('missing').hidden = false; $('send').disabled = true; return; }
  image = await createImageBitmap(capture.png);
  scale = capture.scale || 1;
  canvas.width = image.width;
  canvas.height = image.height;
  $('page-title').textContent = capture.title || 'Screenshot';
  $('page-url').textContent = capture.url || '';
  document.title = `Screenshot · ${capture.title || 'html2wp'}`;
  $('frame').hidden = false;
  selectTool('arrow');
  fit();
  render();
  $('message').focus();
}
addEventListener('resize', fit);
await load();
await check();
