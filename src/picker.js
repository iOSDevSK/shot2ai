// The chat's model picker, inside the chat's tab: read the names it lists, or
// choose one of them and check that the chat took it. Only the picker's own
// button, its items (and at most one "more models" item) are clicked, and
// only by this script; nothing else on the page is touched. The service
// worker injects it (webchat.js) with the chat's selectors from src/sites/.
//
// The chat's tab is usually in the background, where the browser runs timers
// late, so every wait ends on a change to the page (a MutationObserver); its
// timer is only the deadline. Names are the ones the chat shows: the sites
// rename their models, so Shot2AI never assumes a list of its own.
(() => {
  if (window.__shot2aiPicker) return;
  const visible = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
  const until = (check, ms) => new Promise((resolve) => {
    let observer = null;
    let timer = 0;
    const finish = (value) => { observer?.disconnect(); clearTimeout(timer); resolve(value); };
    const first = check();
    if (first) { finish(first); return; }
    observer = new MutationObserver(() => { const value = check(); if (value) finish(value); });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    timer = setTimeout(() => finish(check() || null), ms);
  });
  const all = (list) => (list.length ? [...document.querySelectorAll(list.join(','))] : []);
  const flat = (t) => String(t || '').replace(/\s+/g, ' ').trim();
  // For matching only: lower case, words and version numbers.
  const norm = (t) => flat(t).toLowerCase().replace(/[^\p{L}\p{N}.+]+/gu, ' ').trim();
  const lines = (el) => (el.innerText || el.textContent || '').split('\n').map(flat).filter(Boolean);
  // What a chat says when a model is not on the owner's plan.
  const PLAN = /(upgrade|available (on|with|in)|unlock|subscribe|requires? (a )?(paid|pro|plus|max|team)|only (on|with|for|in) (pro|plus|max|team|paid))/i;

  // Radix-style menus open on pointerdown, others on click: the whole
  // sequence covers both. The keyboard is the fallback.
  function press(el) {
    const at = el.getBoundingClientRect();
    const base = { bubbles: true, cancelable: true, composed: true, clientX: at.left + at.width / 2, clientY: at.top + at.height / 2, button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', { ...base, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mousedown', base));
    el.dispatchEvent(new PointerEvent('pointerup', { ...base, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', base));
    el.click();
  }
  const key = (el, name) => el.dispatchEvent(new KeyboardEvent('keydown', { key: name, code: name, bubbles: true, cancelable: true }));

  // The items of an open menu: name (the site's name element, or the item's
  // first line), the rest of its text, and whether it is chosen, disabled or
  // opens a further menu.
  function items(model, menu) {
    const found = model.items.length ? [...menu.querySelectorAll(model.items.join(','))] : [];
    return found.filter((el, i) => visible(el) && !found.some((o, j) => j !== i && o.contains(el))).map((el) => {
      const named = model.label.map((s) => el.querySelector(s)).find((x) => x && flat(x.textContent));
      const text = lines(el);
      const name = named ? flat(named.textContent) : text[0] || '';
      const rest = text.filter((l) => l !== name).join(' · ');
      const checked = el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'checked';
      const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled') || el.disabled === true;
      return { el, name, rest, checked, disabled, submenu: el.hasAttribute('aria-haspopup') || el.hasAttribute('aria-expanded') };
    }).filter((x) => x.name);
  }
  const button = (model) => all(model.button).find(visible) || null;

  // Opens the picker; returns the menu that appeared (menus are often put at
  // the end of the page, away from the button).
  async function open(model, trigger) {
    const before = new Set(all(model.menu).filter(visible));
    const fresh = () => all(model.menu).find((m) => visible(m) && !before.has(m) && items(model, m).length) || null;
    press(trigger);
    let menu = await until(fresh, 1500);
    if (!menu) { trigger.focus(); key(trigger, 'Enter'); menu = await until(fresh, 1500); }
    if (!menu) { key(trigger, 'ArrowDown'); menu = await until(fresh, 1200); }
    return menu;
  }
  // Closes whatever this script opened: Escape, then the button once more.
  async function close(model, trigger, menus) {
    const open = () => menus.some((m) => m.isConnected && visible(m));
    if (!open()) return;
    for (const m of menus) if (m.isConnected) key(m, 'Escape');
    key(document, 'Escape');
    if (await until(() => !open(), 800)) return;
    if (trigger?.isConnected) press(trigger);
    await until(() => !open(), 800);
  }
  const shows = (model, name) => { const b = button(model); return !!b && ` ${norm(b.innerText || b.textContent)} `.includes(` ${norm(name)} `); };

  // The names in the picker, and the one chosen now.
  async function read(model) {
    const trigger = button(model);
    if (!trigger) return { ok: false, reason: 'modelPicker' };
    const menu = await open(model, trigger);
    if (!menu) return { ok: false, reason: 'modelPicker' };
    const list = items(model, menu).filter((x) => !x.submenu);
    const names = [...new Set(list.map((x) => x.name))];
    const current = list.find((x) => x.checked)?.name || null;
    await close(model, trigger, [menu]);
    return { ok: true, names, current };
  }

  // The item for `want`: the same name, else the only one that starts with
  // it, else the only one that has it as a whole word. Several: refused.
  function match(list, want) {
    const w = norm(want);
    const exact = list.filter((x) => norm(x.name) === w);
    if (exact.length) return { item: exact[0] };
    for (const test of [(n) => n.startsWith(`${w} `), (n) => ` ${n} `.includes(` ${w} `)]) {
      const found = list.filter((x) => test(norm(x.name)));
      if (found.length === 1) return { item: found[0] };
      if (found.length > 1) return { several: found.map((x) => x.name) };
    }
    return {};
  }

  // Chooses `want`, and checks the chat shows it. Returns { ok, name, names }
  // or { ok: false, reason, detail, names } with reason modelPicker,
  // modelMissing, modelAmbiguous, modelPlan or modelNotSwitched.
  async function choose(model, want) {
    const trigger = button(model);
    if (!trigger) return { ok: false, reason: 'modelPicker' };
    const menus = [];
    const menu = await open(model, trigger);
    if (!menu) return { ok: false, reason: 'modelPicker' };
    menus.push(menu);
    let list = items(model, menu);
    const names = list.filter((x) => !x.submenu).map((x) => x.name);
    let found = match(list.filter((x) => !x.submenu), want);
    // Not on the first level: the one "more models" item, opened once.
    const more = !found.item && !found.several && list.find((x) => x.submenu);
    if (more) {
      const before = new Set(all(model.menu).filter(visible));
      press(more.el);
      key(more.el, 'ArrowRight');
      const sub = await until(() => all(model.menu).find((m) => visible(m) && !before.has(m) && items(model, m).length) || null, 1500);
      if (sub) {
        menus.push(sub);
        list = items(model, sub).filter((x) => !x.submenu);
        names.push(...list.map((x) => x.name));
        found = match(list, want);
      }
    }
    const done = async (result) => { await close(model, trigger, menus); return { ...result, names: [...new Set(names)] }; };
    if (found.several) return done({ ok: false, reason: 'modelAmbiguous', detail: found.several.join(', ') });
    if (!found.item) return done({ ok: false, reason: 'modelMissing' });
    const { item } = found;
    if (item.disabled || PLAN.test(item.rest)) return done({ ok: false, reason: 'modelPlan', detail: item.rest || null });
    if (item.checked) return done({ ok: true, name: item.name });
    // The chat's answer to the click: it shows the model, or asks for a plan.
    const dialogs = new Set([...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')].filter(visible));
    const upsell = () => [...document.querySelectorAll('[role="dialog"], [role="alertdialog"], [aria-modal="true"]')].find((d) => visible(d) && !dialogs.has(d) && PLAN.test(d.innerText || d.textContent || ''));
    press(item.el);
    const outcome = await until(() => (upsell() && 'plan') || (shows(model, item.name) && 'shown') || (!menus.some((m) => m.isConnected && visible(m)) && 'closed'), 2500);
    if (outcome === 'plan' || upsell()) {
      const dialog = upsell();
      const said = flat(dialog?.innerText || dialog?.textContent).slice(0, 160);
      // The dialog's own close button, else Escape (never its other buttons).
      const shut = dialog && [...dialog.querySelectorAll('button[aria-label*="close" i], button[aria-label*="dismiss" i], [data-testid*="close" i]')].find(visible);
      if (shut) press(shut); else if (dialog) key(dialog, 'Escape');
      return done({ ok: false, reason: 'modelPlan', detail: said || null });
    }
    await close(model, trigger, menus);
    if (shows(model, item.name)) return { ok: true, name: item.name, names: [...new Set(names)] };
    // The button does not name the model: the picker, opened once more, must.
    const again = await open(model, trigger);
    if (!again) return { ok: false, reason: 'modelNotSwitched', names: [...new Set(names)] };
    const chosen = items(model, again).find((x) => x.checked);
    await close(model, trigger, [again]);
    return chosen && norm(chosen.name) === norm(item.name)
      ? { ok: true, name: item.name, names: [...new Set(names)] }
      : { ok: false, reason: 'modelNotSwitched', names: [...new Set(names)] };
  }

  window.__shot2aiPicker = { read, choose };
})();
