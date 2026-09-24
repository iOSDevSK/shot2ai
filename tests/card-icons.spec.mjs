import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { icons } from '../src/icons.js';

async function answerCard(page, missing = false) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async () => ({}) } };
    const attach = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function (options) { return attach.call(this, { ...options, mode: 'open' }); };
  });
  await page.addScriptTag({ path: fileURLToPath(new URL('../src/card.js', import.meta.url)) });
  await page.evaluate(({ icons, missing }) => {
    if (missing) delete icons.chat;
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 20;
    const main = { id: 'chatgpt', name: 'ChatGPT', kind: 'chat', label: 'Send to ChatGPT' };
    window.payload = { icons, main, destinations: [main], prompts: [], acknowledged: {}, keys: {},
      entries: [{ id: 'answer', thumb: canvas.toDataURL().split(',')[1], asked: 'Explain this',
        answer: { state: 'done', name: 'ChatGPT', destination: 'chatgpt', blocks: [{ t: 'p', c: ['Answer text'] }] } }] };
    window.__shot2aiStack(window.payload);
  }, { icons, missing });
  return page.locator('#shot2ai-preview-card');
}

test('chat icon: an older icon payload still renders a working SVG button', async ({ page }) => {
  const card = await answerCard(page, true);
  const chat = card.getByRole('button', { name: 'Chat in this card', exact: true });
  await expect(chat).toHaveText('');
  await expect(chat.locator('svg')).toBeVisible();
  await expect(card).not.toContainText('undefined');
  await chat.click();
  await expect(card.getByLabel('Follow-up message', { exact: true })).toBeVisible();
  await expect(card.getByLabel('Follow-up message', { exact: true })).toBeFocused();
});

test('chat icon: a restored card refreshes the icons from its latest payload', async ({ page }) => {
  const card = await answerCard(page);
  await page.evaluate(() => {
    window.payload = { ...window.payload, icons: { ...window.payload.icons,
      chat: '<svg viewBox="0 0 24 24" data-current-icon="true"><path d="M4 4h16v12H8l-4 4z"/></svg>' } };
    window.__shot2aiStack(window.payload);
  });
  await expect(card.locator('.chat-toggle svg[data-current-icon="true"]')).toBeVisible();
  await expect(card.locator('.chat-toggle')).toHaveText('');
});

for (const mode of ['older worker', 'invalidated context']) test(`follow-up: ${mode} keeps the draft and explains that a reload is needed`, async ({ page }) => {
  const card = await answerCard(page, true);
  await page.evaluate(mode => {
    window.chrome.runtime.sendMessage = mode === 'older worker' ? async () => undefined : () => { throw new Error('Extension context invalidated.'); };
  }, mode);
  await card.getByRole('button', { name: 'Chat in this card', exact: true }).click();
  const input = card.getByLabel('Follow-up message', { exact: true });
  await input.fill('čo píše denník pravda k tomu?');
  await input.press('Enter');
  await expect(card.locator('.a-chat-error')).toContainText('Reload Shot2AI');
  await expect(input).toBeEnabled();
  await expect(input).toHaveValue('čo píše denník pravda k tomu?');
  await expect(card.locator('.a-body')).toHaveText('Answer text');
});

for (const width of [420, 800]) test(`share error keeps the toolbar on one row at viewport ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const card = await answerCard(page);
  await page.evaluate(() => { window.chrome.runtime.sendMessage = async () => ({ ok: false, text: 'Sharing verification was closed. Choose Share again to retry.' }); });
  await card.getByRole('button', { name: 'Share conversation', exact: true }).click();
  await card.getByRole('button', { name: 'Share on WhatsApp', exact: true }).click();
  await expect(card.locator('.share-status')).toBeVisible();
  const copy = await card.getByRole('button', { name: 'Copy answer', exact: true }).boundingBox();
  const share = await card.getByRole('button', { name: 'Share conversation', exact: true }).boundingBox();
  const status = await card.locator('.share-status').boundingBox();
  expect(Math.abs(copy.y - share.y)).toBeLessThan(1);
  expect(status.y).toBeGreaterThanOrEqual(share.y + share.height);
  expect(await card.locator('.a-actions').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  await page.screenshot({ path: `/tmp/shot2ai-0516-toolbar-${width}.png` });
});
