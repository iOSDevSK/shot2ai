// Looks only for explicit Shot2AI markers. No page text or screenshots are read.
(() => {
  if (window.__shot2aiIntegrations) return;
  window.__shot2aiIntegrations = true;
  const states = new WeakMap();
  const markers = new Set();
  let enabled = true, timer;
  const ask = async message => { try { return await chrome.runtime.sendMessage(message); } catch { return null; } };
  const request = element => ({ tag: element.getAttribute('data-shot2ai'), url: element.getAttribute('data-shot2ai-url') || location.href });
  const keyOf = element => JSON.stringify(request(element));
  function display(element, ready) {
    element.dataset.shot2aiState = ready ? 'ready' : 'install';
    for (const part of element.querySelectorAll('[data-shot2ai-install]')) part.hidden = ready;
    for (const part of element.querySelectorAll('[data-shot2ai-ready]')) part.hidden = !ready;
  }
  async function check(element) {
    if (!element.isConnected || !element.matches('a[data-shot2ai],button[data-shot2ai]')) return;
    const key = keyOf(element);
    if (states.get(element)?.key === key) return;
    const state = { key, ready: false, busy: false }; states.set(element, state); markers.add(element);
    display(element, false);
    const result = enabled && await ask({ type: 'integration-check', ...request(element) });
    if (states.get(element) !== state || key !== keyOf(element)) return;
    state.ready = !!result?.ok; display(element, state.ready);
  }
  function scan() {
    for (const element of markers) if (!element.isConnected) markers.delete(element);
    for (const element of document.querySelectorAll('a[data-shot2ai],button[data-shot2ai]')) void check(element);
  }
  document.addEventListener('click', async event => {
    const element = event.target.closest?.('a[data-shot2ai],button[data-shot2ai]');
    const state = element && states.get(element);
    if (!enabled || !state?.ready || state.key !== keyOf(element)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // A synthetic page click cannot send a prompt or launch the chat.
    if (!event.isTrusted || state.busy) return;
    state.busy = true; element.setAttribute('aria-busy', 'true');
    try {
      const result = await ask({ type: 'integration-open', ...request(element) });
      if (!result?.ok) {
        const note = document.createElement('span'); note.setAttribute('role', 'status');
        note.textContent = result?.text || 'Open Shot2AI and enable Website integrations, then reload this page.';
        element.after(note); setTimeout(() => note.remove(), 8000);
      }
    } finally { state.busy = false; element.removeAttribute('aria-busy'); }
  }, true);
  new MutationObserver(records => {
    if (!records.some(r => r.type === 'attributes' || [...r.addedNodes].some(n => n.nodeType === 1 && (n.matches?.('[data-shot2ai]') || n.querySelector?.('[data-shot2ai]'))))) return;
    clearTimeout(timer); timer = setTimeout(scan, 100);
  }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-shot2ai', 'data-shot2ai-url'] });
  chrome.storage.onChanged.addListener(changes => {
    if ('websiteIntegrations' in changes) {
      enabled = !!changes.websiteIntegrations.newValue;
      for (const element of markers) { states.delete(element); display(element, false); }
      if (enabled) scan();
    }
  });
  addEventListener('popstate', scan);
  addEventListener('hashchange', scan);
  scan();
})();
