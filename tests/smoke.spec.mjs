// End to end in a real Chromium with the unpacked extension loaded, against a
// mock of the html2wp bridge on 127.0.0.1:47811 and a mock web chat.
import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockBridge, pngSize, CODE, PROJECT } from './mock-bridge.mjs';

test.describe.configure({ mode: 'serial' });

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

// A stand-in for any web chat: a message box that records what is pasted into it.
const CHAT = `<!doctype html><html><head><title>Team chat</title></head><body style="font:15px sans-serif;padding:40px">
<h1>Team chat</h1><div id="composer" contenteditable="true" style="width:640px;min-height:90px;padding:12px;border:1px solid #ccc;border-radius:12px"></div>
<script>window.received={files:[],text:null};
document.getElementById('composer').addEventListener('paste',async(e)=>{const files=[...e.clipboardData.files];window.received.text=e.clipboardData.getData('text/plain');e.preventDefault();
for(const f of files){const b=await createImageBitmap(f);window.received.files.push({name:f.name,type:f.type,size:f.size,width:b.width,height:b.height})}window.received.done=true});</script></body></html>`;

let bridge;
let site;
let chatSite;
let chatBase;
let context;
let extensionId;
let base;
let page;
let tabId;

test.beforeAll(async () => {
  mkdirSync(shots, { recursive: true });
  bridge = await startMockBridge(47811);
  site = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(PAGE); });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${site.address().port}`;
  // The chat is another site: its own origin.
  chatSite = http.createServer((_, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(CHAT); });
  await new Promise((r) => chatSite.listen(0, '127.0.0.1', r));
  chatBase = `http://127.0.0.1:${chatSite.address().port}`;
  // A toolbar click or the shortcut grants activeTab, which lets the extension
  // capture the page. Playwright cannot click the toolbar, so the copy loaded
  // here holds <all_urls> in place of that gesture, and opens the card's
  // shadow root so the test can reach it. The shipped files are unchanged.
  // SHOT2AI_EXT points at another copy, e.g. the unzipped release ZIP.
  const source = process.env.SHOT2AI_EXT || root;
  const extension = mkdtempSync(join(tmpdir(), 'h2wp-ext-src-'));
  for (const part of ['manifest.json', 'src', 'icons', 'licenses']) cpSync(join(source, part), join(extension, part), { recursive: true });
  const manifest = JSON.parse(readFileSync(join(extension, 'manifest.json'), 'utf8'));
  manifest.host_permissions.push('<all_urls>');
  writeFileSync(join(extension, 'manifest.json'), JSON.stringify(manifest));
  const card = join(extension, 'src', 'card.js');
  writeFileSync(card, readFileSync(card, 'utf8').replace("mode: 'closed'", "mode: 'open'"));
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
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base });
  page = await context.newPage();
  await page.goto(`${base}/`);
  tabId = await worker.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url === url).id, `${base}/`);
});

test.afterAll(async () => {
  await context?.close();
  await bridge?.close();
  await new Promise((r) => site?.close(r));
  await new Promise((r) => chatSite?.close(r));
});

const editors = () => context.pages().filter((p) => p.url().includes('/src/editor.html'));

// Capture with the popup's Capture area button, then drag an area on the page.
async function capture(from = [440, 150], to = [760, 350]) {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await popup.getByRole('button', { name: 'Capture area' }).click();
  await page.locator('#shot2ai-area-select').waitFor({ state: 'attached' });
  await popup.close();
  await page.bringToFront();
  await page.locator('#shot2ai-area-select').waitFor({ state: 'attached' });
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  const card = page.locator('#shot2ai-preview-card .card');
  await card.waitFor();
  return card;
}

test('first run: nothing is chosen, a capture is copied and saved, html2wp status stays hidden', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.getByRole('heading', { name: 'Choose where your screenshots go' })).toBeVisible();
  await expect(popup.locator('.choice')).toHaveText([/^html2wp/, /^ChatGPT/, /^Claude/, /^Custom chat/, /^Save only/, /^Copy only/]);
  await expect(popup.getByText('html2wp is not running')).toBeHidden();
  await expect(popup.locator('#checking, #offline, #pairing, #ready')).toHaveCount(4);
  for (const id of ['checking', 'offline', 'pairing', 'ready']) await expect(popup.locator(`#${id}`)).toBeHidden();
  await expect(popup.getByRole('link', { name: 'html2wp.dev' })).toHaveAttribute('href', 'https://html2wp.dev/');
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-first-run.png') });
  await popup.close();

  // Without a destination the card's main button copies, and the capture is saved.
  const card = await capture();
  await expect(card.locator('.send')).toHaveText('Copy');
  await expect(card.locator('.saved')).toHaveText(/^Saved to Downloads\/shot2ai\/shot2ai-127\.0\.0\.1-/);
  await card.screenshot({ path: join(shots, 'card-first-run.png') });
  await card.locator('.send').click();
  await expect(card.locator('.chip')).toHaveText('Copied');
  expect(bridge.state.messages).toHaveLength(0);
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
});

