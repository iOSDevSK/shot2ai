import { getExport } from './share-store.js';
import { blocksTo, answerText } from './answer-format.js';

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const format = params.get('format');
let snapshot, imageURL;
const status = text => { $('status').textContent = text; };
const element = (tag, text, cls) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (cls) el.className = cls; return el; };
const safeURL = value => { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
const fileName = extension => `shot2ai-conversation-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
function download(blob, extension) {
  const url = URL.createObjectURL(blob), link = element('a'); link.href = url; link.download = fileName(extension);
  document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
const pngData = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
const literal = text => String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/([\\`*_{}\[\]#+.!|])/g, '\\$1');
async function markdown() {
  const parts = ['# Shot2AI conversation'];
  if (safeURL(snapshot.url)) parts.push(`Source: <${safeURL(snapshot.url).replace(/>/g, '%3E')}>`);
  if (snapshot.kind === 'text') parts.push('## Selected text', literal(snapshot.selectedText));
  else if (snapshot.png) parts.push('## Original screenshot', `![Original screenshot](${await pngData(snapshot.png)})`);
  for (const turn of snapshot.turns) {
    parts.push('## You', literal(turn.asked), `## ${literal(turn.answer.name || 'Assistant')}`, answerText(turn.answer));
    if (turn.answer.truncated || turn.answer.state !== 'done') parts.push('> This answer was incomplete when exported.');
  }
  return parts.join('\n\n') + '\n';
}
async function saveMarkdown() {
  try { download(new Blob([await markdown()], { type: 'text/markdown;charset=utf-8' }), 'md'); status('Markdown downloaded with the original image embedded. Some Markdown viewers hide embedded images; PDF displays it directly.'); }
  catch { status('The Markdown file could not be created. Please try again.'); }
}
function printPDF() { status('Choose “Save as PDF” in the print dialog. All exchanges and the original image are included.'); window.print(); }
async function start() {
  if (!['pdf', 'md'].includes(format)) throw new Error('Use Share on your conversation card to create a public link.');
  snapshot = await getExport(params.get('id'));
  if (!snapshot) throw new Error('This export has expired or was cleared. Open Share again from your conversation card.');
  const main = $('conversation');
  main.append(element('h1', 'Shot2AI conversation'));
  if (safeURL(snapshot.url)) { const source = element('p', 'Source: '); const link = element('a', safeURL(snapshot.url), 'source-url'); link.href = safeURL(snapshot.url); link.rel = 'noreferrer noopener'; link.target = '_blank'; source.append(link); main.append(source); }
  if (snapshot.kind === 'text') main.append(element('h2', 'Selected text'), element('p', snapshot.selectedText, 'selection'));
  else if (snapshot.png) { imageURL = URL.createObjectURL(snapshot.png); const img = element('img'); img.alt = 'Original screenshot'; img.src = imageURL; main.append(img); await img.decode(); }
  for (const turn of snapshot.turns) {
    const section = element('section', undefined, 'turn');
    section.append(element('h2', 'You'), element('p', turn.asked, 'question'), element('h2', turn.answer.name || 'Assistant'));
    blocksTo(turn.answer.blocks, section);
    if (turn.answer.sources?.length) {
      const list = element('ul', undefined, 'sources');
      for (const source of turn.answer.sources) { const url = safeURL(source.href); if (!url) continue; const li = element('li'); const link = element('a', source.title && source.title !== url ? `${source.title} — ${url}` : url, 'source-url'); link.href = url; link.rel = 'noreferrer noopener'; link.target = '_blank'; li.append(link); list.append(li); }
      if (list.childElementCount) section.append(element('h3', 'Sources'), list);
    }
    if (turn.answer.truncated || turn.answer.state !== 'done') section.append(element('p', 'This answer was incomplete when exported.', 'warning'));
    main.append(section);
  }
  $('markdown').disabled = $('pdf').disabled = false;
  $('markdown').onclick = saveMarkdown; $('pdf').onclick = printPDF;
    $('help').textContent = 'Your complete conversation and original image stay on your device. Review the export below.';
    $('primary').disabled = false;
    $('primary').textContent = format === 'md' ? 'Download Markdown' : 'Save as PDF';
    $('primary').onclick = format === 'md' ? saveMarkdown : printPDF;
    if (format === 'md') await saveMarkdown();
    else if (format === 'pdf') printPDF();
}
start().catch(error => { $('help').textContent = error.message; $('primary').textContent = 'Export unavailable'; });
window.addEventListener('pagehide', () => { if (imageURL) URL.revokeObjectURL(imageURL); });
