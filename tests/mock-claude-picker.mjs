// Claude's current menu has one primary model, Effort first, and More models
// second. Submenus are portals, linked to their trigger by aria-controls.
export function installClaudePicker({ stuckModel = false, stuckEffort = false, missingMore = false, noMax = false } = {}) {
  document.querySelector('[data-testid="model-selector-dropdown"]')?.remove();
  const state = window.claudePicker = { model: 'Opus 5.5', effort: 'Extra', events: [], opened: [] };
  const models = ['Opus 5.5', 'Fable 5.1', 'Sonnet 5', 'Haiku 4.5', 'Opus 5'];
  const button = document.createElement('button');
  button.type = 'button'; button.id = 'claude-model'; button.dataset.testid = 'model-selector-dropdown';
  button.setAttribute('aria-haspopup', 'menu'); button.setAttribute('aria-controls', 'claude-menu');
  (document.querySelector('fieldset') || document.body).append(button);
  const label = () => { button.textContent = `${state.model} ${state.effort}`; };
  const close = () => { document.querySelectorAll('[data-claude-menu]').forEach((m) => m.remove()); button.setAttribute('aria-expanded', 'false'); };
  const menu = (id, trigger, left) => {
    const el = document.createElement('div'); el.id = id; el.dataset.claudeMenu = '';
    el.setAttribute('role', 'menu'); el.setAttribute('aria-labelledby', trigger.id);
    el.style.cssText = `position:fixed;top:50px;left:${left}px;width:200px;background:white;z-index:1000`;
    document.body.append(el); return el;
  };
  const radio = (parent, name, selected, run, badge = '') => {
    const el = document.createElement('div'); el.setAttribute('role', 'menuitemradio');
    el.setAttribute('aria-checked', String(selected)); el.innerHTML = '<div></div><small></small>';
    el.firstChild.textContent = name; el.lastChild.textContent = badge;
    el.addEventListener('click', run); parent.append(el);
  };
  const modelItem = (parent, name) => radio(parent, name, name === state.model, () => {
    state.events.push(`model:${name}`);
    if (!stuckModel) { state.model = name; state.effort = 'Medium'; label(); }
    close();
  });
  const sub = (root, name, id, fill) => {
    const item = document.createElement('div'); item.id = `${id}-trigger`; item.textContent = name;
    item.setAttribute('role', 'menuitem'); item.setAttribute('aria-haspopup', 'menu'); item.setAttribute('aria-controls', id);
    item.addEventListener('click', () => {
      state.opened.push(name);
      if (missingMore && name === 'More models') return;
      document.querySelectorAll('[data-claude-menu]').forEach((m) => { if (m !== root) m.remove(); });
      fill(menu(id, item, 240));
    });
    root.append(item);
  };
  button.addEventListener('click', () => {
    if (document.getElementById('claude-menu')) { close(); return; }
    button.setAttribute('aria-expanded', 'true');
    const root = menu('claude-menu', button, 20);
    modelItem(root, state.model);
    sub(root, 'Effort', 'claude-effort', (m) => {
      for (const name of ['Low', 'Medium', 'High', 'Extra', ...(noMax ? [] : ['Max'])]) radio(m, name, state.effort === name, () => {
        state.events.push(`effort:${name}`); if (!stuckEffort) { state.effort = name; label(); } close();
      }, name === 'Medium' ? 'Default' : name === 'Max' ? '5.5× or more usage' : '');
    });
    sub(root, 'More models', 'claude-more', (m) => models.filter((n) => n !== state.model).forEach((n) => modelItem(m, n)));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  label();
}