test('choose html2wp, pair, capture, and send from the preview card in one click', async () => {
  // Choosing html2wp in the first-run list brings up its status: not paired yet.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await popup.locator('[data-choose="html2wp"]').click();
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
  bridge.state.chat = { available: false, reason: BUSY };
  await popup.reload();
  await expect(popup.locator('#chat-reason')).toHaveText(BUSY);
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-busy.png') });
  bridge.state.chat = { available: true, reason: null };

  // The popup's Capture area button starts the same flow on the page.
  await popup.getByRole('button', { name: 'Capture area' }).click();
  await page.locator('#shot2ai-area-select').waitFor({ state: 'attached' });
  await page.bringToFront();
  await page.mouse.move(440, 150);
  await page.mouse.down();
  await page.mouse.move(600, 250, { steps: 4 });
  await page.screenshot({ path: join(shots, 'overlay-selecting.png') });
  await page.mouse.move(760, 350, { steps: 4 });
  await page.mouse.up();
  await popup.close();
  const card = page.locator('#shot2ai-preview-card .card');
  await card.waitFor();
  const dpr = await page.evaluate(() => devicePixelRatio);

  // Every capture is also on the clipboard.
  await expect(card.locator('.chip')).toHaveText('Copied');
  const clip = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const bitmap = await createImageBitmap(await item.getType('image/png'));
    return { types: item.types, width: bitmap.width, height: bitmap.height };
  });
  expect(clip).toEqual({ types: ['image/png'], width: 320 * dpr, height: 200 * dpr });
  await expect(card.getByRole('button', { name: 'Send to html2wp' })).toBeVisible();
  await card.screenshot({ path: join(shots, 'card.png') });

  // One click: the screenshot and the inline message reach the chat, no editor.
  await card.getByLabel('Message').fill('The consultation button is pushed to the right.');
  await card.getByRole('button', { name: 'Send to html2wp' }).click();
  await expect(card.locator('.result')).toHaveText(`Sent to ${PROJECT.name}`);
  await card.screenshot({ path: join(shots, 'card-sent.png') });
  expect(bridge.state.messages).toHaveLength(1);
  expect(bridge.state.messages[0].text).toBe('The consultation button is pushed to the right.');
  expect(bridge.state.messages[0].projectId).toBe(PROJECT.id);
  expect(pngSize(bridge.state.messages[0].png)).toEqual({ width: 320 * dpr, height: 200 * dpr });
  expect(editors()).toHaveLength(0);

  // It stays while hovered, then hides by itself after a success.
  await card.hover();
  await page.waitForTimeout(6500);
  await expect(card).toBeVisible();
  await page.mouse.move(40, 800);
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0, { timeout: 9000 });
});

