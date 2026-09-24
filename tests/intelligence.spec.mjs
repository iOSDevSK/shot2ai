import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import chatgpt from '../src/sites/chatgpt.js';
import { installIntelligence } from './mock-intelligence.mjs';

async function setup(page, options = {}) {
  await page.setContent('<form onsubmit="return false"><div id="prompt-textarea" contenteditable="true"></div></form>');
  await page.evaluate(installIntelligence, options);
  await page.addScriptTag({ path: fileURLToPath(new URL('../src/picker.js', import.meta.url)) });
}
const choose = (page, name) => page.evaluate(({ model, name }) => window.__shot2aiPicker.choose(model, name), { model: chatgpt.model, name });

test('live layout: activates the model view before reading or clicking inert radios', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const article = document.createElement('article');
    article.innerHTML = '<button aria-label="Model selector" aria-haspopup="menu">Try again · 5.5 Instant</button>';
    article.querySelector('button').addEventListener('pointerdown', () => { window.wrongPickerOpened = true; });
    document.body.prepend(article);
  });
  expect(await page.evaluate((m) => window.__shot2aiPicker.read(m), chatgpt.model)).toEqual({ ok: true, names: ['Latest', 'GPT-5.6 Sol', 'GPT-5.5'], current: 'GPT-5.6 Sol' });
  expect(await choose(page, 'GPT-5.5')).toMatchObject({ ok: true, name: 'GPT-5.5' });
  expect(await choose(page, 'GPT-5.6 Sol')).toMatchObject({ ok: true, name: 'GPT-5.6 Sol' });
  expect(await page.evaluate(() => window.effortState.inertClicks)).toBe(0);
  expect(await page.evaluate(() => window.wrongPickerOpened)).toBeUndefined();
  expect(await page.evaluate(() => window.effortState.changes)).toEqual([]);
  await expect(page.locator('#intelligence-menu')).toHaveCount(0);
});

test('live layout: changed composer label, replaced trigger and delayed model update are verified', async ({ page }) => {
  await setup(page, { replaceTrigger: true, delayed: true });
  expect(await choose(page, 'GPT-5.5')).toMatchObject({ ok: true, name: 'GPT-5.5' });
  await expect(page.locator('#intelligence-trigger')).toHaveText('Thinking effort');
  expect(await choose(page, 'GPT-5.6 Sol')).toMatchObject({ ok: true, name: 'GPT-5.6 Sol' });
});

test('live layout: effort uses Power arrow keys, not the aria-hidden numeric thumb', async ({ page }) => {
  await setup(page);
  for (const model of ['GPT-5.5', 'GPT-5.6 Sol']) {
    expect(await choose(page, model)).toMatchObject({ ok: true });
    for (const [position, value, name] of [['0', 0, 'Instant'], ['25', 1, 'Medium'], ['50', 2, 'High'], ['75', 3, 'Extra High'], ['100', 4, 'Pro']]) {
      expect(await page.evaluate(({ m, position }) => window.__shot2aiPicker.chooseEffort(m, position), { m: chatgpt.model, position })).toMatchObject({ ok: true, value, name });
    }
  }
  await expect(page.locator('#intelligence-menu')).toHaveCount(0);
});

test('live layout: a model or effort change ignored by the page is still refused', async ({ page }) => {
  await setup(page, { stuck: true });
  expect(await choose(page, 'GPT-5.5')).toMatchObject({ ok: false, reason: 'modelNotSwitched' });
  expect(await page.evaluate((m) => window.__shot2aiPicker.chooseEffort(m, '0'), chatgpt.model)).toMatchObject({ ok: false, reason: 'effortNotSet' });
  expect(await page.evaluate(() => ({ model: window.effortState.current, effort: window.effortState.value }))).toEqual({ model: 'GPT-5.6 Sol', effort: 4 });
});

test('live layout: new chats can label the composer picker only with the effort', async ({ page }) => {
  await setup(page, { compact: true });
  for (const [position, label] of [['75', 'Extra High'], ['50', 'High'], ['25', 'Medium'], ['0', 'Instant']]) {
    expect(await page.evaluate(({ m, position }) => window.__shot2aiPicker.chooseEffort(m, position), { m: chatgpt.model, position })).toMatchObject({ ok: true });
    await expect(page.locator('#intelligence-trigger')).toHaveText(label);
    expect(await page.evaluate((m) => window.__shot2aiPicker.read(m), chatgpt.model)).toMatchObject({ ok: true, current: 'GPT-5.6 Sol' });
  }
  expect(await choose(page, 'GPT-5.5')).toMatchObject({ ok: true });
});


test('live layout: waits for the Select model control to finish mounting inside the popover', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    document.querySelector('#intelligence-trigger').addEventListener('pointerdown', () => {
      const toggle = document.querySelector('[aria-label="Select model"]');
      if (!toggle) return;
      const parent = toggle.parentElement; toggle.remove();
      setTimeout(() => { if (parent.isConnected) parent.prepend(toggle); }, 250);
    });
  });
  expect(await choose(page, 'GPT-5.5')).toMatchObject({ ok: true, name: 'GPT-5.5' });
  await expect(page.locator('#intelligence-menu')).toHaveCount(0);
});
