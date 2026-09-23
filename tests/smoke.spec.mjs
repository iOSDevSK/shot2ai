// End to end in a real Chromium with the unpacked extension loaded, against a
// mock of the html2wp bridge on 127.0.0.1:47811.
import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockBridge, pngSize, CODE, PROJECT } from './mock-bridge.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shots = join(root, 'screenshots');
const BUSY = 'The assistant is working on Studio site. Send the screenshot when it finishes.';
const SETUP = 'Wait for environment setup to finish before starting a conversation';

const PAGE = `<!doctype html><html><head><title>Northwind Studio</title><style>
body{margin:0;font:16px/1.5 Georgia,serif;background:#f6f1ea;color:#2b2320}
header{display:flex;justify-content:space-between;align-items:center;padding:22px 48px;background:#fff;border-bottom:1px solid #e6ddd2}
nav a{margin-left:24px;color:#6b5a50;text-decoration:none;font-family:sans-serif;font-size:14px}
.hero{padding:70px 48px;display:grid;grid-template-columns:1.2fr 1fr;gap:40px}
h1{font-size:46px;line-height:1.1;margin:0 0 18px}
.cta{display:inline-block;margin-top:18px;padding:12px 22px;background:#b0512f;color:#fff;border-radius:4px;font-family:sans-serif;transform:translateX(38px)}
.card{height:260px;border-radius:10px;background:linear-gradient(135deg,#c98b5f,#7b4a33)}
</style></head><body><header><strong>Northwind Studio</strong><nav><a href="#">Work</a><a href="#">About</a><a href="#">Contact</a></nav></header>
<section class="hero"><div><h1>Interiors with a quiet, lasting warmth.</h1><p>We design homes and small workplaces around light, material and the way you live.</p><a class="cta" href="#">Book a consultation</a></div><div class="card"></div></section></body></html>`;

let bridge;
let site;
let context;
let extensionId;
let pageUrl;