test('a busy chat shows the app reason in the card; Annotate opens the editor', async () => {
  const card = await capture();
  bridge.state.chat = { available: false, reason: BUSY };
  await card.getByRole('button', { name: 'Send to html2wp' }).click();
  await expect(card.locator('.result')).toContainText(BUSY);
  await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
  await card.screenshot({ path: join(shots, 'card-busy.png') });
  // An error never hides by itself.
  await page.mouse.move(40, 800);
  await page.waitForTimeout(6500);
  await expect(card).toBeVisible();
  expect(bridge.state.messages).toHaveLength(1);

  const opened = context.waitForEvent('page', (p) => p.url().includes('/src/editor.html'));
  await card.getByRole('button', { name: 'Annotate' }).click();
  const editor = await opened;
  await editor.locator('#frame').waitFor();
  const dpr = await page.evaluate(() => devicePixelRatio);
  const size = await editor.evaluate(() => ({ width: document.getElementById('canvas').width, height: document.getElementById('canvas').height }));
  expect(size).toEqual({ width: 320 * dpr, height: 200 * dpr });

  // Draw an arrow and check that it is on the canvas.
  const box = await editor.locator('#canvas').boundingBox();
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
  await editor.getByLabel('Message').fill('The consultation button is pushed to the right of the text column.');

  // 409 from /status: the app's reason, word for word, and the work is kept.
  await editor.getByRole('button', { name: 'Send to html2wp' }).click();
  await expect(editor.locator('#result')).toHaveText(BUSY);
  const retry = editor.getByRole('button', { name: 'Try again' });
  await expect(retry).toBeEnabled();
  await editor.screenshot({ path: join(shots, 'editor-busy.png') });

  // 409 from /message itself (the chat closed between the check and the send).
  bridge.state.chat = { available: true, reason: null };
  bridge.state.refuseMessage = SETUP;
  await retry.click();
  await expect(editor.locator('#result')).toHaveText(SETUP);
  await expect(editor.getByLabel('Message')).toHaveValue(/consultation button/);

  bridge.state.refuseMessage = null;
  const closed = editor.waitForEvent('close');
  await editor.getByRole('button', { name: 'Try again' }).click();
  await expect(editor.locator('#result')).toHaveText(`Sent to ${PROJECT.name}`);
  expect(bridge.state.messages).toHaveLength(2);
  expect(bridge.state.messages[1].text).toBe('The consultation button is pushed to the right of the text column.');
  expect(pngSize(bridge.state.messages[1].png)).toEqual({ width: 320 * dpr, height: 200 * dpr });
  await closed;
  // Esc dismisses the card that still shows the earlier error.
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
});

test('the editor draws and its screenshot looks right', async () => {
  const card = await capture();
  const opened = context.waitForEvent('page', (p) => p.url().includes('/src/editor.html'));
  await card.getByRole('button', { name: 'Annotate' }).click();
  const editor = await opened;
  await editor.locator('#frame').waitFor();
  const box = await editor.locator('#canvas').boundingBox();
  await editor.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.2);
  await editor.mouse.down();
  await editor.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.62, { steps: 6 });
  await editor.mouse.up();
  await editor.getByRole('radio', { name: 'Rectangle' }).click();
  await editor.mouse.move(box.x + box.width * 0.56, box.y + box.height * 0.52);
  await editor.mouse.down();
  await editor.mouse.move(box.x + box.width * 0.97, box.y + box.height * 0.86, { steps: 6 });
  await editor.mouse.up();
  await editor.getByRole('radio', { name: 'Text' }).click();
  await editor.mouse.click(box.x + box.width * 0.05, box.y + box.height * 0.04);
  await editor.keyboard.type('Shifted right');
  await editor.keyboard.press('Enter');
  await editor.getByLabel('Message').fill('The consultation button is pushed to the right of the text column.');
  await expect(editor.locator('#target-state')).toHaveText('Chat ready');
  await editor.waitForTimeout(300);
  await editor.screenshot({ path: join(shots, 'editor.png') });
  await editor.getByRole('button', { name: 'More destinations' }).click();
  await editor.screenshot({ path: join(shots, 'editor-menu.png') });
  await editor.close();
});

test('pasting an image into the editor loads it for annotation', async () => {
  const editor = await context.newPage();
  await editor.goto(`chrome-extension://${extensionId}/src/editor.html`);
  await expect(editor.getByRole('heading', { name: 'Paste a screenshot to annotate it' })).toBeVisible();
  await expect(editor.getByRole('button', { name: /^Send to / })).toBeDisabled();
  await editor.screenshot({ path: join(shots, 'editor-paste.png') });
  await editor.evaluate(async () => {
    const canvas = new OffscreenCanvas(300, 180);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#2e7aff';
    ctx.fillRect(0, 0, 300, 180);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await canvas.convertToBlob({ type: 'image/png' }) })]);
  });
  await editor.locator('body').click({ position: { x: 300, y: 400 } });
  await editor.keyboard.press('ControlOrMeta+V');
  await editor.locator('#frame').waitFor();
  expect(await editor.evaluate(() => [document.getElementById('canvas').width, document.getElementById('canvas').height])).toEqual([300, 180]);
  await expect(editor.locator('#page-title')).toHaveText('Pasted image');
  await expect(editor.getByRole('button', { name: /^Send to / })).toBeEnabled();
  await editor.close();
});

