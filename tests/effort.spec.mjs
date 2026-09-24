import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import chatgpt from '../src/sites/chatgpt.js';
import { installEffort } from './mock-effort.mjs';

async function setup(page, options = {}) {
  await page.setContent('<form onsubmit="return false"><div id="prompt-textarea" contenteditable="true"></div></form><aside><input type="range" id="unrelated" value="30"></aside>');
  await page.evaluate(installEffort, options);
  await page.addScriptTag({ path: fileURLToPath(new URL('../src/picker.js', import.meta.url)) });
}
const choose = (page, value) => page.evaluate(({ model, value }) => window.__shot2aiPicker.chooseEffort(model, value), { model: chatgpt.model, value });

for (const native of [false, true]) {
  test(`effort: model menu inside the popover and independently verified effort (${native ? 'native' : 'ARIA'})`, async ({ page }) => {
    await setup(page, { native });
    expect(await page.evaluate((m) => window.__shot2aiPicker.read(m), chatgpt.model)).toEqual({ ok: true, names: ['5.5', '5.6'], current: '5.5' });
    await expect(page.locator('#effort-panel')).toHaveCount(0);
    expect(await page.evaluate(() => window.effortState.changes)).toEqual([]);
    expect(await page.evaluate((m) => window.__shot2aiPicker.choose(m, 'GPT-5.6'), chatgpt.model)).toMatchObject({ ok: true, name: '5.6' });
    expect(await choose(page, '100')).toMatchObject({ ok: true, name: 'Heavy', value: 8 });
    expect(await choose(page, '25')).toMatchObject({ ok: true, name: 'Light', value: 2 });
    expect(await choose(page, '0')).toMatchObject({ ok: true, name: 'Instant', value: 0 });
    await expect(page.locator('#unrelated')).toHaveValue('30');
    await expect(page.locator('#effort-panel')).toHaveCount(0);
  });

  test(`effort: ignored changes are refused (${native ? 'native' : 'ARIA'})`, async ({ page }) => {
    await setup(page, { native, stuck: true });
    expect(await choose(page, '100')).toMatchObject({ ok: false, reason: 'effortNotSet' });
    expect(await page.evaluate(() => window.effortState.value)).toBe(2);
    await expect(page.locator('#effort-panel')).toHaveCount(0);
  });
}

test('effort: reads actual bounds and snaps to a valid step', async ({ page }) => {
  await setup(page, { min: 2, max: 8, step: 2, value: 2 });
  expect(await choose(page, '25')).toMatchObject({ ok: true, value: 4 });
  expect(await choose(page, '100')).toMatchObject({ ok: true, value: 8 });
});

test('effort: maximum uses the last valid step when the range is not divisible by the step', async ({ page }) => {
  await setup(page, { native: true, min: 2, max: 9, step: 2, value: 2 });
  expect(await choose(page, '100')).toMatchObject({ ok: true, value: 8 });
});

test('effort: existing open panel stays open, invalid choices and missing controls are refused', async ({ page }) => {
  await setup(page);
  await page.locator('#effort-button').click();
  expect(await choose(page, '50')).toMatchObject({ ok: true, value: 2 });
  await expect(page.locator('#effort-panel')).toBeVisible();
  expect(await choose(page, 'invalid')).toMatchObject({ ok: false, reason: 'effortUnsupported' });
  await page.locator('#effort-button').click();
  await page.locator('#effort-button').evaluate((el) => el.remove());
  expect(await choose(page, '100')).toMatchObject({ ok: false, reason: 'effortPicker' });
  await expect(page.locator('#unrelated')).toHaveValue('30');
});
