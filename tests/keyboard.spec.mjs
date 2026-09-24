import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { icons } from '../src/icons.js';

const source = (name) => fileURLToPath(new URL(`../src/${name}.js`, import.meta.url));
async function setup(page) {
  await page.route('https://keyboard.test/', (route) => route.fulfill({ contentType: 'text/html', body: '<button id="outside">Page shortcut target</button><textarea id="page-input"></textarea>' }));
  await page.goto('https://keyboard.test/');
  await page.evaluate(() => {
    window.messages = [];
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async (m) => { window.messages.push(m); return {}; } } };
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) {
      const root = attach.call(this, options);
      if (this.id.startsWith('shot2ai-')) window[this.id] = root;
      return root;
    };
    window.siteKeys = [];
    // X uses Mousetrap: ordinary letters use keypress; other bindings also
    // use keydown/keyup. The closed shadow's composed path hides its input.
    for (const type of ['keydown', 'keypress', 'keyup']) document.addEventListener(type, (e) => {
      const target = e.composedPath()[0];
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable) return;
      if (['n', '/', '?', 'j', 'k', 'l', 'x'].includes(e.key)) { window.siteKeys.push(`${type}:${e.key}`); e.preventDefault(); }
    });
  });
}
async function card(page, count = 1, answer = null) {
  await page.addScriptTag({ path: source('card') });
  await page.evaluate(({ icons, count, answer }) => {
    const canvas = document.createElement('canvas'); canvas.width = 20; canvas.height = 20;
    const thumb = canvas.toDataURL().split(',')[1];
    const main = { id: 'html2wp', name: 'html2wp', kind: 'html2wp', label: 'Send to html2wp' };
    window.__shot2aiStack({ icons, main, destinations: [main], prompts: [], acknowledged: {}, keys: {},
      entries: Array.from({ length: count }, (_, i) => ({ id: String(i), thumb, message: '', region: {}, meta: 'PNG', answer })) });
    window['shot2ai-preview-card'].querySelector('.message').focus();
  }, { icons, count, answer });
  expect(await page.evaluate(() => document.querySelector('#shot2ai-preview-card').shadowRoot)).toBeNull();
}
const value = (page) => page.evaluate(() => window['shot2ai-preview-card'].querySelector('.message').value);

test('keyboard: typing in the closed shadow card cannot trigger X keypress or keyup shortcuts', async ({ page }) => {
  await setup(page); await card(page);
  await page.keyboard.type('n/jkl? x test');
  expect(await value(page)).toBe('n/jkl? x test');
  expect(await page.evaluate(() => window.siteKeys)).toEqual([]);
  await page.locator('#outside').focus();
  await page.keyboard.press('n');
  expect(await page.evaluate(() => window.siteKeys)).toContain('keydown:n');
  expect(await page.evaluate(() => window.siteKeys)).toContain('keyup:n');
});

test('keyboard: select-all, caret movement, backspace and undo remain native in the message', async ({ page }) => {
  await setup(page); await card(page, 2);
  await page.keyboard.type('abc');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  expect(await value(page)).toBe('ac');
  await page.keyboard.press('ControlOrMeta+z');
  expect(await value(page)).toBe('abc');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type('replacement');
  expect(await value(page)).toBe('replacement');
  expect(await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.card').dataset.id)).toBe('1');
  expect(await page.evaluate(() => window.siteKeys)).toEqual([]);
});

test('keyboard: native copy and paste work inside the closed shadow message field', async ({ page }) => {
  await setup(page); await card(page);
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.keyboard.type('copied prompt');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('ControlOrMeta+c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('copied prompt');
  await page.keyboard.press('Backspace');
  await page.keyboard.press('ControlOrMeta+v');
  expect(await value(page)).toBe('copied prompt');
  expect(await page.evaluate(() => window.siteKeys)).toEqual([]);
});

test('keyboard: composition Enter and Escape do not send or dismiss; regular Enter still sends once', async ({ page }) => {
  await setup(page); await card(page);
  await page.evaluate(() => {
    const input = window['shot2ai-preview-card'].querySelector('.message');
    for (const key of ['Enter', 'Escape']) input.dispatchEvent(new KeyboardEvent('keydown', { key, isComposing: true, bubbles: true, composed: true }));
  });
  expect(await page.evaluate(() => window.messages.filter((m) => ['card-send', 'stack-hide'].includes(m.type)))).toEqual([]);
  await page.keyboard.type('test');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.messages.filter((m) => m.type === 'card-send').length)).toBe(1);
});

test('keyboard: card arrows navigate and Escape closes; page typing works afterward', async ({ page }) => {
  await setup(page); await card(page, 2);
  await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.card').focus());
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.card').dataset.id)).toBe('0');
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  await page.locator('#page-input').fill('Typing on X');
  await expect(page.locator('#page-input')).toHaveValue('Typing on X');
});

test('keyboard: area selection takes focus so typing cannot activate X or edit its composer', async ({ page }) => {
  await setup(page);
  await page.locator('#page-input').fill('Keep this draft');
  await page.addScriptTag({ path: source('overlay') });
  await page.evaluate(() => window.__shot2aiSelectArea('capture'));
  await page.keyboard.type('n/jkl?');
  await expect(page.locator('#page-input')).toHaveValue('Keep this draft');
  expect(await page.evaluate(() => window.siteKeys)).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-area-select')).toHaveCount(0);
  await expect(page.locator('#page-input')).toBeFocused();
  expect(await page.evaluate(() => window.messages.at(-1))).toEqual({ type: 'area-cancelled', id: 'capture' });
});


test('keyboard: follow-up typing stays inside the closed card and Enter sends once', async ({ page }) => {
  await setup(page); await card(page, 2, { state: 'done', name: 'Claude', destination: 'claude', tabId: 7, url: 'https://claude.ai/chat/test', blocks: [{ t: 'p', c: ['Original answer'] }] });
  await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.chat-toggle').click());
  await page.keyboard.type('n/jkl? x');
  await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+Enter'); await page.keyboard.type('More');
  expect(await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.a-followup textarea').value)).toBe('n/jkl? x\nMore');
  await page.evaluate(() => window['shot2ai-preview-card'].querySelector('.a-followup textarea').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true })));
  expect(await page.evaluate(() => window.messages.filter(m => m.type === 'card-followup'))).toEqual([]);
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window.messages.filter(m => m.type === 'card-followup').length)).toBe(1);
  expect(await page.evaluate(() => window.messages.find(m => m.type === 'card-followup'))).toMatchObject({ id: '1', text: 'n/jkl? x\nMore' });
  expect(await page.evaluate(() => window.siteKeys)).toEqual([]);
});