test('options: a custom chat receives the pasted image and text; a copy is saved to Downloads', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await expect(options.locator('#app-state')).toHaveText('Paired');
  await expect(options.getByRole('radio', { name: /^html2wp \(Mac app\)/ })).toBeChecked();
  await expect(options.locator('.foot a')).toHaveAttribute('href', 'https://html2wp.dev/');

  // ChatGPT as the default: the popup shows ChatGPT and its site permission, not html2wp's status.
  await options.getByRole('radio', { name: /^ChatGPT/ }).check();
  await expect(options.locator('#default-state')).toHaveText('ChatGPT');
  await expect(options.getByLabel('Use ChatGPT')).toBeChecked();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.locator('#dest-name')).toHaveText('ChatGPT');
  await expect(popup.locator('#dest-state')).toHaveText('Site permission granted');
  for (const id of ['checking', 'offline', 'pairing', 'ready', 'onboarding']) await expect(popup.locator(`#${id}`)).toBeHidden();
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-chatgpt.png') });
  await popup.close();
  await options.getByLabel('Chat name').fill('Team chat');
  await options.getByLabel('Chat address').fill(`${chatBase}/chat`);
  await options.getByRole('button', { name: 'Add chat' }).click();
  await expect(options.locator('#custom .dest')).toContainText('Team chat');
  // The custom chat becomes the default.
  await options.getByRole('radio', { name: /^Team chat/ }).check();
  await expect(options.locator('#default-state')).toHaveText('Team chat');
  await options.getByLabel('Save a copy of every capture').check();
  await options.locator('#default').scrollIntoViewIfNeeded();
  await expect(options.locator('#example')).toHaveText(/^shot2ai-example\.com-\d{4}-\d\d-\d\d-\d{6}\.png$/);
  await options.screenshot({ path: join(shots, 'options.png'), fullPage: true });
  await options.close();

  const card = await capture([300, 120], [700, 380]);
  const saved = card.locator('.saved');
  await expect(saved).toHaveText(/^Saved to Downloads\/shot2ai\/shot2ai-127\.0\.0\.1-\d{4}-\d\d-\d\d-\d{6}\.png$/);
  const worker = context.serviceWorkers()[0];
  const download = await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const [item] = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 1 });
      if (item && item.state === 'complete') return { state: item.state, filename: item.filename, exists: item.exists, bytes: item.bytesReceived };
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  });
  // Playwright stores downloads under its own names; the file on disk is the PNG.
  expect(download?.state).toBe('complete');
  expect(existsSync(download.filename)).toBe(true);
  expect(readFileSync(download.filename).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');

  // The menu lists html2wp first, then the chats; the main button is the chosen default.
  await card.getByRole('button', { name: 'More destinations' }).click();
  await expect(card.getByRole('menuitem')).toHaveText([/^html2wp/, /^ChatGPT/, /^Team chat/]);
  await card.screenshot({ path: join(shots, 'card-menu.png') });
  await card.getByRole('button', { name: 'More destinations' }).click();
  await card.getByLabel('Message').fill('Please check this spacing.');
  await card.getByRole('button', { name: 'Send to Team chat' }).click();
  // First use: the card says the screenshot goes to that website.
  await expect(card.locator('.result')).toContainText('Team chat is a website');
  await card.screenshot({ path: join(shots, 'card-webchat-notice.png') });
  const chatOpened = context.waitForEvent('page', (p) => p.url().startsWith(`${chatBase}/chat`));
  await card.locator('.result').getByRole('button', { name: 'Continue' }).click();
  const chat = await chatOpened;
  await chat.waitForFunction(() => window.received?.done, null, { timeout: 15000 });
  // The message also lands in the message box as typed text.
  await chat.waitForFunction(() => document.getElementById('composer').innerText.includes('Please check this spacing.'), null, { timeout: 5000 });
  const received = await chat.evaluate(() => ({ ...window.received, composer: document.getElementById('composer').innerText }));
  const dpr = await page.evaluate(() => devicePixelRatio);
  expect(received.files).toHaveLength(1);
  expect(received.files[0]).toMatchObject({ type: 'image/png', width: 400 * dpr, height: 260 * dpr });
  expect(received.text).toBe('Please check this spacing.');
  expect(received.composer).toContain('Please check this spacing.');
  await chat.screenshot({ path: join(shots, 'webchat-pasted.png') });
  await expect(card.locator('.result')).toHaveText('Pasted into Team chat. Press Enter there to send.');
  expect(bridge.state.messages).toHaveLength(2);

  // Every request to the bridge came from the extension, never from a web page.
  expect(bridge.state.origins.every((o) => o === null || o.startsWith(`chrome-extension://${extensionId}`))).toBe(true);
});
