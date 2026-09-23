// The preview card: the captures of this tab as a stack of cards in the
// page's corner. The newest is on top and the older ones peek out behind it;
// ‹ › (or ← →) flip through them. Each card keeps its own message and result.
// One click sends the front card to the default destination; Annotate opens
// the editor. Everything else goes through the extension's service worker,
// which keeps the stack, so it survives navigation within the tab. Only the
// clipboard is written here, while the page has focus.
(() => {
  // Injected again with every capture: the first copy on the page does the work.
  if (window.__shot2aiStack) return;
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    .deck{position:fixed;right:20px;bottom:20px;width:280px;font:13px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;color:#232a23}
    .peek{position:absolute;left:0;right:0;bottom:0;border:1px solid #d3d8cc;border-radius:14px;background:#fff;box-shadow:0 -1px 0 rgba(35,42,35,.04),0 8px 24px rgba(35,42,35,.18);transform-origin:50% 0;cursor:pointer;transition:transform .18s ease,opacity .18s ease}
    .peek:hover{background:#f1f5ec;border-color:#b9c3b0}
    .more-badge{position:absolute;right:10px;top:-11px;padding:2px 7px;border-radius:999px;background:#2f3c30;color:#fff;font-size:10.5px;font-weight:650;z-index:6}
    .card{position:relative;z-index:5;padding:10px;border:1px solid #e3e6dd;border-radius:14px;background:#fafaf8;box-shadow:0 1px 2px rgba(35,42,35,.08),0 14px 40px rgba(35,42,35,.22);animation:in .18s ease-out}
    @keyframes in{from{opacity:0;transform:translateY(10px) scale(.98)}}
    .deck.out{opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s}
    .body.flip-next{animation:next .18s ease-out}
    .body.flip-prev{animation:prev .18s ease-out}
    @keyframes next{from{opacity:.2;transform:translateX(14px)}}
    @keyframes prev{from{opacity:.2;transform:translateX(-14px)}}
    @media (prefers-reduced-motion:reduce){.card,.body.flip-next,.body.flip-prev{animation:none}.peek{transition:none}}
    button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
    button:disabled{cursor:default;opacity:.5}
    svg{width:16px;height:16px;display:block}
    .shot{position:relative;display:grid;place-items:center;height:132px;border-radius:9px;background:#eef0ea;overflow:hidden}
    .shot canvas{display:block;max-width:100%;max-height:132px;border-radius:4px;box-shadow:0 0 0 1px rgba(35,42,35,.08)}
    .close{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(35,42,35,.62);color:#fff}
    .close svg{width:12px;height:12px}
    .close:hover{background:rgba(35,42,35,.85)}
    .nav{position:absolute;top:6px;left:6px;display:flex;align-items:center;gap:1px;height:24px;padding:0 2px;border-radius:999px;background:rgba(35,42,35,.62);color:#fff;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}
    .nav button{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;font-size:14px;line-height:1}
    .nav button:hover:not(:disabled){background:rgba(255,255,255,.18)}
    .nav .count{padding:0 3px;min-width:34px;text-align:center}
    .include{position:absolute;top:6px;right:36px;display:flex;align-items:center;gap:4px;height:24px;padding:0 8px 0 6px;border-radius:999px;background:rgba(255,255,255,.92);color:#2f3c30;font-size:11px;font-weight:600;cursor:pointer}
    .include input{margin:0;width:13px;height:13px;accent-color:#2f3c30}
    .chip{position:absolute;left:6px;bottom:6px;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(47,60,48,.88);color:#fff;font-size:11px;font-weight:560}
    .chip svg{width:11px;height:11px}
    .sent-badge{position:absolute;left:6px;bottom:6px;padding:3px 8px;border-radius:999px;background:#16964c;color:#fff;font-size:11px;font-weight:600}
    .meta{position:absolute;right:6px;bottom:6px;padding:3px 7px;border-radius:999px;background:rgba(255,255,255,.9);color:#4d5a47;font-size:10.5px;font-weight:600;font-variant-numeric:tabular-nums}
    .compose{display:flex;gap:6px;margin:9px 0 8px}
    .prompt{flex:none;width:86px;height:34px;padding:0 6px 0 9px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#4d5a47;font:600 11.5px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}
    .prompt:focus{outline:none;border-color:#547254;box-shadow:0 0 0 2px rgba(84,114,84,.2)}
    .message{min-width:0;flex:1;height:34px;margin:0;padding:0 10px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#232a23;font:13px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;outline:none}
    .message::placeholder{color:#a6ae9b}
    .message:focus{border-color:#547254;box-shadow:0 0 0 2px rgba(84,114,84,.2)}
    .split{position:relative;display:flex;height:36px;border-radius:8px;background:#2f3c30;color:#fff}
    .send{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;padding:0 10px;border-radius:8px 0 0 8px;font-weight:600;font-size:12.5px;white-space:nowrap}
    .send span{overflow:hidden;text-overflow:ellipsis}
    .more{display:grid;place-items:center;width:34px;border-left:1px solid rgba(255,255,255,.18);border-radius:0 8px 8px 0}
    .send:hover:not(:disabled),.more:hover:not(:disabled){background:#465b43}
    .menu{position:absolute;right:0;bottom:42px;left:0;max-height:min(70vh,520px);overflow:auto;padding:5px;border:1px solid #e3e6dd;border-radius:10px;background:#fff;box-shadow:0 12px 32px rgba(35,42,35,.18);color:#232a23;z-index:1}
    .menu .head{padding:5px 8px 4px;font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#969f88}
    .menu .head.later{margin-top:4px;border-top:1px solid #eef0ea;padding-top:9px}
    .menu button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 8px;border-radius:6px;text-align:left;font-size:12.5px}
    .menu button:hover{background:#f1f3ee}
    .menu small{color:#969f88;font-size:11px}
    .menu .item{display:flex;align-items:center;gap:2px;border-radius:6px}
    .menu .item:hover{background:#f1f3ee}
    .menu .item input{flex:none;width:15px;height:15px;margin:0 2px 0 7px;accent-color:#2f3c30;cursor:pointer}
    .menu .item button{flex:1;padding-left:5px}
    .menu .item button:hover{background:none}
    .menu .all{margin-top:4px;border-top:1px solid #eef0ea;border-radius:0;font-weight:600;color:#2f3c30}
    .menu .strong{font-weight:600;color:#2f3c30}
    .menu .options{border-top:1px solid #eef0ea;margin-top:4px;border-radius:0 0 6px 6px;color:#547254}
    .tools{display:flex;gap:2px;margin-top:8px}
    .tools button{flex:1;display:flex;align-items:center;justify-content:center;min-width:0;height:30px;padding:0 3px;gap:4px;border-radius:7px;color:#4d5a47;font-size:11px;font-weight:560;white-space:nowrap}
    .tools button:hover{background:#eef0ea}
    .tools svg{flex:none;width:14px;height:14px}
    .region-menu{margin-top:4px;padding:4px;border:1px solid #e3e6dd;border-radius:9px;background:#fff}
    .region-menu button{display:block;width:100%;padding:7px 8px;border-radius:6px;text-align:left;font-size:12px}
    .region-menu button:hover:not(:disabled){background:#f1f3ee}
    .result{margin-top:8px;padding:8px 10px;border:1px solid #e3e6dd;border-radius:8px;background:#fff;font-size:12px;line-height:1.45}
    .result.ok{border-color:#d5e3c8;background:#edf3e7;color:#34502a}
    .result.warn{border-color:#efe2c2;background:#faf3e3;color:#5f4a1f}
    .result.err{border-color:#eed8d0;background:#fbefeb;color:#6f3f33}
    .result .actions{display:flex;gap:6px;margin-top:7px}
    .result .actions button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid #dfe2d9;border-radius:6px;background:#fff;color:#2f3c30;font-size:11.5px;font-weight:600}
    .result .actions button.primary{border-color:#2f3c30;background:#2f3c30;color:#fff}
    .result .actions svg{width:13px;height:13px}
    .result ul{margin:0;padding:0;list-style:none}
    .result li{display:flex;gap:6px;padding:2px 0}
    .result li b{font-weight:650;white-space:nowrap}
    .result li.fail{color:#6f3f33}
    .note{margin-top:8px;padding:7px 10px;border:1px solid #efe2c2;border-radius:8px;background:#faf3e3;color:#5f4a1f;font-size:11.5px;line-height:1.45}
    .toast{margin-top:8px;padding:6px 10px;border-radius:8px;background:#eef0ea;color:#4d5a47;font-size:11.5px}
    .saved{margin-top:6px;font-size:10.5px;color:#969f88;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    [hidden]{display:none!important}
  `;
  // The first-use notice for web chats (settings.js websiteNotice, rebuilt here).
  const notice = (names, hosts, many, auto) => `${names} ${many ? 'are websites' : 'is a website'}. The screenshot and message will go to ${hosts}, not only to this Mac${auto ? ', and will be sent automatically, without you reviewing it' : ''}.`;
  const bytesOf = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const ask = (message) => chrome.runtime.sendMessage(message).catch(() => null);

  let ui = null;

  // payload: the stack's captures (oldest first), which one is in front, and
  // what a card needs (destinations, prompts, icons…). `fresh` is a new capture's PNG.
  window.__shot2aiStack = (payload) => {
    if (!ui || !ui.host.isConnected) ui = build(payload);
    ui.update(payload);
    return true;
  };

  function build(first) {
    const i = first.icons;
    document.getElementById('shot2ai-preview-card')?.remove();
    const host = document.createElement('div');
    host.id = 'shot2ai-preview-card';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    // A constructed stylesheet: a page's style-src policy does not apply to it.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `<div class="deck">
      <div class="peeks"></div>
      <div class="card" role="dialog" aria-label="Shot2AI screenshot preview" tabindex="-1"><div class="body">
        <div class="shot"><canvas aria-label="Captured area"></canvas>
          <div class="nav" hidden><button class="prev" aria-label="Previous capture" title="Previous (←)">‹</button><span class="count" aria-live="polite"></span><button class="next" aria-label="Next capture" title="Next (→)">›</button></div>
          <label class="include" hidden><input type="checkbox" aria-label="Include in Send selected">Include</label>
          <button class="close" aria-label="Close this capture" title="Close this capture">${i.close}</button>
          <span class="chip" hidden>${i.check}<span></span></span><span class="sent-badge" hidden>Sent</span><span class="meta" title="Format and size of what is sent to web chats and saved"></span></div>
        <div class="compose"><select class="prompt" aria-label="Prompts" title="Fill the message with a saved prompt"><option value="" selected disabled>Prompt</option></select><input class="message" placeholder="Add a message (optional)" aria-label="Message" maxlength="2000"></div>
        <div class="split"><button class="send"><span></span></button><button class="more" aria-label="More destinations" aria-haspopup="menu" title="More destinations">${i.chevron}</button>
          <div class="menu" role="menu" hidden></div></div>
        <div class="tools">
          <button class="annotate" title="Open in the editor to draw arrows, boxes and text">${i.annotate}Annotate</button>
          <button class="copy" title="Copy to the clipboard">${i.copy}Copy</button>
          <button class="save" title="Save a copy">${i.download}Save</button>
          <button class="region" title="Remember this region, or capture the saved one" aria-haspopup="menu">${i.region}Region</button>
        </div>
        <div class="region-menu" role="menu" hidden>
          <button class="remember" role="menuitem">Remember this region</button>
          <button class="capture-saved" role="menuitem">Capture saved region</button>
        </div>
        <div class="note" role="note" hidden></div>
        <div class="toast" role="status" hidden></div>
        <div class="result" role="status" hidden></div>
        <div class="saved" hidden></div>
      </div></div>
    </div>`;
    const $ = (s) => root.querySelector(s);
    const deck = $('.deck');
    const card = $('.card');
    const input = $('.message');
    let o = first;               // shared: destinations, main, prompts, icons…
    let entries = [];            // the stack, oldest first
    let current = 0;             // index of the front card
    let selecting = false;
    let busy = false;
    let hovered = false;
    let hideTimer = 0;
    let saveTimer = 0;
    const bitmaps = new Map();
    const pngs = new Map();
    let chosenDestinations = [...(first.multi || [])];

    const now = () => entries[current];
    const unsent = () => entries.filter((e) => !e.sent);
    const persist = (id, patch) => ask({ type: 'stack-update', id, patch });

    // ---- drawing ----------------------------------------------------------

    function drawThumb(entry) {
      const canvas = $('canvas');
      const paint = (bitmap) => {
        if (now() !== entry) return;
        const room = Math.min(260 / bitmap.width, 132 / bitmap.height, 1);
        canvas.width = Math.max(1, Math.round(bitmap.width * room * 2));
        canvas.height = Math.max(1, Math.round(bitmap.height * room * 2));
        canvas.style.width = `${canvas.width / 2}px`;
        canvas.style.height = `${canvas.height / 2}px`;
        canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      };
      if (bitmaps.has(entry.id)) { paint(bitmaps.get(entry.id)); return; }
      createImageBitmap(new Blob([bytesOf(entry.thumb)], { type: 'image/jpeg' })).then((b) => { bitmaps.set(entry.id, b); paint(b); });
    }

    function renderPeeks() {
      const peeks = $('.peeks');
      const behind = Math.min(4, entries.length - 1);
      const height = card.offsetHeight || 300;
      const layers = [];
      for (let k = behind; k >= 1; k--) {
        const layer = document.createElement('div');
        layer.className = 'peek';
        const index = (current - k + entries.length) % entries.length;
        layer.style.height = `${height}px`;
        // Scaled from the top edge, so each layer shows an 8 px strip above the one in front.
        layer.style.transform = `translateY(${-8 * k}px) scale(${1 - 0.035 * k})`;
        layer.style.opacity = String(1 - 0.08 * k);
        layer.style.zIndex = String(5 - k);
        layer.title = `Capture ${index + 1} of ${entries.length}`;
        layer.addEventListener('click', () => go(index, -1));
        layers.push(layer);
      }
      peeks.replaceChildren(...layers);
      if (entries.length > 5) {
        const badge = document.createElement('span');
        badge.className = 'more-badge';
        badge.style.top = `${-11 - 8 * behind}px`;
        badge.textContent = `+${entries.length - 5}`;
        badge.title = `${entries.length} captures in this tab`;
        peeks.append(badge);
      }
    }

    function label() {
      const kind = o.main.kind;
      const svg = { copy: i.copy, save: i.download }[kind] || i.send;
      $('.send').innerHTML = `${svg}<span></span>`;
      $('.send span').textContent = o.main.label;
    }

    function showResult(tone, text, actions = [], lines = null) {
      const box = $('.result');
      box.className = `result ${tone}`;
      box.textContent = text;
      if (lines) {
        const list = document.createElement('ul');
        for (const x of lines) {
          const li = document.createElement('li');
          li.className = x.ok ? 'ok' : 'fail';
          li.innerHTML = '<b></b><span></span>';
          li.querySelector('b').textContent = `${x.ok ? '✓' : '!'} ${x.name}`;
          li.querySelector('span').textContent = x.text;
          list.append(li);
        }
        box.replaceChildren(list);
      }
      if (actions.length) {
        const row = document.createElement('div');
        row.className = 'actions';
        for (const [name, run, primary, icon] of actions) {
          const b = document.createElement('button');
          if (primary) b.className = 'primary';
          b.innerHTML = `${icon ? i[icon] : ''}<span></span>`;
          b.querySelector('span').textContent = name;
          b.addEventListener('click', run);
          row.append(b);
        }
        box.append(row);
      }
      box.hidden = !text && !lines;
    }
    // A result belongs to its card: kept, and shown again when it is in front.
    function setResult(entry, result) {
      entry.result = result;
      if (result?.persist !== false) persist(entry.id, { result: result && { tone: result.tone, text: result.text, lines: result.lines || null } });
      if (entry === now()) render();
    }

    function chip(text) { $('.chip span').textContent = text; $('.chip').hidden = !text || now()?.sent; }

    function render(direction = 0) {
      const entry = now();
      if (!entry) return;
      card.dataset.id = entry.id;
      const n = entries.length;
      $('.nav').hidden = n < 2;
      $('.count').textContent = `${current + 1} / ${n}`;
      $('.prev').disabled = n < 2;
      $('.next').disabled = n < 2;
      $('.include').hidden = !selecting;
      $('.include input').checked = !!entry.selected;
      if (document.activeElement !== host || root.activeElement !== input) input.value = entry.message || '';
      $('.meta').textContent = entry.meta || '';
      $('.meta').hidden = !entry.meta;
      $('.note').textContent = entry.note || '';
      $('.note').hidden = !entry.note;
      $('.saved').textContent = $('.saved').title = entry.saved || '';
      $('.saved').hidden = !entry.saved;
      $('.sent-badge').hidden = !entry.sent;
      $('.chip').hidden = true;
      $('.remember').hidden = !entry.region?.canRemember;
      $('.capture-saved').disabled = !entry.region?.hasSaved;
      $('.region-menu').hidden = true;
      const r = entry.result;
      if (r?.actions === 'retry') showResult(r.tone, r.text, [['Try again', () => void sendTo(o.main), true, 'retry']]);
      else if (r?.actions === 'options') showResult(r.tone, r.text, [['Open Options', () => ask({ type: 'open-options' }), true]]);
      else if (r) showResult(r.tone, r.text || '', [], r.lines || null);
      else showResult('', '');
      label();
      drawThumb(entry);
      if (direction) {
        const body = $('.body');
        body.classList.remove('flip-next', 'flip-prev');
        void body.offsetWidth;
        body.classList.add(direction > 0 ? 'flip-next' : 'flip-prev');
      }
      requestAnimationFrame(renderPeeks);
    }

    function go(index, direction) {
      if (!entries.length) return;
      current = (index + entries.length) % entries.length;
      render(direction);
    }

    // ---- showing and hiding -------------------------------------------------

    function toast(text) {
      $('.toast').textContent = text;
      $('.toast').hidden = !text;
      if (text) setTimeout(() => { if ($('.toast').textContent === text) $('.toast').hidden = true; }, 6000);
    }

    // Esc: the stack leaves the screen; its captures wait for the next capture.
    function dismiss() {
      clearTimeout(hideTimer);
      window.removeEventListener('keydown', onKey, true);
      deck.classList.add('out');
      setTimeout(() => host.remove(), 200);
      ask({ type: 'stack-hide' });
    }
    function removeEntry(entry, tell = true) {
      const at = entries.indexOf(entry);
      if (at < 0) return;
      entries.splice(at, 1);
      if (tell) ask({ type: 'stack-remove', id: entry.id });
      if (!entries.length) { clearTimeout(hideTimer); window.removeEventListener('keydown', onKey, true); deck.classList.add('out'); setTimeout(() => host.remove(), 200); return; }
      current = Math.min(at, entries.length - 1);
      render();
    }
    // After a send, only the sent cards leave; never while the owner is on the card.
    function scheduleHide() {
      clearTimeout(hideTimer);
      if (!entries.some((e) => e.sent) || hovered || root.activeElement === input) return;
      hideTimer = setTimeout(() => {
        for (const e of entries.filter((x) => x.sent)) removeEntry(e);
      }, 6000);
    }
    card.addEventListener('mouseenter', () => { hovered = true; clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', () => { hovered = false; scheduleHide(); });
    input.addEventListener('focus', () => clearTimeout(hideTimer));
    input.addEventListener('blur', () => setTimeout(scheduleHide, 0));
    input.addEventListener('input', () => {
      clearTimeout(hideTimer);
      const entry = now();
      entry.message = input.value;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => persist(entry.id, { message: entry.message }), 300);
    });
    // Keys typed in the card stay in the card; ← → flip when not typing.
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target === input) { e.preventDefault(); void sendTo(o.main); return; }
      if (e.target === input || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(current - 1, -1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(current + 1, 1); }
    });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!$('.menu').hidden) { $('.menu').hidden = true; return; }
      e.preventDefault(); e.stopPropagation(); dismiss();
    };
    window.addEventListener('keydown', onKey, true);

    // ---- clipboard, saving ----------------------------------------------------

    async function fullPng(entry) {
      if (!pngs.has(entry.id)) {
        const r = await ask({ type: 'stack-png', id: entry.id });
        if (!r?.png) return null;
        pngs.set(entry.id, new Blob([bytesOf(r.png)], { type: 'image/png' }));
      }
      return pngs.get(entry.id);
    }
    async function copy(entry, withText) {
      const png = await fullPng(entry);
      if (!png) return false;
      const items = { 'image/png': png };
      const text = (entry.message || '').trim();
      if (withText && text) items['text/plain'] = new Blob([text], { type: 'text/plain' });
      try { await navigator.clipboard.write([new ClipboardItem(items)]); return true; } catch { return false; }
    }
    async function save(entry) {
      const r = await ask({ type: 'save', id: entry.id });
      entry.saved = r?.text || 'The screenshot could not be saved.';
      persist(entry.id, { saved: entry.saved });
      if (entry === now()) render();
    }

    // ---- sending the front card ------------------------------------------------

    const setBusy = (on, text = 'Sending…') => { busy = on; for (const b of root.querySelectorAll('.send,.more')) b.disabled = on; if (on) $('.send span').textContent = text; else label(); };
    function markSent(entry, result) {
      entry.sent = true;
      entry.message = '';
      persist(entry.id, { sent: true, message: '' });
      setResult(entry, result);
      if (entry === now()) { input.value = ''; input.blur(); }
      scheduleHide();
    }

    async function sendTo(destination, confirmed = false) {
      const entry = now();
      if (busy || !entry) return;
      $('.menu').hidden = true;
      if (destination.kind === 'copy') { chip((await copy(entry, true)) ? 'Copied' : ''); return; }
      if (destination.kind === 'save') { await save(entry); return; }
      const text = (entry.message || '').trim();
      if (destination.kind === 'chat') {
        // A web chat is a website: say so once, before anything goes there.
        if (!confirmed && !o.acknowledged[destination.origin]) {
          showResult('warn', notice(destination.name, destination.host, false, destination.auto),
            [['Continue', () => { o.acknowledged[destination.origin] = true; void sendTo(destination, true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
          return;
        }
        // Copied first, while this page has focus: the fallback if pasting fails.
        const copied = await copy(entry, true);
        setBusy(true);
        const r = await ask({ type: 'card-send', id: entry.id, destination: destination.id, text, acknowledge: destination.origin });
        setBusy(false);
        if (r?.ok) { markSent(entry, { tone: r.submitted || !r.autoSubmit ? 'ok' : 'warn', text: r.text }); return; }
        if (r?.needsPermission) { setResult(entry, { tone: 'warn', text: `Allow the extension to use ${destination.host} in Options first.`, actions: 'options', persist: false }); return; }
        setResult(entry, { tone: copied ? 'warn' : 'err', text: copied ? `Copied. Paste with ${o.mod}V in ${destination.name}.` : `The screenshot could not be pasted into ${destination.name}. Use Copy, then paste it there.` });
        return;
      }
      setBusy(true);
      const r = await ask({ type: 'card-send', id: entry.id, destination: 'html2wp', text });
      setBusy(false);
      if (r?.ok) { markSent(entry, { tone: 'ok', text: r.text }); return; }
      if (r?.unpaired) setResult(entry, { tone: 'warn', text: r.text, actions: 'options', persist: false });
      else setResult(entry, { tone: r?.reason !== undefined ? 'warn' : 'err', text: r?.text || 'html2wp did not answer.', actions: 'retry', persist: false });
    }

    // Several destinations for the front card.
    async function sendToMany(confirmed = false) {
      const entry = now();
      if (busy || !entry) return;
      $('.menu').hidden = true;
      const targets = o.destinations.filter((d) => chosenDestinations.includes(d.id));
      const chats = targets.filter((d) => d.kind === 'chat');
      const unknown = chats.filter((d) => !o.acknowledged[d.origin]);
      // One notice for every web chat in the set that has not been told yet.
      if (!confirmed && unknown.length) {
        showResult('warn', notice(unknown.map((d) => d.name).join(', '), unknown.map((d) => d.host).join(', '), unknown.length > 1, unknown.some((d) => d.auto)),
          [['Continue', () => { for (const d of unknown) o.acknowledged[d.origin] = true; void sendToMany(true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
        return;
      }
      if (chats.length) await copy(entry, true);
      setBusy(true, `Sending to ${targets.length}…`);
      const r = await ask({ type: 'card-send-many', id: entry.id, destinations: targets.map((d) => d.id), text: (entry.message || '').trim(), acknowledge: unknown.map((d) => d.origin) });
      setBusy(false);
      const lines = r?.results || [];
      const ok = lines.length > 0 && lines.every((x) => x.ok);
      if (ok) markSent(entry, { tone: 'ok', text: '', lines });
      else setResult(entry, { tone: 'warn', text: '', lines });
    }

    // Several captures at once, to the default destination: every unsent one,
    // or the ones ticked in select mode.
    async function sendCaptures(which, confirmed = false) {
      if (busy) return;
      $('.menu').hidden = true;
      const list = which === 'selected' ? entries.filter((e) => e.selected && !e.sent) : unsent();
      if (!list.length) return;
      const d = o.main;
      if (d.kind === 'chat' && !confirmed && !o.acknowledged[d.origin]) {
        showResult('warn', notice(d.name, d.host, false, d.auto),
          [['Continue', () => { o.acknowledged[d.origin] = true; void sendCaptures(which, true); }, true, 'send'], ['Cancel', () => showResult('', '')]]);
        return;
      }
      setBusy(true, `Sending ${list.length}…`);
      const text = list.map((e) => (e.message || '').trim()).filter(Boolean).join('\n\n');
      const r = await ask({ type: 'send-captures', ids: list.map((e) => e.id), text, acknowledge: d.origin || null });
      setBusy(false);
      const sent = new Set(r?.sentIds || []);
      const tone = r?.ok ? (sent.size === list.length ? 'ok' : 'warn') : 'err';
      for (const e of list) {
        if (sent.has(e.id)) { e.sent = true; e.message = ''; e.selected = false; persist(e.id, { sent: true, message: '', selected: false }); e.result = { tone, text: r.text }; persist(e.id, { result: { tone, text: r.text } }); }
      }
      // The front card shows how it went, sent or not.
      const front = now();
      if (!sent.has(front.id)) setResult(front, { tone, text: r?.text || 'Nothing was sent.', persist: false });
      else render();
      if (sent.size) { input.value = ''; input.blur(); scheduleHide(); }
    }

    // ---- the menu -------------------------------------------------------------

    function openMenu() {
      const menu = $('.menu');
      if (!menu.hidden) { menu.hidden = true; return; }
      menu.innerHTML = '<div class="head">Send to</div>';
      // Tick several for "Send to all selected"; a name alone sends to that one.
      for (const d of o.destinations) {
        const row = document.createElement('div');
        row.className = 'item';
        row.innerHTML = '<input type="checkbox"><button role="menuitem"><span></span><small></small></button>';
        const tick = row.querySelector('input');
        tick.checked = chosenDestinations.includes(d.id);
        tick.setAttribute('aria-label', `Select ${d.name}`);
        tick.addEventListener('change', () => {
          chosenDestinations = tick.checked ? [...chosenDestinations, d.id] : chosenDestinations.filter((x) => x !== d.id);
          chrome.storage.local.set({ multiSend: chosenDestinations });
          all.textContent = `Send to all selected (${chosenDestinations.length})`;
          all.hidden = chosenDestinations.length < 2;
        });
        const b = row.querySelector('button');
        b.querySelector('span').textContent = d.name;
        b.querySelector('small').textContent = d.kind === 'html2wp' ? 'this Mac' : d.host;
        b.addEventListener('click', () => void sendTo(d));
        menu.append(row);
      }
      const all = document.createElement('button');
      all.className = 'all';
      all.setAttribute('role', 'menuitem');
      all.textContent = `Send to all selected (${chosenDestinations.length})`;
      all.hidden = chosenDestinations.length < 2;
      all.addEventListener('click', () => void sendToMany());
      menu.append(all);
      const add = (text, run, cls = 'strong') => {
        const b = document.createElement('button');
        b.className = cls;
        b.setAttribute('role', 'menuitem');
        b.textContent = text;
        b.addEventListener('click', run);
        menu.append(b);
        return b;
      };
      if (entries.length > 1) {
        menu.insertAdjacentHTML('beforeend', '<div class="head later">Captures</div>');
        const canSendAll = o.main.kind === 'html2wp' || o.main.kind === 'chat' || o.main.kind === 'save';
        const verb = o.main.kind === 'save' ? 'Save' : 'Send';
        const waiting = unsent().length;
        if (canSendAll && waiting > 1) add(`${verb} all captures (${waiting})`, () => void sendCaptures('unsent'));
        const ticked = entries.filter((e) => e.selected && !e.sent).length;
        if (canSendAll && selecting && ticked) add(`${verb} selected captures (${ticked})`, () => void sendCaptures('selected'));
        add(selecting ? 'Done selecting' : 'Select captures', () => { selecting = !selecting; menu.hidden = true; render(); }, '');
        add('Clear all', () => { menu.hidden = true; ask({ type: 'stack-clear' }); entries = []; clearTimeout(hideTimer); window.removeEventListener('keydown', onKey, true); host.remove(); }, '');
      }
      add('Capture full page', () => { dismiss(); ask({ type: 'full-page' }); }, 'options');
      add('Add a chat in Options…', () => ask({ type: 'open-options' }), 'options');
      menu.hidden = false;
    }

    // ---- wiring ---------------------------------------------------------------

    $('.send').addEventListener('click', () => void sendTo(o.main));
    $('.more').addEventListener('click', openMenu);
    $('.prev').addEventListener('click', () => go(current - 1, -1));
    $('.next').addEventListener('click', () => go(current + 1, 1));
    $('.close').addEventListener('click', () => { const e = now(); if (e) removeEntry(e); });
    $('.include input').addEventListener('change', (ev) => { const e = now(); e.selected = ev.target.checked; persist(e.id, { selected: e.selected }); });
    $('.annotate').addEventListener('click', () => { const e = now(); ask({ type: 'annotate', id: e.id, text: (e.message || '').trim() }); dismiss(); });
    $('.copy').addEventListener('click', async () => chip((await copy(now(), false)) ? 'Copied' : ''));
    $('.save').addEventListener('click', () => void save(now()));
    // A remembered region is per site; Alt+Shift+R and the right-click menu capture it too.
    $('.region').addEventListener('click', () => { $('.region-menu').hidden = !$('.region-menu').hidden; });
    $('.remember').addEventListener('click', async () => {
      const e = now();
      const r = await ask({ type: 'remember-region', id: e.id });
      $('.region-menu').hidden = true;
      if (r?.ok) { for (const x of entries) if (x.region) x.region.hasSaved = true; $('.capture-saved').disabled = false; chip('Region remembered'); }
    });
    $('.capture-saved').addEventListener('click', () => { dismiss(); ask({ type: 'capture-saved' }); });
    // A saved prompt fills the message; it can still be edited.
    const picker = $('.prompt');
    picker.addEventListener('change', () => {
      input.value = picker.value;
      picker.selectedIndex = 0;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });

    document.documentElement.appendChild(host);

    return {
      host,
      // A new capture, a restore after navigation, or the popup's "Show".
      update(p) {
        o = p;
        chosenDestinations = [...(p.multi || [])];
        entries = p.entries;
        const at = entries.findIndex((e) => e.id === p.currentId);
        current = at >= 0 ? at : entries.length - 1;
        picker.replaceChildren(new Option('Prompt', '', true, true));
        picker.options[0].disabled = true;
        for (const x of p.prompts || []) picker.append(new Option(x.name, x.text));
        picker.hidden = !(p.prompts || []).length;
        deck.classList.remove('out');
        render(0);
        if (p.dropped) toast(`The oldest ${p.dropped > 1 ? `${p.dropped} captures were` : 'capture was'} removed: a tab keeps ${p.cap} at most.`);
        if (p.fresh) {
          const entry = now();
          pngs.set(entry.id, new Blob([bytesOf(p.fresh)], { type: 'image/png' }));
          // Every capture is on the clipboard too, ready for ⌘V / Ctrl+V anywhere.
          copy(entry, false).then((ok) => { if (entry === now()) chip(ok ? 'Copied' : ''); });
          input.focus({ preventScroll: true });
        }
        // "Capture and send": no click needed; the card shows how it went.
        if (p.autoSend) void sendTo(o.main);
      },
    };
  }
})();
