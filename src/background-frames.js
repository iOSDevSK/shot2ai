// Some chats render attachment previews and answers through animation frames.
// Chromium suspends those frames in a background tab. During sending and
// answer watching, give queued frames a fallback without changing focus or
// visibility. The extension also pulses the queue when page timers stall.
// This function runs in MAIN so it wraps the site's scheduler, not ours.
export function backgroundFrames(action, token) {
  const key = '__shot2aiBackgroundFrames';
  let state = window[key];
  if (!state && action !== 'start') return;
  if (!state) {
    const request = window.requestAnimationFrame;
    const cancel = window.cancelAnimationFrame;
    const pending = new Map();
    const leases = new Map();
    const run = (id, time) => {
      const item = pending.get(id);
      if (!item) return;
      pending.delete(id);
      clearTimeout(item.timer);
      cancel.call(window, id);
      item.callback.call(window, time);
    };
    const wrappedRequest = (callback) => {
      const id = request.call(window, (time) => run(id, time));
      const item = { callback, at: performance.now(), timer: 0 };
      pending.set(id, item);
      if (document.hidden) item.timer = setTimeout(() => run(id, performance.now()), 100);
      return id;
    };
    const wrappedCancel = (id) => {
      clearTimeout(pending.get(id)?.timer);
      pending.delete(id);
      cancel.call(window, id);
    };
    const restore = () => {
      clearTimeout(state.expiry);
      if (window.requestAnimationFrame === wrappedRequest) window.requestAnimationFrame = request;
      if (window.cancelAnimationFrame === wrappedCancel) window.cancelAnimationFrame = cancel;
      // Leave native requests in place; their callbacks still run normally
      // when the tab becomes visible. Only our fallback timers are removed.
      for (const item of pending.values()) clearTimeout(item.timer);
      if (window[key] === state) delete window[key];
    };
    const expire = () => {
      const now = Date.now();
      for (const [id, until] of leases) if (until <= now) leases.delete(id);
      if (!leases.size) { restore(); return; }
      clearTimeout(state.expiry);
      state.expiry = setTimeout(expire, Math.max(1, Math.min(...leases.values()) - now));
    };
    state = { leases, restore, expire, expiry: 0, pulse: () => {
      if (!document.hidden) return;
      // Snapshot the queue: callbacks may enqueue the next frame.
      for (const [id, item] of [...pending]) if (performance.now() - item.at >= 100) {
        try { run(id, performance.now()); } catch (error) { queueMicrotask(() => { throw error; }); }
      }
    } };
    window[key] = state;
    window.requestAnimationFrame = wrappedRequest;
    window.cancelAnimationFrame = wrappedCancel;
  }
  if (action === 'stop') state.leases.delete(token);
  else if (action === 'start' || state.leases.has(token)) state.leases.set(token, Date.now() + 120000);
  state.expire();
  if (state.leases.size && action === 'pulse') state.pulse();
}

export async function controlBackgroundFrames(tabId, token, action) {
  if (!token) return;
  await chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: backgroundFrames, args: [action, token] });
}
