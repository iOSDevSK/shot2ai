import { test, expect } from '@playwright/test';
import chatgpt from '../src/sites/chatgpt.js';
import { fileURLToPath } from 'node:url';

const pickerPath = fileURLToPath(new URL('../src/picker.js', import.meta.url));

async function composer(page, { container = 'form', role = 'menu', current = 'Instant', names = ['Auto', 'Instant', 'Thinking', 'Pro'] } = {}) {
  await page.setContent(`
    <aside><button aria-haspopup="menu">Instant</button></aside>
    <${container} ${container === 'div' ? 'data-type="unified-composer"' : ''}>
      <div id="prompt-textarea" contenteditable="true"></div>
      <button type="button" aria-haspopup="menu" id="attach">Add files</button>
      <button type="button" aria-haspopup="${role}" id="mode">${current}</button>
      <button type="button" aria-label="Start voice mode">Voice</button>
    </${container}>`);
  await page.evaluate(({ role, current, names }) => {
    window.unrelatedClicks = 0;
    window.switches = [];
    window.current = current;
    document.querySelectorAll('button:not(#mode)').forEach((b) => b.addEventListener('click', () => window.unrelatedClicks++));
    const trigger = document.querySelector('#mode');
    trigger.addEventListener('click', () => {
      const menu = document.createElement('div');
      menu.setAttribute('role', role);
      for (const name of names) {
        const item = document.createElement('button');
        item.textContent = name;
        item.setAttribute('role', role === 'listbox' ? 'option' : 'menuitemradio');
        item.setAttribute(role === 'listbox' ? 'aria-selected' : 'aria-checked', String(window.current === name));
        item.addEventListener('click', () => {
          window.current = name;
          window.switches.push(name);
          trigger.textContent = name;
          menu.remove();
        });
        menu.append(item);
      }
      document.body.append(menu);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') document.querySelectorAll('[role="menu"], [role="listbox"]').forEach((m) => m.remove());
    });
  }, { role, current, names });
  await page.addScriptTag({ path: pickerPath });
}

for (const container of ['form', 'div']) {
  for (const role of ['menu', 'listbox']) {
    test(`composer picker: reads and selects the mode in ${container} with ${role}`, async ({ page }) => {
      await composer(page, { container, role });
      expect(await page.evaluate((m) => window.__shot2aiPicker.read(m), chatgpt.model)).toEqual({
        ok: true, names: ['Auto', 'Instant', 'Thinking', 'Pro'], current: 'Instant',
      });
      expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'Instant'), chatgpt.model)).toMatchObject({ ok: true, name: 'Instant' });
      expect(await page.evaluate(() => window.switches)).toEqual([]);
      expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'Thinking'), chatgpt.model)).toMatchObject({ ok: true, name: 'Thinking' });
      expect(await page.evaluate(() => ({ current: window.current, switches: window.switches, unrelated: window.unrelatedClicks }))).toEqual({
        current: 'Thinking', switches: ['Thinking'], unrelated: 0,
      });
      await expect(page.locator('[role="menu"], [role="listbox"]')).toHaveCount(0);
    });
  }
}

for (const name of ['GPT-5', 'GPT-5.5', 'GPT 5.5', 'GPT-5.5 Thinking', '5.5Instant', '5.6 Thinking', 'GPT-5.6 Sol', 'GPT-5.6 Sol High']) {
  test(`composer picker: reads and switches a versioned name (${name})`, async ({ page }) => {
    const names = ['Instant', name];
    await composer(page, { current: name, names });
    expect(await page.evaluate((m) => window.__shot2aiPicker.read(m), chatgpt.model)).toEqual({ ok: true, names, current: name });
    expect(await page.evaluate(({ model, name }) => window.__shot2aiPicker.choose(model, name), { model: chatgpt.model, name })).toMatchObject({ ok: true, name });
    expect(await page.evaluate(() => window.switches)).toEqual([]);
    expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'Instant'), chatgpt.model)).toMatchObject({ ok: true, name: 'Instant' });
    expect(await page.evaluate(({ model, name }) => window.__shot2aiPicker.choose(model, name), { model: chatgpt.model, name })).toMatchObject({ ok: true, name });
    expect(await page.evaluate(() => window.switches)).toEqual(['Instant', name]);
    expect(await page.evaluate(() => window.unrelatedClicks)).toBe(0);
  });
}

