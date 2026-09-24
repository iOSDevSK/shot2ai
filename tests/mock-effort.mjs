// Install a composer popover with a nested model menu and either a native
// or ARIA slider. Its numeric ranges deliberately differ between models.
export function installEffort({ native = false, stuck = false, current = '5.5', value = 2, min = 0, max = null, step = 1 } = {}) {
  document.querySelector('#model-button')?.remove();
  const form = document.querySelector('form');
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.id = 'effort-button';
  trigger.textContent = 'Thinking effort';
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', 'effort-panel');
  form.append(trigger);
  const state = window.effortState = { current, value, opens: 0, changes: [], events: [] };
  const bounds = () => ({ min, max: max ?? (state.current === '5.6' ? 8 : 4), step });
  const description = () => ['Instant', 'Light', 'Standard', 'Extended', 'Heavy'][Math.round((state.value - bounds().min) / (bounds().max - bounds().min) * 4)];
  const close = () => {
    document.querySelector('#effort-panel')?.remove();
    document.querySelector('#effort-model-menu')?.remove();
    trigger.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    state.opens++;
    trigger.setAttribute('aria-expanded', 'true');
    const panel = document.createElement('div');
    panel.id = 'effort-panel';
    panel.setAttribute('role', 'dialog');
    panel.style.cssText = 'position:fixed;top:100px;left:50px;background:white;padding:20px;z-index:99';
    const model = document.createElement('button');
    model.id = 'effort-model';
    const showModel = () => { model.textContent = `${state.current} ${description()}`; };
    showModel();
    model.addEventListener('click', () => {
      const menu = document.createElement('div');
      menu.id = 'effort-model-menu';
      menu.setAttribute('role', 'menu');
      menu.style.cssText = 'position:fixed;top:250px;left:50px;background:white;padding:20px;z-index:100';
      for (const version of ['5.5', '5.6']) {
        const item = document.createElement('button');
        item.textContent = version;
        item.setAttribute('role', 'menuitemradio');
        item.setAttribute('aria-checked', String(version === state.current));
        item.addEventListener('click', () => {
          state.current = version;
          state.value = min;
          state.events.push(`model:${version}`);
          window.dispatchEvent(new CustomEvent('mock-model-change', { detail: version }));
          showModel();
          menu.remove();
          sync();
        });
        menu.append(item);
      }
      document.body.append(menu);
    });
    const slider = document.createElement(native ? 'input' : 'div');
    slider.id = 'effort-slider';
    slider.style.cssText = 'display:block;width:240px;height:25px;background:#ddd';
    if (native) slider.type = 'range';
    else { slider.setAttribute('role', 'slider'); slider.tabIndex = 0; }
    slider.setAttribute('aria-label', 'Thinking effort');
    const sync = () => {
      const { min, max, step } = bounds();
      if (native) { slider.min = min; slider.max = max; slider.step = step; slider.value = state.value; }
      else {
        slider.setAttribute('aria-valuemin', min);
        slider.setAttribute('aria-valuemax', max);
        slider.setAttribute('aria-valuenow', state.value);
        slider.setAttribute('data-step', step);
      }
      slider.setAttribute('aria-valuetext', description());
    };
    const update = (value) => {
      if (stuck) return;
      const { min, max } = bounds();
      state.value = Math.min(max, Math.max(min, value));
      state.changes.push(state.value);
      state.events.push(`effort:${state.value}`);
      sync(); showModel();
    };
    if (native) slider.addEventListener('input', () => update(Number(slider.value)));
    else slider.addEventListener('keydown', (e) => {
      const { min, max, step } = bounds();
      if (e.key === 'Home') { e.preventDefault(); update(min); }
      if (e.key === 'End') { e.preventDefault(); update(max); }
      if (e.key === 'ArrowRight') { e.preventDefault(); update(state.value + step); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); update(state.value - step); }
    });
    sync();
    const reset = document.createElement('button');
    reset.textContent = 'Reset';
    reset.addEventListener('click', () => { throw new Error('The reset button must not be used'); });
    panel.append(model, reset, slider);
    document.body.append(panel);
  };
  trigger.addEventListener('click', () => document.querySelector('#effort-panel') ? close() : open());
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const menu = document.querySelector('#effort-model-menu');
    if (menu) menu.remove(); else close();
  });
}
