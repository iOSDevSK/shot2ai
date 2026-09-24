// Stand-ins for chatgpt.com, claude.ai, gemini.google.com and perplexity.ai,
// built like the real pages as far as Shot2AI looks at them (the selectors in
// src/sites/): a message box that takes pasted text, an upload that goes to
// this server, a send button that stays disabled until the upload has
// finished, a stop button while the answer streams, and the answer itself,
// streamed from this server (a network stream, as on the real sites, so a
// background tab does not slow it). Each stand-in is its own site: ChatGPT
// and Claude on one port, Gemini and Perplexity on a second (127.0.0.1 and
// localhost each), and a sign-in page elsewhere on a third.
//
// The Gemini stand-in has no file input, so the image arrives by paste; the
// Perplexity one has a textarea and lists sources. These are choices made to
// test Shot2AI's fallbacks, not claims about the real pages.
//
// `state.mode` sets how the next page that loads behaves:
//   ok             upload, send, a streamed answer
//   xss            the same, with markup that must arrive inert in the card
//   upload-fail    the upload fails: an alert on the attachment, send stays disabled
//   nosend         no send button at all
//   notext         the composer refuses text
//   busy           a stop button is there from the start (still answering)
//   silent         the send goes, then nothing: no stop button, no answer (a usage limit)
//   login          a sign-in page instead of the chat (same site)
//   login-redirect the chat sends the tab to a sign-in page on another site
//   login-upload   the message box is there, but the upload asks to sign in
//   plan           the upload is refused: "Upgrade to Pro"
import http from 'node:http';

