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
  if (window.__shot2aiPicker?.revision === 6) return;
  const rendered = (el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && getComputedStyle(el).visibility !== 'hidden'; };
  // Radix keeps closed popovers mounted until their exit animation ends.
  // In a background tab that animation may stall, so geometry alone cannot
  // distinguish a live menu from the previous, already closed menu.
  const CLOSED_PANEL = ':is([role="menu"], [role="listbox"], [role="dialog"])[data-state="closed"]';
  const visible = (el) => rendered(el) && !el.closest(`[inert], [aria-hidden="true"], ${CLOSED_PANEL}`);
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
  const modelNorm = (model, t) => model.namePrefix ? norm(t).replace(new RegExp(model.namePrefix), '').replace(/(\d)(auto|instant|thinking|pro|medium|high|extra high|light|standard|extended|heavy)\b/g, '$1 $2') : norm(t);
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
    return found.filter((el, i) => visible(el) && !(model.itemExclude && el.matches(model.itemExclude)) && !found.some((o, j) => j !== i && o.contains(el))).map((el) => {
      const named = model.label.map((s) => el.querySelector(s)).find((x) => x && flat(x.textContent));
      const text = lines(el);
      const name = named ? flat(named.textContent) : text[0] || '';
      const rest = text.filter((l) => l !== name).join(' · ');
      const checked = el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true' || el.getAttribute('data-state') === 'checked' || !!(model.checked && el.matches(model.checked));
      const disabled = el.getAttribute('aria-disabled') === 'true' || el.hasAttribute('data-disabled') || el.disabled === true;
      return { el, name, rest, checked, disabled, submenu: (el.hasAttribute('aria-haspopup') && el.getAttribute('aria-haspopup') !== 'false') || (el.hasAttribute('aria-expanded') && el.getAttribute('aria-haspopup') !== 'false') };
    }).filter((x) => x.name);
  }
  function button(model) {
    const eligible = (el) => visible(el) && !(model.buttonExclude && el.closest(model.buttonExclude));
    // Adapter selectors are ordered from the most specific to the broadest.
    for (const selector of model.button) {
      const found = all([selector]).find(eligible);
      if (found) return found;
    }
    const names = new Set([...(model.typical || []), ...(model.buttonNames || []), ...(model.panel ? model.effort?.names || [] : [])].map(norm));
    const pattern = model.buttonNamePattern ? new RegExp(model.buttonNamePattern) : null;
    const candidates = all(model.buttonFallback || []).filter((el) => {
      const name = norm(el.innerText || el.textContent);
      return eligible(el) && el.getAttribute('aria-haspopup') !== 'false' &&
        (names.has(name) || pattern?.test(name));
    });
    // Ambiguous fallback buttons are left alone.
    return candidates.length === 1 ? candidates[0] : null;
  }

  // The model may live inside the effort popover. Only a named composer
  // control opens it; only the slider that appears after that click belongs
  // to it. Other sliders, including ones in a conversation, are left alone.
  function effortTrigger(model) {
    const config = model.effort;
    if (!config || config.kind === 'menu') return null;
    const pattern = model.buttonNamePattern ? new RegExp(model.buttonNamePattern) : null;
    const triggers = all(config.buttons).filter((el) => visible(el) &&
      !(model.buttonExclude && el.closest(model.buttonExclude)) &&
      (pattern?.test(norm(el.innerText || el.textContent)) || config.names.some((name) => [el.innerText, el.getAttribute('aria-label')].some((text) => norm(text) === norm(name)))));
    return triggers.length === 1 ? triggers[0] : null;
  }
  async function effortPanel(model) {
    const config = model.effort;
    if (!config || config.kind === 'menu') return null;
    const pattern = model.buttonNamePattern ? new RegExp(model.buttonNamePattern) : null;
    const trigger = effortTrigger(model);
    if (!trigger) return null;
    // ChatGPT's numeric slider thumb is deliberately aria-hidden; keyboard
    // input goes to its visible Power menu item instead.
    const sliderVisible = (el) => rendered(el) && !el.closest(`[inert], ${CLOSED_PANEL}`);
    const before = new Set(all(config.sliders).filter(sliderVisible));
    const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
    const controlled = () => document.getElementById(trigger.getAttribute('aria-controls') || '') || all(model.menu).find((el) => visible(el) && trigger.id && el.getAttribute('aria-labelledby') === trigger.id);
    if (!wasOpen) press(trigger);
    const slider = await until(() => {
      const found = all(config.sliders).filter((el) => sliderVisible(el) &&
        (wasOpen ? controlled()?.contains(el) : !before.has(el)));
      return found.length === 1 ? found[0] : null;
    }, 1500);
    const closePanel = async () => {
      if (wasOpen) return;
      if (slider?.isConnected) key(slider, 'Escape');
      key(document, 'Escape');
      if (slider && await until(() => !slider.isConnected || !sliderVisible(slider), 400)) return;
      if (trigger.isConnected && (trigger.getAttribute('aria-expanded') === 'true' || (slider?.isConnected && sliderVisible(slider)))) press(trigger);
    };
    if (!slider) { await closePanel(); return null; }
    // Some popovers have no dialog role. Stop at the smallest ancestor that
    // also contains the versioned model button, without reaching the page.
    let root = controlled()?.contains(slider) ? controlled() : slider.parentElement;
    let modelButton = null;
    for (let depth = 0; root && root !== document.body && depth < 8; depth++, root = root.parentElement) {
      const candidates = [...root.querySelectorAll(`button, [role="button"]${model.panel ? `, ${model.panel.toggle}` : ''}`)].filter((el) => visible(el) && pattern?.test(norm(el.innerText || el.textContent)));
      if (candidates.length === 1) { modelButton = candidates[0]; break; }
      if (root.matches('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')) break;
    }
    return { trigger, slider, modelButton, root: controlled() || root, close: closePanel };
  }

  async function withModelButton(model, run) {
    // The editable composer can mount before its model controls during SPA
    // navigation or tab wake-up. Wait for the control, never change the request
    // to the current model just because the first DOM read was too early.
    if (model.readyTimeout) await until(() => button(model) || effortTrigger(model), model.readyTimeout);
    const direct = button(model);
    if (direct) return run(direct);
    const panel = await effortPanel(model);
    if (!panel) return { ok: false, reason: 'modelPicker' };
    try {
      return panel.modelButton ? await run(panel.modelButton) : { ok: false, reason: 'modelPicker' };
    } finally { await panel.close(); }
  }

  // Effort choices are positions on the site's own slider. Do not guess
  // which value means "Instant", nor assume 5.5 and 5.6 have equal bounds.
  async function chooseEffort(model, position) {
    if (model.effort?.kind === 'menu') return chooseMenuEffort(model, position);
    if (!['0', '25', '50', '75', '100'].includes(String(position))) return { ok: false, reason: 'effortUnsupported' };
    const panel = await effortPanel(model);
    if (!panel) return { ok: false, reason: 'effortPicker' };
    try {
      const { slider } = panel;
      const native = slider.matches('input[type="range"]');
      const min = Number(native ? slider.min || 0 : slider.getAttribute('aria-valuemin'));
      const max = Number(native ? slider.max || 100 : slider.getAttribute('aria-valuemax'));
      const stepText = native ? slider.step || '1' : slider.getAttribute('data-step') || '1';
      const step = Number(stepText);
      const value = () => Number(native ? slider.value : slider.getAttribute('aria-valuenow'));
      if ((!native && (!slider.hasAttribute('aria-valuemin') || !slider.hasAttribute('aria-valuemax') || !slider.hasAttribute('aria-valuenow'))) ||
        ![min, max, step].every(Number.isFinite) || max <= min || step <= 0 || (max - min) / step > 100 ||
        slider.disabled || slider.getAttribute('aria-disabled') === 'true') return { ok: false, reason: 'effortUnsupported' };
      const lastStep = Math.floor((max - min) / step + 0.000000001);
      const target = min + Math.min(lastStep, Math.round((max - min) * Number(position) / 100 / step)) * step;
      const same = (a, b) => Math.abs(a - b) < 0.000001;
      if (!same(value(), target)) {
        slider.focus();
        if (native) {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, String(target));
          slider.dispatchEvent(new Event('input', { bubbles: true }));
          slider.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          const keyboard = model.effort.keyboardTarget ? slider.closest(model.effort.keyboardTarget) || slider : slider;
          keyboard.focus();
          const start = value();
          const direction = target > start ? 1 : -1;
          const steps = Math.round(Math.abs(target - start) / step);
          for (let i = 1; i <= steps; i++) {
            key(keyboard, direction === 1 ? 'ArrowRight' : 'ArrowLeft');
            if (!await until(() => same(value(), start + i * step * direction), 800)) return { ok: false, reason: 'effortNotSet' };
          }
        }
        if (!await until(() => same(value(), target), 1000)) return { ok: false, reason: 'effortNotSet' };
      }
      // A native input's value can change even when the app ignores the
      // synthetic event. Reopen the panel and confirm the persisted value.
      await panel.close();
      const confirmed = await effortPanel(model);
      if (!confirmed) return { ok: false, reason: 'effortNotSet' };
      try {
        const actual = Number(confirmed.slider.matches('input[type="range"]') ? confirmed.slider.value : confirmed.slider.getAttribute('aria-valuenow'));
        if (!same(actual, target)) return { ok: false, reason: 'effortNotSet' };
        const label = model.effort.valueLabel && confirmed.root?.querySelector(model.effort.valueLabel);
        return { ok: true, name: flat(confirmed.slider.getAttribute('aria-valuetext')) || (label && flat(label.textContent)) || `${Math.round((target - min) / (max - min) * 100)}%`, value: target };
      } finally { await confirmed.close(); }
    } finally { await panel.close(); }
  }

  // Opens the picker; returns the menu that appeared (menus are often put at
  // the end of the page, away from the button).
  async function prepareMenu(model, menu) {
    const config = model.panel;
    const root = config && (menu.matches(config.root) ? menu : menu.querySelector(config.root));
    if (!root) return menu;
    const ready = () => {
      const views = [...root.querySelectorAll(config.models)];
      return views.some(view => visible(view) && (view.matches(model.items.join(',')) || items(model, view).length)) ? menu : null;
    };
    if (ready()) return menu;
    const toggle = await until(() => {
      if (ready()) return menu;
      const control = root.querySelector(config.toggle);
      return control && visible(control) ? control : null;
    }, 1500);
    if (toggle === menu) return menu;
    if (!toggle) return null;
    press(toggle);
    return until(ready, 1500);
  }
  async function open(model, trigger) {
    const existing = all(model.menu).find((menu) => visible(menu) &&
      ((model.openMenu && menu.matches(model.openMenu)) || menu.contains(trigger) || menu.id === trigger.getAttribute('aria-controls') || (trigger.id && menu.getAttribute('aria-labelledby') === trigger.id)));
    if (existing) return prepareMenu(model, existing);
    const before = new Set(all(model.menu).filter(visible));
    const fresh = () => all(model.menu).find((m) => visible(m) && !before.has(m) && (items(model, m).length || (model.panel && m.querySelector(model.panel.root)))) || null;
    press(trigger);
    let menu = await until(fresh, 1500);
    if (!menu) { trigger.focus(); key(trigger, 'Enter'); menu = await until(fresh, 1500); }
    if (!menu) { key(trigger, 'ArrowDown'); menu = await until(fresh, 1200); }
    if (!menu) return null;
    const prepared = await prepareMenu(model, menu);
    if (!prepared) await close(model, trigger, [menu]);
    return prepared;
  }
  // Closes whatever this script opened: Escape, then the button once more.
  async function close(model, trigger, menus) {
    const open = () => menus.some((m) => m.isConnected && visible(m));
    if (!open()) return;
    try {
      const closer = trigger?.isConnected ? trigger : button(model);
      if (model.closeWithTrigger && closer) {
        closer.click();
        if (await until(() => !open(), 800)) return;
      }
      for (const m of menus) if (m.isConnected) key(m, 'Escape');
      key(document, 'Escape');
      if (await until(() => !open(), 800)) return;
      if (trigger?.isConnected) press(trigger);
      await until(() => !open(), 800);
    } finally {
      // A shared model/effort picker can unmount before its close transition
      // resets the selected view. Let the site's reset finish before the next
      // operation reopens it; DOM disappearance alone is not sufficient.
      if (!open() && model.panel?.settleMs) await new Promise(resolve => setTimeout(resolve, model.panel.settleMs));
    }
  }
  const shows = (model, name, trigger) => {
    const candidates = [trigger, button(model), ...(model.panel ? all([`:is(${model.panel.root}) ${model.panel.toggle}`]) : [])];
    return candidates.some((el) => el?.isConnected && visible(el) && ` ${modelNorm(model, el.innerText || el.textContent)} `.includes(` ${modelNorm(model, name)} `));
  };

  async function submenu(model, item) {
    const controlled = () => all(model.menu).find((m) => visible(m) &&
      (m.id === item.el.getAttribute('aria-controls') || (item.el.id && m.getAttribute('aria-labelledby') === item.el.id)));
    if (controlled()) return controlled();
    const before = new Set(all(model.menu).filter(visible));
    press(item.el);
    key(item.el, 'ArrowRight');
    return until(() => controlled() || all(model.menu).find((m) => visible(m) && !before.has(m) && items(model, m).length), 1500);
  }

  async function modelItems(model, menu) {
    const main = items(model, menu);
    const list = main.filter((x) => !x.submenu);
    const menus = [menu];
    // Effort can precede More models. Never treat an arbitrary submenu as
    // a list of models, or cache its Low/Medium/High settings as model names.
    const more = main.find((x) => x.submenu && /^more models$/.test(norm(x.name)));
    if (more) {
      const sub = await submenu(model, more);
      if (!sub) return { list, menus, complete: false };
      menus.push(sub);
      list.push(...items(model, sub).filter((x) => !x.submenu));
    }
    return { list, menus, complete: true };
  }

  // Read all model levels so both the popup and the send result keep the
  // complete list, including when the chosen model is on the first level.
  async function readFrom(model, trigger) {
    const menu = await open(model, trigger);
    if (!menu) return { ok: false, reason: 'modelPicker' };
    const { list, menus, complete } = await modelItems(model, menu);
    const names = [...new Set(list.map((x) => x.name))];
    const current = list.find((x) => x.checked)?.name || null;
    await close(model, trigger, menus);
    return complete ? { ok: true, names, current } : { ok: false, reason: 'modelPicker' };
  }

  async function menuEffort(model) {
    const trigger = button(model);
    if (!trigger) return null;
    const root = await open(model, trigger);
    if (!root) return null;
    if (model.effort.inModelMenu) return { sub: root, close: () => close(model, trigger, [root]) };
    const item = items(model, root).find((x) => x.submenu && norm(x.name) === norm(model.effort.triggerName));
    const sub = item && await submenu(model, item);
    if (!sub) { await close(model, trigger, [root]); return null; }
    return { sub, close: () => close(model, trigger, [root, sub]) };
  }

  async function chooseMenuEffort(model, value) {
    const effortModel = model.effort.items ? { ...model, items: model.effort.items, itemExclude: null } : model;
    const want = model.effort.options.find(([id]) => id === value)?.[1];
    if (!want) return { ok: false, reason: 'effortUnsupported' };
    const panel = await menuEffort(model);
    if (!panel) return { ok: false, reason: 'effortPicker' };
    try {
      const option = items(effortModel, panel.sub).find((x) => norm(x.name) === norm(want));
      if (!option || option.disabled) return { ok: false, reason: 'effortUnsupported' };
      if (!option.checked) press(option.el);
    } finally { await panel.close(); }
    // Reopen to verify the app retained the choice, rather than trusting a
    // click or a changed label. No image is attached if this fails.
    const confirmed = await menuEffort(model);
    if (!confirmed) return { ok: false, reason: 'effortNotSet' };
    try {
      return items(effortModel, confirmed.sub).some((x) => x.checked && norm(x.name) === norm(want))
        ? { ok: true, name: want } : { ok: false, reason: 'effortNotSet' };
    } finally { await confirmed.close(); }
  }

  // The item for `want`: the same name, else the only one that starts with
  // it, else the only one that has it as a whole word. Several: refused.
  function match(model, list, want) {
    const w = modelNorm(model, want);
    const exact = list.filter((x) => modelNorm(model, x.name) === w);
    if (exact.length) return { item: exact[0] };
    for (const test of [(n) => n.startsWith(`${w} `), (n) => ` ${n} `.includes(` ${w} `)]) {
      const found = list.filter((x) => test(modelNorm(model, x.name)));
      if (found.length === 1) return { item: found[0] };
      if (found.length > 1) return { several: found.map((x) => x.name) };
    }
    return {};
  }

  // Chooses `want`, and checks the chat shows it. Returns { ok, name, names }
  // or { ok: false, reason, detail, names } with reason modelPicker,
  // modelMissing, modelAmbiguous, modelPlan or modelNotSwitched.
  async function chooseFrom(model, want, trigger) {
    const menu = await open(model, trigger);
    if (!menu) return { ok: false, reason: 'modelPicker' };
    const { list, menus, complete } = await modelItems(model, menu);
    if (!complete) { await close(model, trigger, menus); return { ok: false, reason: 'modelPicker' }; }
    const names = list.map((x) => x.name);
    const found = match(model, list, want);
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
    const outcome = await until(() => (upsell() && 'plan') || (shows(model, item.name, trigger) && 'shown') || (!menus.some((m) => m.isConnected && visible(m)) && 'closed'), 2500);
    if (outcome === 'plan' || upsell()) {
      const dialog = upsell();
      const said = flat(dialog?.innerText || dialog?.textContent).slice(0, 160);
      // The dialog's own close button, else Escape (never its other buttons).
      const shut = dialog && [...dialog.querySelectorAll('button[aria-label*="close" i], button[aria-label*="dismiss" i], [data-testid*="close" i]')].find(visible);
      if (shut) press(shut); else if (dialog) key(dialog, 'Escape');
      return done({ ok: false, reason: 'modelPlan', detail: said || null });
    }
    await close(model, trigger, menus);
    if (shows(model, item.name, trigger)) return { ok: true, name: item.name, names: [...new Set(names)] };
    // The button does not name the model: the picker, opened once more, must.
    // React can replace the composer button when the selected model changes.
    const again = await open(model, button(model) || trigger);
    if (!again) return { ok: false, reason: 'modelNotSwitched', names: [...new Set(names)] };
    const chosen = await until(() => items(model, again).find((x) => x.checked && modelNorm(model, x.name) === modelNorm(model, item.name)), 2500);
    await close(model, trigger, [again]);
    return chosen && modelNorm(model, chosen.name) === modelNorm(model, item.name)
      ? { ok: true, name: item.name, names: [...new Set(names)] }
      : { ok: false, reason: 'modelNotSwitched', names: [...new Set(names)] };
  }

  const read = (model) => withModelButton(model, (trigger) => readFrom(model, trigger));
  const choose = (model, want) => withModelButton(model, (trigger) => chooseFrom(model, want, trigger));
  window.__shot2aiPicker = { revision: 6, read, choose, chooseEffort };
})();
