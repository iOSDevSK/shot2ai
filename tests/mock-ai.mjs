// A stand-in for claude.ai and chatgpt.com, built like the real pages as far
// as Shot2AI looks at them: a ProseMirror-like composer that takes pasted
// text, a hidden file input whose upload goes to this server, a send button
// that stays disabled until the upload has finished, a stop button while the
// answer streams, and the answer itself, streamed from this server (a
// network stream, as on the real sites, so a background tab does not slow it).
//
// `state.mode` sets how the next page that loads behaves:
//   ok          upload, send, a streamed answer
//   xss         the same, with markup that must arrive inert in the card
//   upload-fail the upload fails: an alert on the attachment, send stays disabled
//   nosend      no send button at all
//   notext      the composer refuses text
//   busy        a stop button is there from the start (still answering)
//   silent      the send goes, then nothing: no stop button, no answer (a usage limit)
import http from 'node:http';

// The answer, in chunks as the site would stream it. `{n}` is the answer's number.
export const ANSWER = [
  '<p>Answer {n}: the <strong>Book a consultation</strong> button',
  ' is pushed to the right by <code>transform: translateX(38px)</code>.</p>',
  '<ul><li>Remove the transform</li>',
  '<li>Or set it to <code>none</code></li></ul>',
  '<pre>{codeblock}</pre>',
  '<p>See <a href="https://developer.mozilla.org/en-US/docs/Web/CSS/transform">MDN</a>.</p>',
];
export const CODE = '.cta {\n  transform: none;\n}';
export const XSS = [
  '<p>Here is &lt;script&gt;alert(1)&lt;/script&gt; as text.</p>',
  '<p><img src="x" onerror="window.__xss=1">An image that fails.</p><script>window.__xss=2</script>',
  '<p><a href="javascript:window.__xss=3">a javascript: link</a> and <a href="https://example.com/" onclick="window.__xss=4">a real one</a></p>',
  '<p onmouseover="window.__xss=5" style="background:url(javascript:alert(1))">Hover text</p><svg onload="window.__xss=6"><text>svg</text></svg><iframe src="about:blank"></iframe>',
];

const FLAVOURS = {
  claude: {
    title: 'Claude',
    composer: '<div contenteditable="true" class="ProseMirror" aria-label="Write your prompt to Claude"></div>',
    file: '<input type="file" data-testid="file-upload" id="upload" multiple accept="image/*,.pdf" hidden>',
    send: '<button type="button" id="send" aria-label="Send message" disabled>↑</button>',
    stop: '<button type="button" id="stop" aria-label="Stop response">■</button>',
    user: 'data-testid="user-message"',
    answer: '<div data-is-streaming="true" class="answer"><div class="font-claude-response"></div></div>',
    content: '.font-claude-response',
    streaming: (wrap, on) => wrap.setAttribute('data-is-streaming', String(on)),
    code: (text) => `<code class="language-css">${text}</code>`,
    after: '/claude/chat/7c1e',
  },
  chatgpt: {
    title: 'ChatGPT',
    composer: '<div contenteditable="true" id="prompt-textarea" class="ProseMirror"></div>',
    file: '<input type="file" id="upload" multiple accept="image/*" hidden>',
    send: '<button type="button" id="send" data-testid="send-button" aria-label="Send prompt" disabled>↑</button>',
    stop: '<button type="button" id="stop" data-testid="stop-button" aria-label="Stop streaming">■</button>',
    user: 'data-message-author-role="user"',
    answer: '<article><div data-message-author-role="assistant" class="answer"><div class="markdown prose result-streaming"></div></div></article>',
    content: '.markdown',
    streaming: (wrap, on) => wrap.querySelector('.markdown').classList.toggle('result-streaming', on),
    // ChatGPT's code block: a header with the language and a Copy button, then the code.
    code: (text) => `<div class="code"><div class="head">css<button>Copy code</button></div><div><code class="language-css">${text}</code></div></div>`,
    after: '/chatgpt/c/68d3',
  },
};