// The answer, in chunks as the site would stream it. `{n}` is the answer's number.
export const ANSWER = [
  '<p>Answer {n}: the <strong>Book a consultation</strong> button',
  ' is pushed to the right by <code>transform: translateX(38px)</code>.{cite}</p>',
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
// Perplexity's sources for the answer, listed above it.
export const SOURCES = [
  { href: 'https://developer.mozilla.org/en-US/docs/Web/CSS/transform', title: 'transform - CSS | MDN' },
  { href: 'https://css-tricks.com/almanac/properties/t/transform/', title: 'transform | CSS-Tricks' },
  { href: 'javascript:alert(1)', title: 'not a source' },
];

const FLAVOURS = {
  claude: {
    title: 'Claude',
    box: (controls) => `<fieldset class="box"><div id="previews"></div><input type="file" data-testid="file-upload" id="upload" multiple accept="image/*,.pdf" hidden>
      <div contenteditable="true" class="ProseMirror" aria-label="Write your prompt to Claude" data-composer></div><div class="controls" id="controls">${controls}</div></fieldset>`,
    send: '<button type="button" id="send" aria-label="Send message" disabled>↑</button>',
    stop: '<button type="button" id="stop" aria-label="Stop response">■</button>',
    user: '<div data-testid="user-message" data-slot></div>',
    answer: '<div data-is-streaming="true" class="answer"><div class="font-claude-response" data-content></div></div>',
    streaming: (wrap, on) => wrap.setAttribute('data-is-streaming', String(on)),
    code: (text) => `<code class="language-css">${text}</code>`,
    fresh: /\/claude\/new$/,
    after: '/claude/chat/7c1e',
  },
  chatgpt: {
    title: 'ChatGPT',
    box: (controls) => `<form class="box" onsubmit="return false"><div id="previews"></div><input type="file" id="upload" multiple accept="image/*" hidden>
      <div contenteditable="true" id="prompt-textarea" class="ProseMirror" data-composer></div><div class="controls" id="controls">${controls}</div></form>`,
    send: '<button type="button" id="send" data-testid="send-button" aria-label="Send prompt" disabled>↑</button>',
    stop: '<button type="button" id="stop" data-testid="stop-button" aria-label="Stop streaming">■</button>',
    user: '<article><div data-message-author-role="user" data-slot></div></article>',
    answer: '<article><div data-message-author-role="assistant" class="answer"><div class="markdown prose result-streaming" data-content></div></div></article>',
    streaming: (wrap, on) => wrap.querySelector('.markdown').classList.toggle('result-streaming', on),
    // ChatGPT's code block: a header with the language and a Copy button, then the code.
    code: (text) => `<div class="code"><div class="head">css<button>Copy code</button></div><div><code class="language-css">${text}</code></div></div>`,
    fresh: /\/chatgpt\/$/,
    after: '/chatgpt/c/68d3',
  },
  gemini: {
    title: 'Gemini',
    // No file input: an image arrives by paste. The previews sit beside the
    // editor, inside the input area that also holds the send button.
    box: (controls) => `<div class="box input-area-container"><div id="previews"></div>
      <rich-textarea><div class="ql-editor" contenteditable="true" role="textbox" aria-label="Enter a prompt here" data-composer></div></rich-textarea><div class="controls" id="controls">${controls}</div></div>`,
    send: '<button type="button" id="send" class="send-button" aria-label="Send message" disabled>↑</button>',
    stop: '<button type="button" id="stop" aria-label="Stop response">■</button>',
    user: '<user-query><div class="query-text" data-slot></div></user-query>',
    answer: '<model-response class="answer"><message-content><div class="markdown" data-content></div></message-content></model-response>',
    streaming: () => {},
    code: (text) => `<code class="language-css">${text}</code>`,
    fresh: /\/gemini\/app$/,
    after: '/gemini/app/9f2c',
    header: '<header><a href="#" aria-label="Google apps">Apps</a></header>',
  },
  perplexity: {
    title: 'Perplexity',
    box: (controls) => `<div class="box"><div id="previews"></div><input type="file" id="upload" multiple accept="image/*" hidden>
      <textarea id="ask-input" placeholder="Ask anything…" data-composer rows="3"></textarea><div class="controls" id="controls">${controls}</div></div>`,
    send: '<button type="button" id="send" aria-label="Submit" disabled>→</button>',
    stop: '<button type="button" id="stop" aria-label="Stop generating response">■</button>',
    // One entry per question: the question, its sources, then the answer.
    user: '<div data-testid="answer-entry"><div class="group/query"><h1 data-slot></h1></div><div data-testid="sources"></div></div>',
    answer: '<div id="markdown-content-0" class="prose answer" data-content></div>',
    inside: true,
    streaming: () => {},
    code: (text) => `<code class="language-css">${text}</code>`,
    fresh: /\/perplexity\/$/,
    after: '/perplexity/search/b7e1',
    // Signed out, Perplexity still shows its message box, next to these.
    header: '<header><button type="button">Sign In</button> <button type="button">Sign Up</button></header>',
  },
};

const LOGIN = (title) => `<!doctype html><html><head><meta charset="utf-8"><title>Log in – ${title} (test)</title></head><body style="font:15px sans-serif;padding:60px">
<h1>Log in to ${title}</h1><form onsubmit="return false"><input type="email" id="email" placeholder="Enter your email" style="width:280px;height:34px"><br><br>
<button type="button">Continue with Google</button> <button type="submit">Continue with email</button></form></body></html>`;
const ACCOUNTS = `<!doctype html><html><head><meta charset="utf-8"><title>Sign in – Accounts (test)</title></head><body style="font:15px sans-serif;padding:60px">
<h1>Sign in</h1><input type="email" id="email" placeholder="Email or phone" style="width:280px;height:34px"> <button type="button">Next</button></body></html>`;

function page(kind, mode) {
  const f = FLAVOURS[kind];
  const controls = mode === 'nosend' ? '' : mode === 'busy' ? f.stop : f.send;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${f.title} (test)</title><style>
body{margin:0;font:15px/1.5 sans-serif;background:#faf9f5;color:#222}
main{max-width:720px;margin:0 auto;padding:24px}
#thread>*{display:block;margin:0 0 14px;padding:10px 14px;border-radius:10px;background:#fff}
[data-slot]{background:#eee}
.box{display:block;border:1px solid #ccc;border-radius:14px;background:#fff;padding:10px}
#previews{display:flex;gap:6px}#previews .tile{position:relative}#previews img{height:48px;border-radius:6px}
[data-composer]{display:block;width:100%;min-height:60px;outline:none;padding:4px;box-sizing:border-box}
.controls{display:flex;justify-content:flex-end}.controls button{width:32px;height:32px}
[role=dialog]{position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);padding:20px;background:#fff;border:1px solid #999;border-radius:12px}
</style></head><body>${f.header || ''}<main>
<div id="thread"></div>
${f.box(controls)}
</main><script>
const MODE = ${JSON.stringify(mode)};
const F = { send: ${JSON.stringify(f.send)}, stop: ${JSON.stringify(f.stop)}, user: ${JSON.stringify(f.user)}, answer: ${JSON.stringify(f.answer)}, inside: ${!!f.inside}, fresh: ${f.fresh}, after: ${JSON.stringify(f.after)}, kind: ${JSON.stringify(kind)} };
const streaming = ${f.streaming.toString()};
const box = document.querySelector('[data-composer]');
const isArea = box instanceof HTMLTextAreaElement;
const said = () => (isArea ? box.value : box.innerText).trim();
const thread = document.getElementById('thread');
const previews = document.getElementById('previews');
let files = [];
let uploading = 0;
let failed = false;
window.sent = 0;
function refresh() {
  const send = document.getElementById('send');
  if (send) send.disabled = uploading > 0 || failed || (!files.length && !said());
}
const make = (html) => { const holder = document.createElement('div'); holder.innerHTML = html; return holder.firstElementChild; };
// Like ProseMirror: a pasted text is inserted by the editor itself.
box.addEventListener('paste', (e) => {
  const list = [...e.clipboardData.files];
  if (list.length) { e.preventDefault(); take(list); return; }
  if (isArea) return;
  const text = e.clipboardData.getData('text/plain');
  e.preventDefault();
  if (!text || MODE === 'notext') return;
  const p = document.createElement('p');
  p.textContent = text;
  if (said()) box.append(p); else box.replaceChildren(p);
  refresh();
});
box.addEventListener('beforeinput', (e) => { if (MODE === 'notext') e.preventDefault(); });
// An editor that takes no text undoes what was typed into it.
box.addEventListener('input', () => { if (MODE === 'notext') { if (isArea) box.value = ''; else box.replaceChildren(); } refresh(); });
document.getElementById('upload')?.addEventListener('change', (e) => take([...e.target.files]));
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
    else if (r.status === 402 || r.status === 401) {
      // The site's own words, in a dialog; the image is dropped.
      const dialog = document.createElement('div');
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      dialog.textContent = r.status === 402 ? 'Upgrade to Pro to attach more files today.' : 'Sign in or create an account to attach files.';
      document.body.append(dialog);
      tile.remove();
    } else { failed = true; const alert = document.createElement('div'); alert.setAttribute('role', 'alert'); alert.textContent = 'Upload failed'; tile.append(alert); }
    refresh();
  }
}
document.addEventListener('click', (e) => { if (e.target.closest('#send')) void send(); });
async function send() {
  const button = document.getElementById('send');
  if (!button || button.disabled) return;
  const text = said();
  window.sent++;
  const n = (await (await fetch('/sent', { method: 'POST', body: JSON.stringify({ kind: F.kind, text, files, path: location.pathname }) })).json()).n;
  const mine = make(F.user);
  (mine.matches('[data-slot]') ? mine : mine.querySelector('[data-slot]')).textContent = text + (files.length ? ' [' + files.length + ' image]' : '');
  thread.append(mine);
  if (isArea) box.value = ''; else box.replaceChildren();
  previews.replaceChildren();
  files = [];
  // A new chat gets its own address once it starts; a conversation keeps its own.
  if (F.fresh.test(location.pathname)) history.pushState(null, '', F.after);
  if (MODE === 'silent') {
    const alert = document.createElement('div');
    alert.setAttribute('role', 'alert');
    alert.textContent = "You've reached your message limit.";
    thread.append(alert);
    refresh();
    return;
  }
  document.getElementById('controls').innerHTML = F.stop;
  const wrap = make(F.answer);
  (F.inside ? mine : thread).append(wrap);
  const content = wrap.matches('[data-content]') ? wrap : wrap.querySelector('[data-content]');
  const answer = wrap.matches('.answer') ? wrap : wrap.querySelector('.answer');
  const sources = mine.querySelector('[data-testid="sources"]');
  if (sources) for (const s of (await (await fetch('/sources')).json())) { const a = document.createElement('a'); a.href = s.href; a.textContent = s.title; sources.append(a, ' '); }
  const res = await fetch('/stream?mode=' + MODE + '&kind=' + F.kind + '&n=' + n);
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
  const state = { mode: 'ok', uploads: [], sent: [], pages: [], chunkMs: 250 };
  const ports = {};
  const handler = async (req, res) => {
    const url = new URL(req.url, 'http://mock');
    if (req.method === 'POST' && url.pathname === '/upload') {
      const body = await read(req);
      await delay(600);
      const mode = url.searchParams.get('mode');
      if (mode === 'upload-fail') { res.writeHead(500); res.end('{}'); return; }
      if (mode === 'plan' || mode === 'login-upload') { res.writeHead(mode === 'plan' ? 402 : 401); res.end('{}'); return; }
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
    if (url.pathname === '/sources') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(SOURCES)); return; }
    if (url.pathname === '/stream') {
      const kind = url.searchParams.get('kind');
      const f = FLAVOURS[kind] || FLAVOURS.claude;
      const cite = kind === 'perplexity' ? ` <a class="citation" href="${SOURCES[0].href}">1</a>` : '';
      const chunks = url.searchParams.get('mode') === 'xss' ? XSS
        : ANSWER.map((c) => c.replace('{n}', url.searchParams.get('n')).replace('{codeblock}', f.code(CODE)).replace('{cite}', cite));
      res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
      for (const chunk of chunks) { res.write(chunk); await delay(state.chunkMs); }
      res.end();
      return;
    }
    if (url.pathname.startsWith('/accounts')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(ACCOUNTS); return; }
    const kind = Object.keys(FLAVOURS).find((k) => url.pathname.startsWith(`/${k}`));
    if (!kind) { res.writeHead(404); res.end(); return; }
    state.pages.push({ kind, path: url.pathname });
    if (state.mode === 'login-redirect') { res.writeHead(302, { location: `http://127.0.0.1:${ports.accounts}/accounts/signin?continue=${encodeURIComponent(url.pathname)}` }); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(state.mode === 'login' ? LOGIN(FLAVOURS[kind].title) : page(kind, state.mode));
  };
  // ChatGPT and Claude on one port, Gemini and Perplexity on a second, sign-in on a third.
  const servers = [];
  for (const name of ['first', 'second', 'accounts']) {
    const server = http.createServer(handler);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    ports[name] = server.address().port;
    servers.push(server);
  }
  return {
    state,
    port: ports.first,
    port2: ports.second,
    accountsPort: ports.accounts,
    reset(mode = 'ok') { state.mode = mode; state.uploads.length = 0; state.sent.length = 0; state.pages.length = 0; },
    close: () => Promise.all(servers.map((s) => new Promise((r) => s.close(r)))),
  };
}