test('composer picker: a versioned choice is not silently replaced by a mode', async ({ page }) => {
  await composer(page);
  expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'GPT-5.5'), chatgpt.model)).toMatchObject({ ok: false, reason: 'modelMissing' });
  expect(await page.evaluate(() => window.switches)).toEqual([]);
});

test('composer picker: unrelated, hidden, non-dropdown and ambiguous buttons are left alone', async ({ page }) => {
  await composer(page);
  for (const change of ['hidden', 'not-dropdown', 'unknown', 'model-help', 'ambiguous', 'removed']) {
    await page.evaluate((change) => {
      const trigger = document.querySelector('#mode');
      trigger.style.display = '';
      trigger.setAttribute('aria-haspopup', 'menu');
      trigger.textContent = 'Instant';
      document.querySelector('#duplicate')?.remove();
      if (change === 'hidden') trigger.style.display = 'none';
      if (change === 'not-dropdown') trigger.setAttribute('aria-haspopup', 'false');
      if (change === 'unknown') trigger.textContent = 'Add files';
      if (change === 'model-help') trigger.textContent = 'GPT-5.5 help';
      if (change === 'ambiguous') {
        const duplicate = trigger.cloneNode(true);
        duplicate.id = 'duplicate';
        trigger.after(duplicate);
      }
      if (change === 'removed') trigger.remove();
    }, change);
    expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'Instant'), chatgpt.model), change).toEqual({ ok: false, reason: 'modelPicker' });
    expect(await page.evaluate(() => window.unrelatedClicks), change).toBe(0);
    await expect(page.locator('[role="menu"]')).toHaveCount(0);
  }
});


test('composer picker waits for a model control that hydrates after the message box', async ({ page }) => {
  await composer(page);
  await page.evaluate(() => {
    const trigger = document.querySelector('#mode'); trigger.remove();
    setTimeout(() => document.querySelector('form').append(trigger), 250);
  });
  expect(await page.evaluate(m => window.__shot2aiPicker.choose(m, 'Thinking'), chatgpt.model)).toMatchObject({ ok: true, name: 'Thinking' });
  expect(await page.evaluate(() => window.switches)).toEqual(['Thinking']);
});


test('composer picker refreshes an older injected implementation in an open tab', async ({ page }) => {
  await composer(page);
  await page.evaluate(() => { window.__shot2aiPicker = { read: async () => ({ ok: false, reason: 'modelPicker' }) }; });
  await page.addScriptTag({ path: pickerPath });
  expect(await page.evaluate(m => window.__shot2aiPicker.read(m), chatgpt.model)).toMatchObject({ ok: true, current: 'Instant' });
});

test('composer picker reopens a closed menu retained by a background-tab exit animation', async ({ page }) => {
  await composer(page);
  await page.evaluate(() => {
    const old = document.querySelector('#mode'), trigger = old.cloneNode(true); old.replaceWith(trigger);
    trigger.setAttribute('aria-controls', 'retained-menu'); trigger.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div'); menu.id = 'retained-menu'; menu.setAttribute('role', 'menu');
    menu.dataset.state = 'closed'; window.opens = 0;
    for (const name of ['Instant', 'Thinking']) {
      const item = document.createElement('button'); item.textContent = name; item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(name === 'Instant'));
      item.addEventListener('click', () => {
        if (menu.dataset.state !== 'open') return;
        trigger.textContent = name; window.current = name;
        menu.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b === item)));
        menu.dataset.state = 'closed'; trigger.setAttribute('aria-expanded', 'false');
      }); menu.append(item);
    }
    document.body.append(menu);
    trigger.addEventListener('click', () => { window.opens++; menu.dataset.state = 'open'; trigger.setAttribute('aria-expanded', 'true'); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.dataset.state = 'closed'; trigger.setAttribute('aria-expanded', 'false'); } });
    // The retained element must not be removed by the generic fixture's Escape listener.
    menu.remove = () => {};
  });
  expect(await page.evaluate(m => window.__shot2aiPicker.read(m), chatgpt.model)).toMatchObject({ ok: true, current: 'Instant' });
  expect(await page.evaluate(() => window.opens)).toBe(1);
  expect(await page.evaluate(m => window.__shot2aiPicker.choose(m, 'Thinking'), chatgpt.model)).toMatchObject({ ok: true, name: 'Thinking' });
  expect(await page.evaluate(m => window.__shot2aiPicker.read(m), chatgpt.model)).toMatchObject({ ok: true, current: 'Thinking' });
  expect(await page.evaluate(() => window.opens)).toBe(3);
  await expect(page.locator('#retained-menu')).toHaveAttribute('data-state', 'closed');
});
