// The floating toolbar: a small pill on every page, only when the owner has
// switched it on in Options. It reads nothing on the page; it draws itself
// and asks the service worker to capture. It can be dragged (its place is
// kept per site), collapsed to a dot, or hidden on a site.
(() => {
  if (window.top !== window || document.getElementById('shot2ai-toolbar')) return;
  const site = location.origin;
  const NAMES = { chatgpt: 'ChatGPT', claude: 'Claude', html2wp: 'html2wp', copy: 'Copy only', save: 'Save only' };
  const svg = (body) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  const ICON = {
    area: svg('<path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>'),
    visible: svg('<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="M3.5 9h17"/>'),
    region: svg('<path d="M4 9V5.5A1.5 1.5 0 0 1 5.5 4H9M15 4h3.5A1.5 1.5 0 0 1 20 5.5V9M20 15v3.5a1.5 1.5 0 0 1-1.5 1.5H15M9 20H5.5A1.5 1.5 0 0 1 4 18.5V15" stroke-dasharray="2.5 2.5"/><circle cx="12" cy="12" r="2.5"/>'),
    grip: svg('<circle cx="9" cy="7" r=".6"/><circle cx="15" cy="7" r=".6"/><circle cx="9" cy="12" r=".6"/><circle cx="15" cy="12" r=".6"/><circle cx="9" cy="17" r=".6"/><circle cx="15" cy="17" r=".6"/>'),
    collapse: svg('<path d="M6 12h12"/>'),
    more: svg('<circle cx="6" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="18" cy="12" r=".8"/>'),
  };
  const CSS = `
    :host{all:initial}
    *{box-sizing:border-box}
    button{font:inherit;color:inherit;border:0;background:none;padding:0;cursor:pointer}
    svg{width:16px;height:16px;display:block}
    .bar{position:fixed;display:flex;align-items:center;gap:2px;height:38px;padding:3px;border:1px solid rgba(35,42,35,.14);border-radius:999px;background:rgba(250,250,248,.97);color:#2f3c30;box-shadow:0 6px 22px rgba(20,28,20,.18);font:600 11.5px/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-font-smoothing:antialiased;user-select:none}
    .grip{display:grid;place-items:center;width:18px;height:30px;color:#9aa491;cursor:grab}
    .grip:active{cursor:grabbing}
    .act{display:flex;align-items:center;gap:5px;height:30px;padding:0 9px;border-radius:999px}
    .act:hover,.icon:hover{background:#eceee7}
    .dest{max-width:110px;height:24px;padding:0 9px;margin:0 2px;border-radius:999px;background:#e9efe4;color:#34502a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .icon{display:grid;place-items:center;width:28px;height:30px;border-radius:999px;color:#6f7c64}
    .dot{position:fixed;display:grid;place-items:center;width:38px;height:38px;border-radius:50%;background:#16964c;color:#fff;box-shadow:0 6px 22px rgba(20,28,20,.25);cursor:pointer}
    .dot svg{width:18px;height:18px}
    .menu{position:fixed;min-width:170px;padding:5px;border:1px solid #e3e6dd;border-radius:10px;background:#fff;color:#232a23;box-shadow:0 12px 32px rgba(35,42,35,.18);font:500 12.5px ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    .menu button{display:block;width:100%;padding:8px 9px;border-radius:6px;text-align:left}
    .menu button:hover{background:#f1f3ee}
    [hidden]{display:none!important}
  `;
  const host = document.createElement('div');
  host.id = 'shot2ai-toolbar';
  host.style.cssText = 'all:initial;position:fixed;z-index:2147483646;';
  const root = host.attachShadow({ mode: 'closed' });
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(CSS);
  root.adoptedStyleSheets = [sheet];
  root.innerHTML = `
    <div class="bar" role="toolbar" aria-label="Shot2AI">
      <span class="grip" title="Drag to move">${ICON.grip}</span>
      <button class="act" data-action="area" title="Capture an area">${ICON.area}Area</button>
      <button class="act" data-action="visible" title="Capture the visible page">${ICON.visible}Visible</button>
      <button class="act" data-action="saved" title="Capture this site's saved region">${ICON.region}Region</button>
      <button class="dest" title="Default destination: change it in Options"></button>
      <button class="icon collapse" aria-label="Collapse the toolbar" title="Collapse">${ICON.collapse}</button>
      <button class="icon more" aria-label="More" title="More">${ICON.more}</button>
    </div>
    <button class="dot" aria-label="Open the Shot2AI toolbar" title="Shot2AI" hidden>${ICON.area}</button>
    <div class="menu" role="menu" hidden>
      <button data-menu="hide" role="menuitem">Hide on this site</button>
      <button data-menu="options" role="menuitem">Shot2AI options</button>
    </div>`;
  const $ = (s) => root.querySelector(s);
  const bar = $('.bar');
  const dot = $('.dot');
  const menu = $('.menu');
  let state = { collapsed: false, pos: null };

  // Kept inside the viewport, whatever the window size is now.
  function place() {
    const el = state.collapsed ? dot : bar;
    const w = el.offsetWidth || 300;
    const h = el.offsetHeight || 38;
    const x = Math.min(Math.max(8, state.pos?.x ?? 20), Math.max(8, innerWidth - w - 8));
    const y = Math.min(Math.max(8, state.pos?.y ?? innerHeight - h - 20), Math.max(8, innerHeight - h - 8));
    for (const e of [bar, dot]) Object.assign(e.style, { left: `${x}px`, top: `${y}px` });
    Object.assign(menu.style, { left: `${Math.min(x, innerWidth - 190)}px`, top: `${Math.max(8, y - 90)}px` });
  }
  function show(collapsed) {
    state.collapsed = collapsed;
    bar.hidden = collapsed;
    dot.hidden = !collapsed;
    menu.hidden = true;
    place();
  }

  async function load() {
    const s = await chrome.storage.local.get(['toolbar', 'toolbarHidden', 'toolbarPos', 'defaultDestination', 'customChats']);
    const enabled = !!s.toolbar?.enabled && !(s.toolbarHidden || {})[site];
    if (!enabled) { host.remove(); return; }
    const id = s.defaultDestination || 'chatgpt';
    $('.dest').textContent = `→ ${NAMES[id] || (s.customChats || []).find((c) => c.id === id)?.name || 'ChatGPT'}`;
    state.pos = (s.toolbarPos || {})[site] || null;
    if (!host.isConnected) document.documentElement.appendChild(host);
    show(!!s.toolbar?.collapsed);
  }
  const save = async (patch) => {
    const s = await chrome.storage.local.get(['toolbar', 'toolbarPos', 'toolbarHidden']);
    if (patch.collapsed !== undefined) await chrome.storage.local.set({ toolbar: { ...s.toolbar, collapsed: patch.collapsed } });
    if (patch.pos) await chrome.storage.local.set({ toolbarPos: { ...(s.toolbarPos || {}), [site]: patch.pos } });
    if (patch.hide) await chrome.storage.local.set({ toolbarHidden: { ...(s.toolbarHidden || {}), [site]: true } });
  };

  // The toolbar leaves the screen while the page is captured.
  async function capture(action) {
    host.style.visibility = 'hidden';
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    try { await chrome.runtime.sendMessage({ type: 'toolbar', action }); } finally { host.style.visibility = ''; }
  }
  for (const b of root.querySelectorAll('[data-action]')) b.addEventListener('click', () => void capture(b.dataset.action));
  $('.dest').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-options' }));
  $('.collapse').addEventListener('click', () => { show(true); void save({ collapsed: true }); });
  dot.addEventListener('click', () => { if (!dragged) { show(false); void save({ collapsed: false }); } });
  $('.more').addEventListener('click', () => { menu.hidden = !menu.hidden; });
  root.querySelector('[data-menu="hide"]').addEventListener('click', () => { host.remove(); void save({ hide: true }); });
  root.querySelector('[data-menu="options"]').addEventListener('click', () => { menu.hidden = true; chrome.runtime.sendMessage({ type: 'open-options' }); });
  root.addEventListener('keydown', (e) => e.stopPropagation());

  // Dragged by its grip (or the dot); the place is kept for this site.
  let drag = null;
  let dragged = false;
  // The handle keeps the pointer while dragging; the bar or dot moves.
  const startDrag = (e, handle, moving) => {
    if (e.button !== 0) return;
    const r = moving.getBoundingClientRect();
    drag = { dx: e.clientX - r.left, dy: e.clientY - r.top, x0: e.clientX, y0: e.clientY };
    dragged = false;
    handle.setPointerCapture(e.pointerId);
  };
  for (const el of [$('.grip'), dot]) {
    el.addEventListener('pointerdown', (e) => startDrag(e, el, el === dot ? dot : bar));
    el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 3) dragged = true;
      state.pos = { x: Math.round(e.clientX - drag.dx), y: Math.round(e.clientY - drag.dy) };
      place();
    });
    el.addEventListener('pointerup', () => {
      if (!drag) return;
      drag = null;
      if (dragged) void save({ pos: { x: parseInt(bar.style.left, 10), y: parseInt(bar.style.top, 10) } });
      setTimeout(() => { dragged = false; }, 0);
    });
  }
  addEventListener('resize', place);
  chrome.storage.onChanged.addListener((changes) => {
    if (['toolbar', 'toolbarHidden', 'defaultDestination', 'customChats'].some((k) => k in changes)) void load();
  });
  void load();
})();
