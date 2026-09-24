import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import claude from '../src/sites/claude.js';
import { installClaudePicker } from './mock-claude-picker.mjs';
const picker = fileURLToPath(new URL('../src/picker.js', import.meta.url));
async function setup(page, options = {}) {
  await page.setContent('<main></main>');
  await page.evaluate(installClaudePicker, options);
  await page.addScriptTag({ path: picker });
}
const read = (page) => page.evaluate((m) => window.__shot2aiPicker.read(m), claude.model);
const choose = (page, name) => page.evaluate(({ m, name }) => window.__shot2aiPicker.choose(m, name), { m: claude.model, name });
const effort = (page, value) => page.evaluate(({ m, value }) => window.__shot2aiPicker.chooseEffort(m, value), { m: claude.model, value });

test('Claude: reads the full More models list without opening Effort or changing settings', async ({ page }) => {
  await setup(page);
  expect(await read(page)).toEqual({ ok: true, names: ['Opus 5.5', 'Fable 5.1', 'Sonnet 5', 'Haiku 4.5', 'Opus 5'], current: 'Opus 5.5' });
  expect(await page.evaluate(() => window.claudePicker)).toMatchObject({ events: [], opened: ['More models'], effort: 'Extra' });
  await expect(page.locator('[role=menu]')).toHaveCount(0);
});
test('Claude: switches submenu models and retains all names when selecting the primary model', async ({ page }) => {
  await setup(page);
  expect(await choose(page, 'Sonnet 5')).toMatchObject({ ok: true, name: 'Sonnet 5', names: ['Opus 5.5', 'Fable 5.1', 'Sonnet 5', 'Haiku 4.5', 'Opus 5'] });
  expect((await choose(page, 'Sonnet 5')).names).toHaveLength(5);
  expect(await page.evaluate(() => window.claudePicker.events)).toEqual(['model:Sonnet 5']);
  await expect(page.locator('[role=menu]')).toHaveCount(0);
});
test('Claude: all named effort levels persist and model selection happens before effort', async ({ page }) => {
  await setup(page);
  await choose(page, 'Fable 5.1');
  for (const [value, name] of claude.model.effort.options) expect(await effort(page, value)).toEqual({ ok: true, name });
  expect(await page.evaluate(() => window.claudePicker.events)).toEqual(['model:Fable 5.1', 'effort:Low', 'effort:Medium', 'effort:High', 'effort:Extra', 'effort:Max']);
  await expect(page.locator('[role=menu]')).toHaveCount(0);
});
test('Claude: ignored model and effort changes are refused', async ({ page }) => {
  await setup(page, { stuckModel: true, stuckEffort: true });
  expect(await choose(page, 'Sonnet 5')).toMatchObject({ ok: false, reason: 'modelNotSwitched' });
  expect(await effort(page, 'max')).toEqual({ ok: false, reason: 'effortNotSet' });
  await expect(page.locator('[role=menu]')).toHaveCount(0);
});
test('Claude: missing submenu cannot replace the cache with a partial list; missing effort sends no click', async ({ page }) => {
  await setup(page, { missingMore: true, noMax: true });
  expect(await read(page)).toEqual({ ok: false, reason: 'modelPicker' });
  expect(await effort(page, 'max')).toEqual({ ok: false, reason: 'effortUnsupported' });
  expect(await page.evaluate(() => window.claudePicker.events)).toEqual([]);
  await expect(page.locator('[role=menu]')).toHaveCount(0);
});