function page(kind, mode) {
  const f = FLAVOURS[kind];
  return `<!doctype html><html><head><meta charset="utf-8"><title>${f.title} (test)</title><style>
body{margin:0;font:15px/1.5 sans-serif;background:#faf9f5;color:#222}
main{max-width:720px;margin:0 auto;padding:24px}
#thread>*{margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff}
[${f.user}]{background:#eee!important}
.box{border:1px solid #ccc;border-radius:14px;background:#fff;padding:10px}
#previews{display:flex;gap:6px}#previews .tile{position:relative}#previews img{height:48px;border-radius:6px}
[contenteditable]{min-height:60px;outline:none;padding:4px}
.controls{display:flex;justify-content:flex-end}.controls button{width:32px;height:32px}
</style></head><body><main>
<div id="thread"></div>
<form class="box" onsubmit="return false"><div id="previews"></div>${f.file}${f.composer}<div class="controls" id="controls">${mode === 'nosend' ? '' : mode === 'busy' ? f.stop : f.send}</div></form>
</main><script>
const MODE = ${JSON.stringify(mode)};
const F = { send: ${JSON.stringify(f.send)}, stop: ${JSON.stringify(f.stop)}, answer: ${JSON.stringify(f.answer)}, content: ${JSON.stringify(f.content)}, after: ${JSON.stringify(f.after)} };
const streaming = ${f.streaming.toString()};
const box = document.querySelector('[contenteditable]');
const thread = document.getElementById('thread');
const previews = document.getElementById('previews');
let files = [];
let uploading = 0;
let failed = false;
window.sent = 0;
function refresh() {
  const send = document.getElementById('send');
  if (send) send.disabled = uploading > 0 || failed || (!files.length && !box.innerText.trim());
}
// Like ProseMirror: a pasted text is inserted by the editor itself.
box.addEventListener('paste', (e) => {
  const list = [...e.clipboardData.files];
  if (list.length) { e.preventDefault(); take(list); return; }
  const text = e.clipboardData.getData('text/plain');
  e.preventDefault();
  if (!text || MODE === 'notext') return;
  const p = document.createElement('p');
  p.textContent = text;
  if (box.innerText.trim()) box.append(p); else box.replaceChildren(p);
  refresh();
});
box.addEventListener('beforeinput', (e) => { if (MODE === 'notext') e.preventDefault(); });
// An editor that takes no text undoes what was typed into it.
box.addEventListener('input', () => { if (MODE === 'notext') box.replaceChildren(); refresh(); });
document.getElementById('upload').addEventListener('change', (e) => take([...e.target.files]));
async function take(list) {
  for (const file of list) {
    const tile = document.createElement('div');
    tile.className = 'tile';
    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    tile.append(img);
    previews.append(tile);
    uploading++;
    refresh();
    const bitmap = await createImageBitmap(file);
    const r = await fetch('/upload?mode=' + MODE, { method: 'POST', body: file, headers: { 'content-type': file.type, 'x-name': file.name, 'x-width': bitmap.width, 'x-height': bitmap.height } });
    uploading--;
    if (r.ok) files.push(await r.json());
    else { failed = true; const alert = document.createElement('div'); alert.setAttribute('role', 'alert'); alert.textContent = 'Upload failed'; tile.append(alert); }
    refresh();
  }
}
document.addEventListener('click', (e) => { if (e.target.closest('#send')) void send(); });
async function send() {
  const button = document.getElementById('send');
  if (!button || button.disabled) return;
  const text = box.innerText.trim();
  window.sent++;
  const n = (await (await fetch('/sent', { method: 'POST', body: JSON.stringify({ kind: ${JSON.stringify(kind)}, text, files }) })).json()).n;
  const mine = document.createElement('div');
  mine.setAttribute(${JSON.stringify(f.user.split('=')[0])}, ${JSON.stringify(f.user.split('=')[1].replaceAll('"', ''))});
  mine.textContent = text + (files.length ? ' [' + files.length + ' image]' : '');
  thread.append(mine);
  box.replaceChildren();
  previews.replaceChildren();
  files = [];
  history.pushState(null, '', F.after);
  if (MODE === 'silent') {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = "You've reached your message limit.";
    thread.append(alert);
    refresh();
    return;
  }
  document.getElementById('controls').innerHTML = F.stop;
  const holder = document.createElement('div');
  holder.innerHTML = F.answer;
  const wrap = holder.firstElementChild;
  thread.append(wrap);
  const content = wrap.querySelector(F.content);
  const answer = wrap.matches('.answer') ? wrap : wrap.querySelector('.answer');
  const res = await fetch('/stream?mode=' + MODE + '&kind=${kind}&n=' + n);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let html = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    html += decoder.decode(value, { stream: true });
    content.innerHTML = html;
  }
  streaming(answer, false);
  document.getElementById('controls').innerHTML = F.send;
  refresh();
}
</script></body></html>`;
}

const read = (req) => new Promise((resolve) => { const parts = []; req.on('data', (d) => parts.push(d)); req.on('end', () => resolve(Buffer.concat(parts))); });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export async function startMockAI() {
  const state = { mode: 'ok', uploads: [], sent: [], chunkMs: 250 };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    if (req.method === 'POST' && url.pathname === '/upload') {
      const body = await read(req);
      await delay(600);
      if (url.searchParams.get('mode') === 'upload-fail') { res.writeHead(500); res.end('{}'); return; }
      state.uploads.push({ name: req.headers['x-name'], type: req.headers['content-type'], size: body.length, width: Number(req.headers['x-width']), height: Number(req.headers['x-height']) });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: state.uploads.length }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/sent') {
      state.sent.push(JSON.parse((await read(req)).toString()));
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ n: state.sent.length }));
      return;
    }
    if (url.pathname === '/stream') {
      const f = FLAVOURS[url.searchParams.get('kind')] || FLAVOURS.claude;
      const chunks = url.searchParams.get('mode') === 'xss' ? XSS
        : ANSWER.map((c) => c.replace('{n}', url.searchParams.get('n')).replace('{codeblock}', f.code(CODE)));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      for (const chunk of chunks) { res.write(chunk); await delay(state.chunkMs); }
      res.end();
      return;
    }
    const kind = url.pathname.startsWith('/chatgpt') ? 'chatgpt' : url.pathname.startsWith('/claude') ? 'claude' : null;
    if (!kind) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(page(kind, state.mode));
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return {
    state,
    port: server.address().port,
    reset(mode = 'ok') { state.mode = mode; state.uploads.length = 0; state.sent.length = 0; },
    close: () => new Promise((r) => server.close(r)),
  };
}
