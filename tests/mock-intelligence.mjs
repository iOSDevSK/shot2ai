// Structure observed in the signed-in ChatGPT intelligence picker in Brave:
// one menu, two mounted views, inert model radios, and a hidden numeric thumb
// controlled by the visible Power menu item. No conversation data is copied.
export function installIntelligence({ stuck = false, delayed = false, replaceTrigger = false, compact = false } = {}) {
  document.querySelector('#model-button')?.remove();
  document.querySelector('#effort-button')?.remove();
  const form = document.querySelector('form');
  const names = ['Latest', 'GPT-5.6 Sol', 'GPT-5.5'];
  const efforts = ['Instant', 'Medium', 'High', 'Extra High', 'Pro'];
  const state = window.effortState = { current: 'GPT-5.6 Sol', value: 4, opens: 0, changes: [], events: [], inertClicks: 0 };
  let trigger;
  let menu;
  const short = () => state.current === 'GPT-5.5' ? '5.5' : '5.6';
  const close = () => { menu?.remove(); menu = null; trigger.setAttribute('aria-expanded', 'false'); };
  const button = () => {
    const old = trigger;
    trigger = document.createElement('button');
    trigger.id = 'intelligence-trigger';
    trigger.type = 'button';
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', String(!!menu));
    trigger.setAttribute('aria-controls', 'intelligence-menu');
    trigger.textContent = compact ? efforts[state.value] : state.current === 'GPT-5.5' ? 'Thinking effort' : `${short()}\n${efforts[state.value]}`;
    trigger.addEventListener('pointerdown', () => menu ? close() : open());
    if (old) old.replaceWith(trigger); else form.append(trigger);
  };
  const open = () => {
    state.opens++;
    menu = document.createElement('div');
    menu.id = 'intelligence-menu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-labelledby', trigger.id);
    menu.style.cssText = 'position:fixed;top:60px;left:30px;padding:12px;background:white;z-index:100';
    menu.innerHTML = `<div data-testid="composer-intelligence-picker-content">
      <div role="group" data-controls>
        <div role="menuitem" tabindex="0" aria-label="Select model" aria-expanded="false"><span data-version></span><span data-max-effort="true"></span></div>
        <div role="menuitem" aria-label="Reset to default">Reset</div>
      </div>
      <div data-testid="composer-model-picker-slider-simple-view" data-active="true">
        <div role="menuitem" tabindex="0" aria-label="Power" aria-keyshortcuts="ArrowLeft ArrowRight">
          <div data-model-reasoning-effort-slider><span role="slider" aria-hidden="true" tabindex="-1" aria-valuemin="0" aria-valuemax="4" aria-valuenow="4" style="display:block;width:28px;height:28px"></span></div>
        </div>
      </div>
      <div data-testid="composer-model-picker-slider-advanced-view" data-active="false" inert></div>
    </div>`;
    const controls = menu.querySelector('[data-controls]');
    const toggle = menu.querySelector('[aria-label="Select model"]');
    const simple = menu.querySelector('[data-testid="composer-model-picker-slider-simple-view"]');
    const advanced = menu.querySelector('[data-testid="composer-model-picker-slider-advanced-view"]');
    const slider = menu.querySelector('[role="slider"]');
    const power = menu.querySelector('[aria-label="Power"]');
    const view = (models) => {
      advanced.inert = !models;
      advanced.dataset.active = String(models);
      simple.inert = models;
      simple.dataset.active = String(!models);
      controls.setAttribute('aria-hidden', String(models));
      toggle.setAttribute('aria-expanded', String(models));
    };
    const sync = () => {
      menu.querySelector('[data-version]').textContent = `${short()}\n`;
      menu.querySelector('[data-max-effort]').textContent = efforts[state.value];
      slider.setAttribute('aria-valuenow', state.value);
      advanced.querySelectorAll('[role="menuitemradio"]').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.name === state.current)));
      if (replaceTrigger) button();
      else trigger.textContent = compact ? efforts[state.value] : state.current === 'GPT-5.5' ? 'Thinking effort' : `${short()}\n${efforts[state.value]}`;
    };
    toggle.addEventListener('click', () => view(true));
    for (const name of names) {
      const item = document.createElement('div');
      item.setAttribute('role', 'menuitemradio');
      item.dataset.name = name;
      item.innerHTML = `<div>${name}</div>${name === 'GPT-5.5' ? '<div>Leaving on October 14</div>' : ''}`;
      item.addEventListener('click', () => {
        if (item.closest('[inert]')) { state.inertClicks++; return; }
        if (stuck) { view(false); return; }
        const apply = () => {
          state.current = name;
          state.events.push(`model:${name}`);
          window.dispatchEvent(new CustomEvent('mock-model-change', { detail: name }));
          sync(); view(false);
        };
        if (delayed) setTimeout(apply, 150); else apply();
      });
      advanced.append(item);
    }
    power.addEventListener('keydown', (e) => {
      if (e.target !== power || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault();
      if (stuck) return;
      state.value = Math.max(0, Math.min(4, state.value + (e.key === 'ArrowRight' ? 1 : -1)));
      state.changes.push(state.value); state.events.push(`effort:${state.value}`);
      sync();
    });
    sync();
    document.body.append(menu);
    trigger.setAttribute('aria-expanded', 'true');
  };
  button();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
