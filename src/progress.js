// The full-page capture's progress, bottom right where the card will open:
// "Capturing 3/8…", with Cancel (or Esc).
(() => {
  window.__shot2aiProgress = (text) => {
    let host = document.getElementById('shot2ai-progress');
    if (!host) {
      host = document.createElement('div');
      host.id = 'shot2ai-progress';
      host.style.cssText = 'all:initial;position:fixed;z-index:2147483647;';
      const root = host.attachShadow({ mode: 'closed' });
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(`
        :host{all:initial}
        .pill{position:fixed;right:20px;bottom:20px;display:flex;align-items:center;gap:12px;padding:10px 10px 10px 14px;border:1px solid #e3e6dd;border-radius:12px;background:#fafaf8;color:#232a23;box-shadow:0 1px 2px rgba(35,42,35,.08),0 14px 40px rgba(35,42,35,.22);font:600 12.5px/1.2 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;font-variant-numeric:tabular-nums}
        .spin{width:14px;height:14px;border:2px solid #cfd8c7;border-top-color:#2f3c30;border-radius:50%;animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        @media (prefers-reduced-motion:reduce){.spin{animation:none}}
        button{font:inherit;font-weight:600;height:28px;padding:0 11px;border:1px solid #dfe2d9;border-radius:7px;background:#fff;color:#2f3c30;cursor:pointer}
        button:hover{background:#f1f3ee}
      `);
      root.adoptedStyleSheets = [sheet];
      root.innerHTML = '<div class="pill" role="status" aria-live="polite"><span class="spin"></span><span class="text"></span><button type="button">Cancel</button></div>';
      const cancel = () => { chrome.runtime.sendMessage({ type: 'cancel-full-page' }); root.querySelector('.text').textContent = 'Cancelling…'; };
      root.querySelector('button').addEventListener('click', cancel);
      const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cancel(); } };
      window.addEventListener('keydown', onKey, true);
      host.__done = () => { window.removeEventListener('keydown', onKey, true); host.remove(); };
      host.__text = (t) => { root.querySelector('.text').textContent = t; };
      document.documentElement.appendChild(host);
    }
    host.__text(text);
    return true;
  };
  window.__shot2aiProgressDone = () => document.getElementById('shot2ai-progress')?.__done?.();
})();
