// The quick preview card: a small floating card in the page's corner right
// after an area is selected. One click sends the screenshot to the default
// destination (html2wp unless another was used last); Annotate opens the full
// editor. Everything the card asks for goes through the extension's service
// worker; only the clipboard is written here, while the page has focus.
(() => {
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    .card{position:fixed;right:20px;bottom:20px;width:264px;padding:10px;border:1px solid #e3e6dd;border-radius:14px;background:#fafaf8;color:#232a23;box-shadow:0 1px 2px rgba(35,42,35,.08),0 14px 40px rgba(35,42,35,.22);font:13px/1.4 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;animation:in .18s ease-out}
    @keyframes in{from{opacity:0;transform:translateY(10px) scale(.98)}}
    .card.out{opacity:0;transform:translateY(10px);transition:opacity .2s,transform .2s}
    button{font:inherit;color:inherit;cursor:pointer;border:0;background:none;padding:0}
    button:disabled{cursor:default;opacity:.5}
    svg{width:16px;height:16px;display:block}
    .shot{position:relative;display:grid;place-items:center;height:132px;border-radius:9px;background:#eef0ea;overflow:hidden}
    .shot canvas{display:block;max-width:100%;max-height:132px;border-radius:4px;box-shadow:0 0 0 1px rgba(35,42,35,.08)}
    .close{position:absolute;top:6px;right:6px;display:grid;place-items:center;width:24px;height:24px;border-radius:50%;background:rgba(35,42,35,.62);color:#fff}
    .close svg{width:12px;height:12px}
    .close:hover{background:rgba(35,42,35,.85)}
    .chip{position:absolute;left:6px;bottom:6px;display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:999px;background:rgba(47,60,48,.88);color:#fff;font-size:11px;font-weight:560}
    .chip svg{width:11px;height:11px}
    .message{width:100%;height:34px;margin:9px 0 8px;padding:0 10px;border:1px solid #dfe2d9;border-radius:8px;background:#fff;color:#232a23;font:13px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;outline:none}
    .message::placeholder{color:#a6ae9b}
    .message:focus{border-color:#547254;box-shadow:0 0 0 2px rgba(84,114,84,.2)}
    .split{position:relative;display:flex;height:36px;border-radius:8px;background:#2f3c30;color:#fff}
    .send{flex:1;display:flex;align-items:center;justify-content:center;gap:7px;min-width:0;padding:0 10px;border-radius:8px 0 0 8px;font-weight:600;font-size:12.5px;white-space:nowrap}
    .send span{overflow:hidden;text-overflow:ellipsis}
    .more{display:grid;place-items:center;width:34px;border-left:1px solid rgba(255,255,255,.18);border-radius:0 8px 8px 0}
    .send:hover:not(:disabled),.more:hover:not(:disabled){background:#465b43}
    .menu{position:absolute;right:0;bottom:42px;left:0;padding:5px;border:1px solid #e3e6dd;border-radius:10px;background:#fff;box-shadow:0 12px 32px rgba(35,42,35,.18);color:#232a23;z-index:1}
    .menu .head{padding:5px 8px 4px;font-size:10px;font-weight:650;letter-spacing:.08em;text-transform:uppercase;color:#969f88}
    .menu button{display:flex;align-items:center;justify-content:space-between;width:100%;padding:7px 8px;border-radius:6px;text-align:left;font-size:12.5px}
    .menu button:hover{background:#f1f3ee}
    .menu small{color:#969f88;font-size:11px}
    .menu .options{border-top:1px solid #eef0ea;margin-top:4px;border-radius:0 0 6px 6px;color:#547254}
    .tools{display:flex;gap:4px;margin-top:8px}
    .tools button{flex:1;display:flex;align-items:center;justify-content:center;gap:5px;height:30px;border-radius:7px;color:#4d5a47;font-size:11.5px;font-weight:560}
    .tools button:hover{background:#eef0ea}
    .tools svg{width:14px;height:14px}
    .result{margin-top:8px;padding:8px 10px;border:1px solid #e3e6dd;border-radius:8px;background:#fff;font-size:12px;line-height:1.45}
    .result.ok{border-color:#d5e3c8;background:#edf3e7;color:#34502a}
    .result.warn{border-color:#efe2c2;background:#faf3e3;color:#5f4a1f}
    .result.err{border-color:#eed8d0;background:#fbefeb;color:#6f3f33}
    .result .actions{display:flex;gap:6px;margin-top:7px}
    .result .actions button{display:inline-flex;align-items:center;gap:5px;height:28px;padding:0 10px;border:1px solid #dfe2d9;border-radius:6px;background:#fff;color:#2f3c30;font-size:11.5px;font-weight:600}
    .result .actions button.primary{border-color:#2f3c30;background:#2f3c30;color:#fff}
    .result .actions svg{width:13px;height:13px}
    .saved{margin-top:6px;font-size:10.5px;color:#969f88;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    [hidden]{display:none!important}
  `;

  window.__shot2aiShowCard = (o) => {
    document.getElementById('shot2ai-preview-card')?.remove();
    const host = document.createElement('div');
    host.id = 'shot2ai-preview-card';
    host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    // A constructed stylesheet: a page's style-src policy does not apply to it.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(CSS);
    root.adoptedStyleSheets = [sheet];
    const i = o.icons;
    root.innerHTML = `<div class="card" role="dialog" aria-label="Shot2AI screenshot preview">
      <div class="shot"><canvas aria-label="Captured area"></canvas>
        <button class="close" aria-label="Dismiss" title="Dismiss (Esc)">${i.close}</button>
        <span class="chip" hidden>${i.check}<span></span></span></div>
      <input class="message" placeholder="Add a message (optional)" aria-label="Message" maxlength="2000">
      <div class="split"><button class="send">${{ copy: i.copy, save: i.download }[o.main.kind] || i.send}<span></span></button><button class="more" aria-label="More destinations" aria-haspopup="menu" title="More destinations">${i.chevron}</button>
        <div class="menu" role="menu" hidden></div></div>
      <div class="tools">
        <button class="annotate" title="Open in the editor to draw arrows, boxes and text">${i.annotate}Annotate</button>
        <button class="copy" title="Copy to the clipboard">${i.copy}Copy</button>
        <button class="save" title="Save a copy">${i.download}Save</button>
      </div>
      <div class="result" role="status" hidden></div>
      <div class="saved" hidden></div>
    </div>`;
    const $ = (s) => root.querySelector(s);
    const card = $('.card');
    const input = $('.message');
    const bytes = Uint8Array.from(atob(o.png), (c) => c.charCodeAt(0));
    const png = new Blob([bytes], { type: 'image/png' });
    // The main button: the chosen default destination, or Copy.
    const main = o.main;
    let busy = false;
    let lastOk = false;
    let hovered = false;
    let hideTimer = 0;

    createImageBitmap(png).then((bitmap) => {
      const canvas = $('canvas');
      const room = Math.min(244 / bitmap.width, 132 / bitmap.height, 1);
      canvas.width = Math.round(bitmap.width * room * 2);
      canvas.height = Math.round(bitmap.height * room * 2);
      canvas.style.width = `${canvas.width / 2}px`;
      canvas.style.height = `${canvas.height / 2}px`;
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    });

    const chip = (text) => { $('.chip span').textContent = text; $('.chip').hidden = !text; };
    const label = () => { $('.send span').textContent = main.label; };
    label();
    if (o.saved) { $('.saved').textContent = $('.saved').title = o.saved; $('.saved').hidden = false; }

    const dismiss = () => {
      clearTimeout(hideTimer);
      window.removeEventListener('keydown', onKey, true);
      card.classList.add('out');
      setTimeout(() => host.remove(), 200);
      chrome.runtime.sendMessage({ type: 'card-closed', id: o.id }).catch(() => {});
    };
    // Hide only after a success, and never while the owner is on the card.
    const scheduleHide = () => {
      clearTimeout(hideTimer);
      if (lastOk && !hovered && root.activeElement !== input) hideTimer = setTimeout(dismiss, 6000);
    };
    card.addEventListener('mouseenter', () => { hovered = true; clearTimeout(hideTimer); });
    card.addEventListener('mouseleave', () => { hovered = false; scheduleHide(); });
    input.addEventListener('focus', () => clearTimeout(hideTimer));
    input.addEventListener('input', () => clearTimeout(hideTimer));
    input.addEventListener('blur', () => setTimeout(scheduleHide, 0));
    // Keys typed in the card stay in the card.
    card.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && e.target === input) { e.preventDefault(); void sendTo(main); }
    });
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (!$('.menu').hidden) { $('.menu').hidden = true; return; }
      e.preventDefault(); e.stopPropagation(); dismiss();
    };
    window.addEventListener('keydown', onKey, true);

    function show(tone, text, actions = []) {
      const box = $('.result');
      box.className = `result ${tone}`;
      box.textContent = text;
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
      box.hidden = !text;
    }
    const setBusy = (on) => { busy = on; for (const b of root.querySelectorAll('.send,.more')) b.disabled = on; if (on) $('.send span').textContent = 'Sending…'; else label(); };

    async function copy(withText) {
      const items = { 'image/png': png };
      if (withText && input.value.trim()) items['text/plain'] = new Blob([input.value.trim()], { type: 'text/plain' });
      try { await navigator.clipboard.write([new ClipboardItem(items)]); return true; } catch { return false; }
    }

    async function save() {
      const r = await chrome.runtime.sendMessage({ type: 'save', id: o.id });
      $('.saved').textContent = $('.saved').title = r?.text || 'The screenshot could not be saved.';
      $('.saved').hidden = false;
    }

    async function sendTo(destination, confirmed = false) {
      if (busy) return;
      $('.menu').hidden = true;
      if (destination.kind === 'copy') { chip((await copy(true)) ? 'Copied' : ''); return; }
      if (destination.kind === 'save') { await save(); return; }
      const text = input.value.trim();
      if (destination.kind === 'chat') {
        // A web chat is a website: say so once, before anything goes there.
        if (!confirmed && !o.acknowledged[destination.origin]) {
          show('warn', `${destination.name} is a website. The screenshot and message will go to ${destination.host}, not only to this Mac.`,
            [['Continue', () => { o.acknowledged[destination.origin] = true; void sendTo(destination, true); }, true, 'send'], ['Cancel', () => show('', '')]]);
          return;
        }
        // Copied first, while this page has focus: the fallback if pasting fails.
        const copied = await copy(true);
        setBusy(true);
        const r = await chrome.runtime.sendMessage({ type: 'card-send', id: o.id, destination: destination.id, text, acknowledge: destination.origin });
        setBusy(false);
        lastOk = !!r?.ok;
        if (r?.ok) { show('ok', `Pasted into ${destination.name}. Press Enter there to send.`); input.value = ''; input.blur(); scheduleHide(); return; }
        if (r?.needsPermission) { show('warn', `Allow the extension to use ${destination.host} in Options first.`, [['Open Options', () => chrome.runtime.sendMessage({ type: 'open-options' }), true]]); return; }
        show(copied ? 'warn' : 'err', copied ? `Copied. Paste with ${o.mod}V in ${destination.name}.` : `The screenshot could not be pasted into ${destination.name}. Use Copy, then paste it there.`);
        return;
      }
      setBusy(true);
      const r = await chrome.runtime.sendMessage({ type: 'card-send', id: o.id, destination: 'html2wp', text });
      setBusy(false);
      lastOk = !!r?.ok;
      if (r?.ok) { show('ok', r.text); input.value = ''; input.blur(); scheduleHide(); return; }
      const retry = ['Try again', () => void sendTo(destination), true, 'retry'];
      if (r?.unpaired) show('warn', r.text, [['Open Options', () => chrome.runtime.sendMessage({ type: 'open-options' }), true]]);
      else show(r?.reason !== undefined ? 'warn' : 'err', r?.text || 'html2wp did not answer.', [retry]);
    }

    $('.send').addEventListener('click', () => void sendTo(main));
    $('.more').addEventListener('click', () => {
      const menu = $('.menu');
      menu.innerHTML = '<div class="head">Send to</div>';
      for (const d of o.destinations) {
        const b = document.createElement('button');
        b.setAttribute('role', 'menuitem');
        b.innerHTML = '<span></span><small></small>';
        b.querySelector('span').textContent = d.name;
        b.querySelector('small').textContent = d.kind === 'html2wp' ? 'this Mac' : d.host;
        b.addEventListener('click', () => void sendTo(d));
        menu.append(b);
      }
      const add = document.createElement('button');
      add.className = 'options';
      add.textContent = 'Add a chat in Options…';
      add.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-options' }));
      menu.append(add);
      menu.hidden = !menu.hidden;
    });
    $('.close').addEventListener('click', dismiss);
    $('.annotate').addEventListener('click', () => { chrome.runtime.sendMessage({ type: 'annotate', id: o.id, text: input.value.trim() }); dismiss(); });
    $('.copy').addEventListener('click', async () => chip((await copy(false)) ? 'Copied' : ''));
    $('.save').addEventListener('click', () => void save());

    if (o.text) input.value = o.text;
    document.documentElement.appendChild(host);
    // Every capture is on the clipboard too, ready for ⌘V / Ctrl+V anywhere.
    copy(false).then((ok) => chip(ok ? 'Copied' : ''));
    input.focus({ preventScroll: true });
    // "Capture and send": no click needed; the card shows how it went.
    if (o.autoSend) void sendTo(main);
    return true;
  };
})();