test.beforeAll(async () => {
  mkdirSync(shots, { recursive: true });
  bridge = await startMockBridge(47811);
  site = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  pageUrl = `http://127.0.0.1:${site.address().port}/`;
  // A toolbar click or the shortcut grants activeTab, which lets the extension
  // capture the page. Playwright cannot click the toolbar, so the copy loaded
  // here holds <all_urls> in place of that gesture. The shipped manifest is unchanged.
  const extension = mkdtempSync(join(tmpdir(), 'h2wp-ext-src-'));
  for (const part of ['manifest.json', 'src', 'icons', 'licenses']) cpSync(join(root, part), join(extension, part), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
  manifest.host_permissions.push('<all_urls>');
  writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'h2wp-ext-')), {
    channel: 'chromium',
    headless: true,
    // A real window at a Retina density rather than emulated metrics: the
    // capture is of the window surface, as it is for the owner.
    viewport: null,
    args: ['--window-size=1280,860', '--force-device-scale-factor=2', `--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  extensionId = new URL(worker.url()).host;
});

test.afterAll(async () => {
  await context?.close();
  await bridge?.close();
  await new Promise((r) => site?.close(r));
});

test('pair, select an area, annotate, and send into the html2wp chat', async () => {
  const page = await context.newPage();
  await page.goto(pageUrl);
  const worker = context.serviceWorkers()[0];
  const tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url === url).id, pageUrl);

  // Popup: not paired yet, then pair with the code from Settings.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.getByRole('heading', { name: 'Pair with html2wp' })).toBeVisible();
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-pairing.png') });
  await popup.getByLabel('Pairing code').fill('000000');
  await popup.getByRole('button', { name: 'Pair', exact: true }).click();
  await expect(popup.getByRole('alert')).toContainText('That code did not match');
  await popup.getByLabel('Pairing code').fill(CODE);
  await popup.getByRole('button', { name: 'Pair', exact: true }).click();
  await expect(popup.locator('#project-name')).toHaveText(PROJECT.name);
  await expect(popup.locator('#chat-state')).toHaveText('Chat ready');
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-paired.png') });

  // The app's reason shows in the popup word for word.
  bridge.state.chat = { available: false, reason: BUSY };
  await popup.reload();
  await expect(popup.locator('#chat-reason')).toHaveText(BUSY);
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-busy.png') });
  bridge.state.chat = { available: true, reason: null };

  // Capture: the overlay appears on the page, drag a 320 × 200 area.
  const editorOpened = context.waitForEvent('page', (p) => p.url().includes('/src/editor.html'));
  await popup.getByRole('button', { name: 'Capture area' }).click();
  await page.locator('#html2wp-area-select').waitFor({ state: 'attached' });
  await page.bringToFront();
  await page.mouse.move(440, 150);
  await page.mouse.down();
  await page.mouse.move(600, 250, { steps: 4 });
  await page.screenshot({ path: join(shots, 'overlay-selecting.png') });
  await page.mouse.move(760, 350, { steps: 4 });
  await page.mouse.up();
  const editor = await editorOpened;
  await editor.locator('#frame').waitFor();
  const dpr = await page.evaluate(() => devicePixelRatio);
  const size = await editor.evaluate(() => ({ width: document.getElementById('canvas').width, height: document.getElementById('canvas').height }));
  expect(size).toEqual({ width: 320 * dpr, height: 200 * dpr });

  // Draw an arrow and check that it is on the canvas.
  const canvas = editor.locator('#canvas');
  const box = await canvas.boundingBox();
  await expect(editor.getByRole('radio', { name: 'Arrow' })).toHaveAttribute('aria-checked', 'true');
  await editor.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.2);
  await editor.mouse.down();
  await editor.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.62, { steps: 6 });
  await editor.mouse.up();
  const red = await editor.evaluate(({ fx, fy }) => {
    const c = document.getElementById('canvas');
    const [r, g, b] = c.getContext('2d').getImageData(Math.round(c.width * fx), Math.round(c.height * fy), 1, 1).data;
    return r > 200 && g < 110 && b < 110;
  }, { fx: 0.32, fy: 0.41 });
  expect(red).toBe(true);
  await expect(editor.getByRole('button', { name: 'Undo' })).toBeEnabled();

  // A rectangle and a label, as a real report would have.
  await editor.getByRole('radio', { name: 'Rectangle' }).click();
  await editor.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.52);
  await editor.mouse.down();
  await editor.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.86, { steps: 6 });
  await editor.mouse.up();
  await editor.getByRole('radio', { name: 'Text' }).click();
  await editor.mouse.click(box.x + box.width * 0.05, box.y + box.height * 0.04);
  await editor.keyboard.type('Shifted right');
  await editor.keyboard.press('Enter');
  await expect(editor.locator('#text-input')).toBeHidden();
  await expect(editor.getByRole('radio', { name: 'Text' })).toHaveAttribute('aria-checked', 'true');
  await editor.getByLabel('Message').fill('The consultation button is pushed to the right of the text column.');
  await expect(editor.locator('#target-state')).toHaveText('Chat ready');
  await editor.screenshot({ path: join(shots, 'editor.png') });

  // 409 from /status: the app's reason, word for word, and the work is kept.
  bridge.state.chat = { available: false, reason: BUSY };
  await editor.getByRole('button', { name: 'Send to html2wp' }).click();
  await expect(editor.locator('#result')).toHaveText(BUSY);
  const retry = editor.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled();
  await editor.screenshot({ path: join(shots, 'editor-busy.png') });
  expect(bridge.state.messages).toHaveLength(0);

  // 409 from /message itself (the chat closed between the check and the send).
  bridge.state.chat = { available: true, reason: null };
  bridge.state.refuseMessage = SETUP;
  await retry.click();
  await expect(editor.locator('#result')).toHaveText(SETUP);
  await expect(editor.getByLabel('Message')).toHaveValue(/consultation button/);

  // Open again: the screenshot and the message arrive.
  bridge.state.refuseMessage = null;
  const closed = editor.waitForEvent('close');
  await editor.getByRole('button', { name: 'Try again' }).click();
  await expect(editor.locator('#result')).toHaveText(`Sent to ${PROJECT.name}`);
  await editor.screenshot({ path: join(shots, 'editor-sent.png') });
  expect(bridge.state.messages).toHaveLength(1);
  const [sent] = bridge.state.messages;
  expect(sent.projectId).toBe(PROJECT.id);
  expect(sent.text).toBe('The consultation button is pushed to the right of the text column.');
  expect(pngSize(sent.png)).toEqual({ width: 320 * dpr, height: 200 * dpr });
  await closed;

  // Every request came from the extension, never from a web page.
  expect(bridge.state.origins.every((o) => o === null || o.startsWith(`chrome-extension://${extensionId}`))).toBe(true);
});
