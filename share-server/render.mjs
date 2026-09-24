import { safeShareURL, shareExcerpt } from '../src/share-snapshot.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const link = (url, label) => safeShareURL(url) ? `<a href="${escape(url)}" rel="noreferrer noopener nofollow">${escape(label || url)}</a>` : escape(label);
function inline(values) {
  return values.map(v => {
    if (typeof v === 'string') return escape(v);
    if (v.t === 'br') return '<br>';
    const content = inline(v.c || []);
    if (v.t === 'a') return safeShareURL(v.href) ? `<a href="${escape(v.href)}" rel="noreferrer noopener nofollow">${content}</a>` : content;
    const tag = { b: 'strong', i: 'em', s: 's', code: 'code', span: 'span' }[v.t];
    return tag ? `<${tag}>${content}</${tag}>` : '';
  }).join('');
}
function blocks(values) {
  return values.map(v => {
    if (v.t === 'p') return `<p>${inline(v.c)}</p>`;
    if (v.t === 'h') return `<h${v.l}>${inline(v.c)}</h${v.l}>`;
    if (v.t === 'pre') return `<pre><code>${escape(v.text)}</code></pre>`;
    if (v.t === 'hr') return '<hr>';
    if (v.t === 'quote') return `<blockquote>${blocks(v.c)}</blockquote>`;
    if (v.t === 'ul' || v.t === 'ol') return `<${v.t} start="${v.start}">${v.items.map(item => `<li>${blocks(item)}</li>`).join('')}</${v.t}>`;
    if (v.t === 'table') return `<div class="table"><table>${v.rows.map((row, i) => `<tr>${row.map(cell => { const tag = i === 0 && v.head ? 'th' : 'td'; return `<${tag}>${inline(cell)}</${tag}>`; }).join('')}</tr>`).join('')}</table></div>`;
    return '';
  }).join('');
}
export function renderConversation(record, origin, id) {
  const { snapshot, expiresAt } = record;
  const title = snapshot.turns[0]?.asked.trim().slice(0, 160) || 'Shot2AI conversation';
  const url = `${origin}/s/${id}`;
  const image = record.png ? `${url}/image.png` : '';
  const preview = record.preview ? `${url}/preview.png` : image;
  const description = shareExcerpt(snapshot.turns[0]?.answer.blocks).slice(0, 240) || 'A shared AI conversation with the original capture and every saved exchange.';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><title>${escape(title)} · Shot2AI</title><meta property="og:type" content="article"><meta property="og:title" content="${escape(title)}"><meta property="og:description" content="${escape(description)}"><meta property="og:url" content="${url}">${preview ? `<meta property="og:image" content="${preview}"><meta property="og:image:type" content="image/png">${record.preview ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}<meta property="og:image:alt" content="${escape(title)}"><meta name="twitter:image" content="${preview}">` : ''}<meta name="twitter:card" content="${preview ? 'summary_large_image' : 'summary'}"><meta property="og:site_name" content="Shot2AI"><meta name="twitter:title" content="${escape(title)}"><meta name="twitter:description" content="${escape(description)}"><link rel="stylesheet" href="/style.css"></head><body><header><a href="https://github.com/iOSDevSK/shot2ai">Shot2AI</a><p>Shared conversation · Available until ${new Date(expiresAt).toISOString().slice(0, 10)}</p></header><main><h1>${escape(title)}</h1>${snapshot.url ? `<p class="source">Source: ${link(snapshot.url)}</p>` : ''}${snapshot.kind === 'text' ? `<h2>Selected text</h2><p class="question">${escape(snapshot.selectedText)}</p>` : image ? `<img class="capture" src="${image}" alt="Original screenshot">` : ''}${snapshot.turns.map(t => `<section><h2>You</h2><p class="question">${escape(t.asked)}</p><h2>${escape(t.answer.name)}</h2>${blocks(t.answer.blocks)}${t.answer.sources.length ? `<h3>Sources</h3><ul>${t.answer.sources.map(s => `<li>${link(s.href, s.title)}</li>`).join('')}</ul>` : ''}${t.answer.truncated || t.answer.state !== 'done' ? '<p class="warning">This answer was incomplete when shared.</p>' : ''}</section>`).join('')}</main><footer>Anyone with this link can read this copy. AI responses may contain mistakes. <a href="/privacy">Privacy</a></footer></body></html>`;
}
export const style = `:root{font:17px/1.65 system-ui,-apple-system,sans-serif;color:#283029;background:#f6f7f2}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:880px;margin:auto;padding:28px}header a{font-weight:750;text-decoration:none}header p,footer{font-size:14px;color:#697368}main{background:white;border:1px solid #dfe2d9;border-radius:14px;overflow-wrap:anywhere}h1{font-size:28px;line-height:1.3}h2{font-size:18px;color:#526f53;margin:24px 0 8px}h3{font-size:16px}a{color:#416744}section{border-top:1px solid #e0e5dc;margin-top:30px;padding-top:8px}.capture{display:block;max-width:100%;height:auto;margin:24px auto}.question{white-space:pre-wrap}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef0e9;padding:18px;border-radius:8px}code{font:14px/1.6 ui-monospace,monospace}blockquote{border-left:3px solid #a5b79d;padding-left:18px;margin-left:0}.table{overflow:auto}table{border-collapse:collapse}td,th{border:1px solid #dfe2d9;padding:8px}.warning{color:#806020}.source{font-size:14px}@media(max-width:600px){main{padding:20px;border-radius:0}h1{font-size:24px}}`;
