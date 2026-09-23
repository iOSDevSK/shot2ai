// Area selection over the page: the page is dimmed, the owner drags a
// rectangle, Esc cancels. Only the rectangle goes back to the extension; the
// page itself was already captured before this overlay appeared.
(() => {
  window.__shot2aiSelectArea = (captureId) => {
    document.getElementById('shot2ai-area-select')?.remove();
    const host = document.createElement('div');
    host.id = 'shot2ai-area-select';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const root = host.attachShadow({ mode: 'closed' });
    // A constructed stylesheet: a page's style-src policy does not apply to it.
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      :host{all:initial}
      .layer{position:fixed;inset:0;cursor:crosshair;background:rgba(24,31,24,.42);user-select:none;-webkit-user-select:none}
      .layer.selecting{background:transparent}
      .box{position:fixed;display:none;border:1.5px solid #fff;outline:1px solid rgba(47,60,48,.55);box-shadow:0 0 0 100vmax rgba(24,31,24,.42);border-radius:2px;pointer-events:none}
      .size{position:fixed;display:none;padding:4px 8px;border-radius:6px;background:#2f3c30;color:#fff;font:600 11px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums;letter-spacing:.02em;pointer-events:none;white-space:nowrap}
      .hint{position:fixed;top:18px;left:50%;transform:translateX(-50%);display:flex;gap:10px;align-items:center;padding:9px 14px;border-radius:999px;background:rgba(250,250,248,.96);color:#2f3c30;box-shadow:0 6px 24px rgba(20,28,20,.18);font:500 12.5px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none;white-space:nowrap}
      .hint b{font-weight:650}
      .hint kbd{font:600 10.5px/1 ui-monospace,SFMono-Regular,Menlo,monospace;padding:3px 6px;border:1px solid #dfe2d9;border-bottom-width:2px;border-radius:5px;background:#fff;color:#547254}
      .layer.selecting~.hint{opacity:0}
    `);
    root.adoptedStyleSheets = [sheet];
    root.innerHTML = `<div class="layer" part="layer"></div><div class="box"></div><div class="size"></div>
    <div class="hint"><b>Shot2AI</b><span>Drag to select an area</span><kbd>Esc</kbd><span>cancels</span></div>`;
    const layer = root.querySelector('.layer');
    const box = root.querySelector('.box');
    const size = root.querySelector('.size');
    let start = null;
    let rect = null;

    const finish = (message) => {
      window.removeEventListener('keydown', onKey, true);
      host.remove();
      chrome.runtime.sendMessage({ ...message, id: captureId });
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish({ type: 'area-cancelled' }); }
    };
    const draw = () => {
      box.style.display = size.style.display = 'block';
      Object.assign(box.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      size.textContent = `${Math.round(rect.width)} × ${Math.round(rect.height)}`;
      const below = rect.y + rect.height + 30 < innerHeight;
      size.style.left = `${Math.min(rect.x, innerWidth - 90)}px`;
      size.style.top = `${below ? rect.y + rect.height + 8 : Math.max(8, rect.y - 28)}px`;
    };
    layer.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      layer.setPointerCapture(e.pointerId);
      start = { x: e.clientX, y: e.clientY };
      rect = { x: start.x, y: start.y, width: 0, height: 0 };
      layer.classList.add('selecting');
      draw();
    });
    layer.addEventListener('pointermove', (e) => {
      if (!start) return;
      const x = Math.max(0, Math.min(e.clientX, innerWidth));
      const y = Math.max(0, Math.min(e.clientY, innerHeight));
      rect = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
      draw();
    });
    layer.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      if (rect.width < 4 || rect.height < 4) {
        // A click without a drag: start again.
        layer.classList.remove('selecting');
        box.style.display = size.style.display = 'none';
        return;
      }
      finish({ type: 'area-selected', rect, viewport: { width: innerWidth, height: innerHeight }, dpr: devicePixelRatio });
    });
    // The capture is fixed: the page must not scroll under the selection.
    host.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
    window.addEventListener('keydown', onKey, true);
    document.documentElement.appendChild(host);
    return true;
  };
})();
