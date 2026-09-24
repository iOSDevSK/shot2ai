// End to end in a real Chromium with the unpacked extension loaded, against a
// mock of the html2wp bridge on a free 127.0.0.1 port and a mock web chat.
import { test, expect, chromium } from '@playwright/test';
import http from 'node:http';
import { mkdtempSync, mkdirSync, cpSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMockBridge, pngSize, CODE, PROJECT } from './mock-bridge.mjs';
import { startMockAI, CODE as ANSWER_CODE } from './mock-ai.mjs';

test.describe.configure({ mode: 'serial' });

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifestVersion = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')).version;
const shots = join(root, 'screenshots');
const BUSY = 'The assistant is working on Studio site. Send the screenshot when it finishes.';
const SETUP = 'Wait for environment setup to finish before starting a conversation';

const DARK = `<!doctype html><html><head><title>Dark page</title></head><body style="margin:0;background:#15171a;color:#e8e8e8;font:18px sans-serif;padding:60px">
<h1>Night mode dashboard</h1><p>Charts and numbers on a dark background.</p><div style="height:220px;border-radius:12px;background:#23272e"></div></body></html>`;
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

// Full-page test pages: a 6,000 px page with a sticky green header and
// markers at known heights; a 9,000 px page (past the canvas limit at 2x);
// and an infinite feed that grows whenever it is scrolled to the bottom.
const LONG = (height) => `<!doctype html><html><head><title>Long page</title><style>
body{margin:0;height:${height}px;position:relative;background:#fff;font:16px sans-serif}
header{position:sticky;top:0;height:60px;background:#00a000;z-index:2}
#m{position:absolute;top:4200px;left:0;width:100%;height:100px;background:#ff00ff}
#end{position:absolute;top:${height - 100}px;left:0;width:100%;height:100px;background:#0000ff}
</style></head><body><header></header><div id="m"></div><div id="end"></div></body></html>`;
const FEED = `<!doctype html><html><head><title>Feed</title></head><body style="margin:0">
<script>let n=0;const add=()=>{const d=document.createElement('div');d.style.cssText='height:1500px;background:'+(n++%2?'#eee':'#ddd');document.body.append(d)};add();add();
let loading=false;addEventListener('scroll',()=>{if(!loading&&innerHeight+scrollY>=document.documentElement.scrollHeight-200){loading=true;setTimeout(()=>{add();loading=false},600)}});</script></body></html>`;

// A stand-in for any web chat, built like ChatGPT's: a message box, a hidden
// file input its attach button would use, and a preview for each image it
// takes, whether picked or pasted.
const CHAT = `<!doctype html><html><head><title>Team chat</title></head><body style="font:15px sans-serif;padding:40px">
<h1>Team chat</h1><form onsubmit="return false"><div id="previews"></div><input type="file" id="upload" accept="image/*" multiple hidden><div id="composer" contenteditable="true" style="width:640px;min-height:90px;padding:12px;border:1px solid #ccc;border-radius:12px"></div>
<button id="send" type="submit" aria-label="Send message">Send</button></form>
<script>window.received={files:[],text:null};window.sent=0;
// Like any chat, a send empties the message box and the previews.
document.getElementById('send').addEventListener('click',()=>{window.sent++;window.received.sentText=document.getElementById('composer').innerText.trim();document.getElementById('composer').replaceChildren();document.getElementById('previews').replaceChildren()});
async function take(files){for(const f of files){const b=await createImageBitmap(f);window.received.files.push({name:f.name,type:f.type,size:f.size,width:b.width,height:b.height});const img=document.createElement('img');img.src=URL.createObjectURL(f);img.style.height='48px';document.getElementById('previews').append(img)}window.received.done=true}
document.getElementById('upload').addEventListener('change',(e)=>take([...e.target.files]));
document.getElementById('composer').addEventListener('paste',async(e)=>{const files=[...e.clipboardData.files];if(!files.length)return;window.received.text=e.clipboardData.getData('text/plain');e.preventDefault();take(files)});</script></body></html>`;
// A chat that takes no image at all: Shot2AI must say so and send nothing.
const DEAF_CHAT = `<!doctype html><html><head><title>Deaf chat</title></head><body><form onsubmit="return false"><div id="composer" contenteditable="true" style="width:640px;min-height:90px;border:1px solid #ccc"></div><button id="send" type="submit" aria-label="Send message">Send</button></form>
<script>window.sent=0;document.getElementById('send').addEventListener('click',()=>{window.sent++});document.getElementById('composer').addEventListener('paste',(e)=>e.preventDefault());</script></body></html>`;

let bridge;
let ai;
let aiChatGPT;
let aiClaude;
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
  bridge = await startMockBridge();
  // Stand-ins for chatgpt.com and claude.ai, each on its own site (see mock-ai.mjs).
  ai = await startMockAI();
  aiChatGPT = `http://127.0.0.1:${ai.port}`;
  aiClaude = `http://localhost:${ai.port}`;
  site = http.createServer((req, res) => {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(req.url === '/long' ? LONG(6000) : req.url === '/tall' ? LONG(9000) : req.url === '/feed' ? FEED : req.url === '/dark' ? DARK : PAGE);
  });
  await new Promise((r) => site.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${site.address().port}`;
  // The chat is another site: its own origin.
  chatSite = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(req.url.startsWith('/deaf') ? DEAF_CHAT : CHAT); });
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
  const progressJs = join(extension, 'src', 'progress.js');
  writeFileSync(progressJs, readFileSync(progressJs, 'utf8').replace("mode: 'closed'", "mode: 'open'"));
  const toolbar = join(extension, 'src', 'toolbar.js');
  writeFileSync(toolbar, readFileSync(toolbar, 'utf8').replace("mode: 'closed'", "mode: 'open'"));
  // Playwright cannot open Chrome's context menu: the copy records the items
  // it creates and exposes the click handler, which the tests call directly.
  // The copy talks only to the mock's port, never to a real html2wp app on 47811–47815.
  const bridgeJs = join(extension, 'src', 'bridge.js');
  const probing = readFileSync(bridgeJs, 'utf8');
  if (!probing.includes('export const PORTS = [47811, 47812, 47813, 47814, 47815];')) throw new Error('bridge.js ports changed; update the test');
  writeFileSync(bridgeJs, probing.replace('export const PORTS = [47811, 47812, 47813, 47814, 47815];', `export const PORTS = [${bridge.port}];`));
  // ChatGPT and Claude point at the stand-ins; the real sites are never loaded.
  const settingsJs = join(extension, 'src', 'settings.js');
  let presets = readFileSync(settingsJs, 'utf8');
  for (const [from, to] of [["url: 'https://chatgpt.com/'", `url: '${aiChatGPT}/chatgpt/'`], ["url: 'https://claude.ai/new'", `url: '${aiClaude}/claude/new'`]]) {
    if (!presets.includes(from)) throw new Error(`settings.js presets changed (${from}); update the test`);
    presets = presets.replace(from, to);
  }
  writeFileSync(settingsJs, presets);
  // Shorter waits for the answer, so the timeout test takes seconds.
  const answerJs = join(extension, 'src', 'answer.js');
  const timing = 'export const TIMING = { poll: 800, settle: 1600, settleUnsure: 5000, quiet: 45000, total: 360000, heartbeat: 5000 };';
  if (!readFileSync(answerJs, 'utf8').includes(timing)) throw new Error('answer.js TIMING changed; update the test');
  writeFileSync(answerJs, readFileSync(answerJs, 'utf8').replace(timing, 'export const TIMING = { poll: 400, settle: 1200, settleUnsure: 3000, quiet: 5000, total: 30000, heartbeat: 1500 };'));
  const background = join(extension, 'src', 'background.js');
  writeFileSync(background, `self.__menu = new Map();
const __create = chrome.contextMenus.create.bind(chrome.contextMenus);
const __removeAll = chrome.contextMenus.removeAll.bind(chrome.contextMenus);
chrome.contextMenus.create = (item, done) => { self.__menu.set(item.id, item); return __create(item, done); };
chrome.contextMenus.removeAll = (...a) => { self.__menu.clear(); return __removeAll(...a); };
${readFileSync(background, 'utf8')}
self.__shot2ai = { onMenuClick, clearStack };
`);
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
  await ai?.close();
  await new Promise((r) => site?.close(r));
  await new Promise((r) => chatSite?.close(r));
});

// The card's menu opens upward over the page: take the page area around both.
async function menuShot(card, name) {
  const box = await card.boundingBox();
  const menu = await card.locator('.menu').boundingBox();
  const top = Math.min(box.y, menu.y) - 8;
  await page.screenshot({ path: join(shots, name), clip: { x: box.x - 8, y: top, width: box.width + 16, height: box.y + box.height + 8 - top } });
}

// Every test starts with an empty capture stack in the test tab.
test.beforeEach(async () => {
  const worker = context.serviceWorkers()[0];
  await worker.evaluate((id) => self.__shot2ai.clearStack(id), tabId);
  await page.evaluate(() => document.getElementById('shot2ai-preview-card')?.remove()).catch(() => {});
});

const editors = () => context.pages().filter((p) => p.url().includes('/src/editor.html'));

// Capture with the popup's Capture area button, then drag an area on the page.
async function capture(from = [440, 150], to = [760, 350]) {
  // The card may already show earlier captures: wait for the new one in front.
  const previous = await page.locator('#shot2ai-preview-card .card').getAttribute('data-id', { timeout: 500 }).catch(() => null);
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
  await expect(card).not.toHaveAttribute('data-id', previous || '-');
  return card;
}

test('out of the box ChatGPT is the default; html2wp status stays hidden', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.getByLabel('Screenshots go to')).toHaveValue('chatgpt');
  // The test copy holds <all_urls>, so chatgpt.com is already allowed here.
  await expect(popup.locator('#dest-state')).toHaveText('Site permission granted');
  await expect(popup.locator('#allow')).toBeHidden();
  for (const id of ['checking', 'offline', 'pairing', 'ready']) await expect(popup.locator(`#${id}`)).toBeHidden();
  await expect(popup.getByText('html2wp is not running')).toBeHidden();
  await expect(popup.getByRole('link', { name: 'html2wp.dev' })).toHaveAttribute('href', 'https://html2wp.dev/');
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-default.png') });
  await popup.close();

  // Before chatgpt.com is allowed the popup offers "Allow ChatGPT". The test copy
  // holds every site, so this page pretends the permission is missing.
  const unallowed = await context.newPage();
  await unallowed.addInitScript(() => { chrome.permissions.contains = async () => false; });
  await unallowed.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(unallowed.locator('#dest-state')).toHaveText('Needs permission');
  await expect(unallowed.getByRole('button', { name: 'Allow ChatGPT' })).toBeVisible();
  await unallowed.locator('.popup').screenshot({ path: join(shots, 'popup-allow.png') });
  await unallowed.close();

  const card = await capture();
  await expect(card.locator('.send')).toHaveText('Send to ChatGPT');
  await card.screenshot({ path: join(shots, 'card-default.png') });
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  expect(bridge.state.messages).toHaveLength(0);
});

test('right-click menu: its items, Capture visible page, selection text, and Send to ▸ Claude', async () => {
  const worker = context.serviceWorkers()[0];
  const menu = () => worker.evaluate(() => [...self.__menu.values()].map((m) => ({ id: m.id, title: m.title, parentId: m.parentId, type: m.type, checked: m.checked, contexts: m.contexts })));
  // The keys Chrome has for the capture commands go in the titles, as "Capture area…  (⌥⇧S)".
  const keys = Object.fromEntries((await worker.evaluate(() => chrome.commands.getAll())).map((c) => [c.name, c.shortcut]));
  const withKey = (title, command) => (keys[command] ? `${title}  (${keys[command]})` : title);
  await expect.poll(async () => (await menu()).map((m) => m.title || m.type)).toEqual([
    'Shot2AI', `Shot2AI v${manifestVersion}`, withKey('Capture area…', 'capture-area'), withKey('Capture visible page', 'capture-visible'),
    withKey('Capture full page', 'capture-full'), withKey('Capture saved region', 'capture-saved'), 'separator', 'Send to', 'ChatGPT', 'html2wp',
    'Capture and send to ChatGPT', 'Send with prompt', 'Fix this bug', 'Explain this', 'Match this design', "What's wrong here?",
    'Send this image to ChatGPT', 'Send selection with a screenshot', 'separator', 'Options']);
  const items = await menu();
  expect(items.find((m) => m.id === 'shot2ai').contexts).toEqual(['page', 'selection', 'image', 'link']);
  expect(items.find((m) => m.id === 'send-image').contexts).toEqual(['image']);
  expect(items.find((m) => m.id === 'send-selection').contexts).toEqual(['selection']);
  expect(items.filter((m) => m.parentId === 'send-to').map((m) => [m.title, m.type, m.checked])).toEqual([['ChatGPT', 'radio', true], ['html2wp', 'radio', false]]);

  const click = (info) => worker.evaluate(async ({ info, id }) => { const tab = await chrome.tabs.get(id); await self.__shot2ai.onMenuClick(info, tab); }, { info, id: tabId });
  // Capture visible page: the whole viewport, straight to the card.
  await page.bringToFront();
  await click({ menuItemId: 'capture-visible' });
  const card = page.locator('#shot2ai-preview-card .card');
  await card.waitFor();
  await expect(card.locator('.send')).toHaveText('Send to ChatGPT');
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  // Send selection with a screenshot: the selected text becomes the message.
  await click({ menuItemId: 'send-selection', selectionText: '  Interiors with a quiet, lasting warmth.  ' });
  await card.waitFor();
  await expect(card.getByLabel('Message')).toHaveValue('Interiors with a quiet, lasting warmth.');
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);

  // Turn Claude on, then pick it under Send to: it becomes the default.
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await options.getByLabel('Use Claude').check();
  await expect.poll(async () => (await menu()).filter((m) => m.parentId === 'send-to').map((m) => m.title)).toEqual(['ChatGPT', 'Claude', 'html2wp']);
  await click({ menuItemId: 'dest:claude' });
  await expect.poll(async () => (await menu()).filter((m) => m.parentId === 'send-to' && m.checked).map((m) => m.title)).toEqual(['Claude']);
  await expect.poll(async () => (await menu()).find((m) => m.id === 'capture-send').title).toBe('Capture and send to Claude');
  await options.reload();
  await expect(options.getByRole('radio', { name: /^Claude/ })).toBeChecked();
  await options.close();
});

test('switching the default to html2wp shows its status; pair, capture, and send in one click', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await options.getByRole('radio', { name: /^html2wp \(Mac app\)/ }).check();
  await expect(options.locator('#default-state')).toHaveText('html2wp');
  await options.close();
  // Now the popup shows html2wp's own status: not paired yet.
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

test('prompts: managed in Options, the default fills the card, the picker fills the message, the menu sends with one', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  const names = () => options.locator('#prompt-list input').evaluateAll((els) => els.map((e) => e.value));
  await expect.poll(names).toEqual(['Fix this bug', 'Explain this', 'Match this design', "What's wrong here?"]);
  await options.getByRole('button', { name: 'Add prompt' }).click();
  await options.getByLabel('Name of prompt 5').fill('Check spacing');
  await options.getByLabel('Name of prompt 5').press('Tab');
  await options.getByLabel('Text of prompt 5').fill('Check the spacing in this screenshot.');
  await options.getByLabel('Text of prompt 5').press('Tab');
  await options.locator('.prompt-row').nth(4).getByRole('button', { name: 'Up' }).click();
  await expect.poll(names).toEqual(['Fix this bug', 'Explain this', 'Match this design', 'Check spacing', "What's wrong here?"]);
  await options.locator('.prompt-row').nth(1).getByRole('button', { name: 'Delete' }).click();
  await expect.poll(names).toEqual(['Fix this bug', 'Match this design', 'Check spacing', "What's wrong here?"]);
  await options.getByLabel('Default prompt').selectOption({ label: 'Check spacing' });
  await options.locator('section[aria-labelledby="prompts-title"]').screenshot({ path: join(shots, 'options-prompts.png') });
  await options.close();

  // The default prompt fills a new capture's message; the picker replaces it.
  const card = await capture();
  const message = card.getByLabel('Message');
  await expect(message).toHaveValue('Check the spacing in this screenshot.');
  await card.getByLabel('Prompts').selectOption({ label: 'Fix this bug' });
  await expect(message).toHaveValue('This screenshot shows a bug. Find the cause and fix it.');
  await card.screenshot({ path: join(shots, 'card-prompt.png') });
  await page.keyboard.press('Escape');

  // The editor has the same picker.
  const editor = await context.newPage();
  await editor.goto(`chrome-extension://${extensionId}/src/editor.html`);
  await expect(editor.locator('#message')).toHaveValue('Check the spacing in this screenshot.');
  await editor.getByLabel('Prompts').selectOption({ label: 'Match this design' });
  await expect(editor.locator('#message')).toHaveValue(/^Make my implementation match the design/);
  await editor.close();

  // Right-click → Send with prompt ▸ Fix this bug: captured and sent with that text.
  const worker = context.serviceWorkers()[0];
  await expect.poll(() => worker.evaluate(() => [...self.__menu.values()].filter((m) => m.parentId === 'prompts').map((m) => m.title)))
    .toEqual(['Fix this bug', 'Match this design', 'Check spacing', "What's wrong here?"]);
  const before = bridge.state.messages.length;
  await page.bringToFront();
  await worker.evaluate(async (id) => self.__shot2ai.onMenuClick({ menuItemId: 'prompt:fix-bug' }, await chrome.tabs.get(id)), tabId);
  await expect(page.locator('#shot2ai-preview-card .result')).toHaveText(`Sent to ${PROJECT.name}`);
  expect(bridge.state.messages).toHaveLength(before + 1);
  expect(bridge.state.messages.at(-1).text).toBe('This screenshot shows a bug. Find the cause and fix it.');
  await page.keyboard.press('Escape');
  await worker.evaluate(() => chrome.storage.local.set({ defaultPrompt: null }));
});

test('capture stack: a deck with its counter, per-card messages, close one, Send all, and it survives navigation', async () => {
  test.setTimeout(180000);
  const worker = context.serviceWorkers()[0];
  const card = page.locator('#shot2ai-preview-card .card');
  const count = card.locator('.count');
  const message = card.getByLabel('Message');
  const deckShot = async (name) => {
    const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    await page.waitForTimeout(250);
    await page.screenshot({ path: join(shots, name), clip: { x: vp.width - 340, y: vp.height - 560, width: 340, height: 560 } });
  };
  const dpr = await page.evaluate(() => devicePixelRatio);

  // Three captures, each with its own message.
  const areas = [[[300, 120], [620, 320]], [[320, 140], [560, 300]], [[340, 160], [700, 420]]];
  for (const [index, [from, to]] of areas.entries()) {
    await capture(from, to);
    await message.fill(`message ${index + 1}`);
    await page.waitForTimeout(450);
  }
  await expect(count).toHaveText('3 / 3');
  await expect(page.locator('#shot2ai-preview-card .peek')).toHaveCount(2);
  await deckShot('stack-3.png');
  await card.getByRole('button', { name: 'Previous capture' }).click();
  await expect(count).toHaveText('2 / 3');
  await expect(message).toHaveValue('message 2');
  // → flips when the card (not the message field) has focus.
  await card.locator('.shot').click({ position: { x: 130, y: 70 } });
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText('3 / 3');
  await expect(message).toHaveValue('message 3');
  // A peeking card comes to the front when clicked.
  await page.locator('#shot2ai-preview-card .peek').last().click({ position: { x: 140, y: 4 } });
  await expect(count).toHaveText('2 / 3');
  // Closing the middle capture leaves the other two.
  await card.getByRole('button', { name: 'Close this capture' }).click();
  await expect(count).toHaveText('2 / 2');
  await expect(message).toHaveValue('message 3');
  await card.getByRole('button', { name: 'Previous capture' }).click();
  await expect(message).toHaveValue('message 1');

  // Send all: both go to html2wp in one message, with both messages.
  const before = bridge.state.messages.length;
  await card.getByRole('button', { name: 'More destinations' }).click();
  await card.getByRole('menuitem', { name: 'Send all captures (2)' }).click();
  await expect(card.locator('.result')).toHaveText(`Sent 2 screenshots to ${PROJECT.name}`);
  expect(bridge.state.messages).toHaveLength(before + 1);
  const sent = bridge.state.messages.at(-1);
  expect(sent.text).toBe('message 1\n\nmessage 3');
  expect(sent.pngs.map(pngSize)).toEqual([{ width: 320 * dpr, height: 200 * dpr }, { width: 360 * dpr, height: 260 * dpr }]);
  // Sent cards leave; with none left, the stack goes.
  await page.mouse.move(40, 800);
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0, { timeout: 10000 });

  // The stack survives navigation within the tab.
  await capture([300, 120], [620, 320]);
  await message.fill('kept across pages');
  await page.waitForTimeout(450);
  await capture([320, 140], [560, 300]);
  await expect(count).toHaveText('2 / 2');
  await page.reload();
  await expect(count).toHaveText('2 / 2', { timeout: 10000 });
  await card.getByRole('button', { name: 'Previous capture' }).click();
  await expect(message).toHaveValue('kept across pages');
  // The popup offers it too, after Esc put it away.
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await popup.getByRole('button', { name: 'Show 2 captures on this page' }).click();
  await popup.close();
  await page.bringToFront();
  await expect(count).toHaveText('2 / 2');

  // An html2wp that does not report maxImages (0.2.8 or older) takes one per message.
  bridge.state.oldApp = true;
  await card.getByRole('button', { name: 'More destinations' }).click();
  await card.getByRole('menuitem', { name: 'Send all captures (2)' }).click();
  await expect(card.locator('.result')).toHaveText(`Sent 1 of 2 to ${PROJECT.name}. Sending several screenshots in one message needs html2wp 0.2.9 or later; send the rest when the assistant finishes.`);
  expect(bridge.state.messages.at(-1).pngs).toHaveLength(1);
  bridge.state.oldApp = false;
  // The one that went leaves; the other stays, unsent.
  await page.mouse.move(40, 800);
  await expect(count).toBeHidden({ timeout: 10000 });
  await expect(page.locator('#shot2ai-preview-card .card')).toHaveCount(1);
  await capture([340, 160], [700, 420]);
  await expect(count).toHaveText('2 / 2');

  // A pasted image joins the stack too (⌘V / Ctrl+V in the popup).
  const pasteIn = await context.newPage();
  await pasteIn.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await pasteIn.evaluate(async () => {
    const c = new OffscreenCanvas(240, 150);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#2e7aff';
    ctx.fillRect(0, 0, 240, 150);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': await c.convertToBlob({ type: 'image/png' }) })]);
  });
  await pasteIn.locator('body').click({ position: { x: 20, y: 20 } });
  await pasteIn.keyboard.press('ControlOrMeta+V');
  await page.bringToFront();
  await expect(count).toHaveText('3 / 3', { timeout: 10000 });
  await pasteIn.close();
  await card.getByRole('button', { name: 'Close this capture' }).click();
  await expect(count).toHaveText('2 / 2');

  // Seven captures: five layers and a +2 badge, on a light and a dark page.
  const menuClick = (menuItemId) => worker.evaluate(async ({ menuItemId, id }) => self.__shot2ai.onMenuClick({ menuItemId }, await chrome.tabs.get(id)), { menuItemId, id: tabId });
  for (let n = 0; n < 5; n++) await menuClick('capture-visible');
  await expect(count).toHaveText('7 / 7');
  await expect(page.locator('#shot2ai-preview-card .more-badge')).toHaveText('+2');
  await deckShot('stack-7.png');
  await page.goto(`${base}/dark`);
  await expect(count).toHaveText('7 / 7', { timeout: 10000 });
  await deckShot('stack-7-dark.png');
  // Nothing sticks out of the window.
  const box = await page.evaluate(() => {
    const card = document.getElementById('shot2ai-preview-card');
    return { width: innerWidth, height: innerHeight };
  });
  const cardBox = await card.boundingBox();
  const peekBox = await page.locator('#shot2ai-preview-card .peek').first().boundingBox();
  expect(cardBox.x + cardBox.width).toBeLessThanOrEqual(box.width);
  expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(box.height);
  expect(peekBox.y).toBeGreaterThanOrEqual(0);
  // Clear all empties it.
  await card.getByRole('button', { name: 'More destinations' }).click();
  await card.getByRole('menuitem', { name: 'Clear all' }).click();
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  expect(await worker.evaluate(async (id) => (await chrome.runtime.getContexts({})).length >= 0 && id, tabId)).toBe(tabId);
  await page.goto(`${base}/`);
  await capture([300, 120], [620, 320]);
  await expect(card.locator('.nav')).toBeHidden();
  await deckShot('stack-1.png');
  await page.keyboard.press('Escape');
});

test('options: a custom chat receives the pasted image and text; a copy is saved to Downloads', async () => {
  const sentBefore = bridge.state.messages.length;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await expect(options.locator('#app-state')).toHaveText('Paired');
  await expect(options.getByRole('radio', { name: /^html2wp \(Mac app\)/ })).toBeChecked();
  await expect(options.locator('.foot').getByRole('link', { name: /^html2wp — convert/ })).toHaveAttribute('href', 'https://html2wp.dev/');

  // ChatGPT as the default: the popup shows ChatGPT and its site permission, not html2wp's status.
  await options.getByRole('radio', { name: /^ChatGPT/ }).check();
  await expect(options.locator('#default-state')).toHaveText('ChatGPT');
  await expect(options.getByLabel('Use ChatGPT')).toBeChecked();
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.getByLabel('Screenshots go to')).toHaveValue('chatgpt');
  await expect(popup.locator('#dest-state')).toHaveText('Site permission granted');
  for (const id of ['checking', 'offline', 'pairing', 'ready']) await expect(popup.locator(`#${id}`)).toBeHidden();
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
  // JPEG at 80 % for web chats and saves.
  await options.getByRole('radio', { name: 'JPEG' }).check();
  await options.getByRole('slider', { name: 'Quality' }).fill('80');
  await options.getByRole('slider', { name: 'Quality' }).dispatchEvent('change');
  await expect(options.locator('#quality-value')).toHaveText('80 %');
  await options.locator('#default').scrollIntoViewIfNeeded();
  await expect(options.locator('#example')).toHaveText(/^shot2ai-example\.com-\d{4}-\d\d-\d\d-\d{6}\.png$/);
  await options.screenshot({ path: join(shots, 'options.png'), fullPage: true });
  await options.close();

  const card = await capture([300, 120], [700, 380]);
  const saved = card.locator('.saved');
  await expect(saved).toHaveText(/^Saved to Downloads\/shot2ai\/shot2ai-127\.0\.0\.1-\d{4}-\d\d-\d\d-\d{6}\.jpg$/);
  await expect(card.locator('.meta')).toHaveText(/^JPEG 80 % · \d+ KB$/);
  const worker = context.serviceWorkers()[0];
  const download = await worker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const [item] = await chrome.downloads.search({ orderBy: ['-startTime'], limit: 1 });
      if (item && item.state === 'complete') return { state: item.state, filename: item.filename, exists: item.exists, bytes: item.bytesReceived };
      await new Promise((r) => setTimeout(r, 100));
    }
    return null;
  });
  // Playwright stores downloads under its own names; the file on disk is the JPEG.
  expect(download?.state).toBe('complete');
  expect(existsSync(download.filename)).toBe(true);
  expect(readFileSync(download.filename).subarray(0, 3).toString('hex')).toBe('ffd8ff');

  // The menu lists html2wp first, then the chats; the main button is the chosen default.
  await card.getByRole('button', { name: 'More destinations' }).click();
  await expect(card.getByRole('menuitem')).toHaveText([/^ChatGPT/, /^Claude/, /^html2wp/, /^Team chat/, /^Capture full page/, 'Add a chat in Options…']);
  await menuShot(card, 'card-menu.png');
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
  expect(received.files[0]).toMatchObject({ type: 'image/jpeg', width: 400 * dpr, height: 260 * dpr });
  expect(received.files[0].name).toMatch(/\.jpg$/);
  expect(received.composer).toContain('Please check this spacing.');
  await chat.screenshot({ path: join(shots, 'webchat-pasted.png') });
  await expect(card.locator('.result')).toHaveText('Pasted into Team chat. Press Enter there to send.');
  expect(bridge.state.messages).toHaveLength(sentBefore);

  // Send to several at once: tick html2wp and Team chat in Options, then one click in the card.
  await page.keyboard.press('Escape');
  const multi = await context.newPage();
  await multi.goto(`chrome-extension://${extensionId}/src/options.html`);
  const several = multi.locator('#multi-list');
  await expect(several.locator('label')).toHaveText(['ChatGPT', 'Claude', 'html2wp (Mac app)', 'Team chat']);
  await several.getByLabel('html2wp (Mac app)').check();
  await several.getByLabel('Team chat').check();
  await multi.close();
  const again = await capture([300, 120], [700, 380]);
  await again.getByLabel('Message').fill('Both, please.');
  await again.getByRole('button', { name: 'More destinations' }).click();
  await expect(again.getByLabel('Select html2wp')).toBeChecked();
  await expect(again.getByLabel('Select Team chat')).toBeChecked();
  await expect(again.getByLabel('Select ChatGPT')).not.toBeChecked();
  await menuShot(again, 'card-multi-menu.png');
  await again.getByRole('menuitem', { name: 'Send to all selected (2)' }).click();
  await expect(again.locator('.result li')).toHaveCount(2, { timeout: 15000 });
  await expect(again.locator('.result li').nth(0)).toHaveText(`✓ html2wpSent to ${PROJECT.name}`);
  await expect(again.locator('.result li').nth(1)).toHaveText('✓ Team chatPasted; press Enter there');
  await again.screenshot({ path: join(shots, 'card-multi.png') });
  // html2wp gets PNG even with JPEG chosen; the chat gets the JPEG, in its existing tab.
  expect(bridge.state.messages).toHaveLength(sentBefore + 1);
  expect(bridge.state.messages.at(-1).text).toBe('Both, please.');
  expect(pngSize(bridge.state.messages.at(-1).png)).toEqual({ width: 400 * dpr, height: 260 * dpr });
  await chat.waitForFunction(() => window.received.files.length === 2);
  expect((await chat.evaluate(() => window.received.files[1])).type).toBe('image/jpeg');
  expect(context.pages().filter((p) => p.url().startsWith(chatBase))).toHaveLength(1);
  // Auto-submit is off unless turned on: nothing pressed the chat's send button so far.
  expect(await chat.evaluate(() => window.sent)).toBe(0);
  await page.keyboard.press('Escape');

  // Auto-submit on for Team chat: after pasting, its send button is pressed.
  const auto = await context.newPage();
  await auto.goto(`chrome-extension://${extensionId}/src/options.html`);
  // The terms notice comes the first time auto-submit is turned on; Cancel leaves it off.
  await auto.getByLabel('Send automatically to Team chat').click();
  await expect(auto.locator('#terms-notice')).toBeVisible();
  await expect(auto.locator('#terms-text')).toHaveText('Auto-submit presses the send button on a third-party website for you. Some services restrict automated use in their terms; you are responsible for using it within them.');
  await auto.getByRole('button', { name: 'Cancel' }).first().click();
  await expect(auto.getByLabel('Send automatically to Team chat')).not.toBeChecked();
  await auto.getByLabel('Send automatically to Team chat').click();
  await auto.getByRole('button', { name: 'I understand, turn it on' }).click();
  await expect(auto.getByLabel('Send automatically to Team chat')).toBeChecked();
  // ChatGPT and Claude send automatically out of the box; off and on again, without the notice.
  await expect(auto.getByLabel('Send automatically to ChatGPT')).toBeChecked();
  await expect(auto.getByLabel('Send automatically to Claude')).toBeChecked();
  await auto.getByLabel('Send automatically to Claude').click();
  await expect(auto.getByLabel('Send automatically to Claude')).not.toBeChecked();
  await auto.getByLabel('Send automatically to Claude').click();
  await expect(auto.locator('#terms-notice')).toBeHidden();
  await expect(auto.getByLabel('Send automatically to Claude')).toBeChecked();
  await auto.locator('#dest-title').scrollIntoViewIfNeeded();
  await auto.locator('section[aria-labelledby="dest-title"]').screenshot({ path: join(shots, 'options-destinations.png') });
  await auto.close();
  const third = await capture([300, 120], [700, 380]);
  await third.getByLabel('Message').fill('Send it straight away.');
  await third.getByRole('button', { name: 'Send to Team chat' }).click();
  await expect(third.locator('.result')).toContainText('Sent to Team chat.', { timeout: 15000 });
  await expect(third.getByRole('button', { name: 'Open Team chat tab' })).toBeVisible();
  expect(await chat.evaluate(() => window.sent)).toBe(1);
  // Typed in a background tab, the message went with it.
  expect(await chat.evaluate(() => window.received.sentText)).toContain('Send it straight away.');
  // Sent automatically, the chat's tab stayed behind the owner's page.
  expect(await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url)).toBe(`${base}/`);
  await page.keyboard.press('Escape');
  // No send button to be found: the card says so and leaves the text for Enter.
  await chat.evaluate(() => document.getElementById('send').remove());
  const fourth = await capture([300, 120], [700, 380]);
  await fourth.getByRole('button', { name: 'Send to Team chat' }).click();
  await expect(fourth.locator('.result')).toContainText('Pasted into Team chat. Its send button was not found; press Enter there.', { timeout: 15000 });
  await expect(fourth.getByRole('button', { name: 'Open Team chat tab' })).toBeVisible();
  await fourth.screenshot({ path: join(shots, 'card-autosubmit-missing.png') });
  await page.keyboard.press('Escape');

  // Every request to the bridge came from the extension, never from a web page.
  expect(bridge.state.origins.filter((o) => o !== null && !o.startsWith(`chrome-extension://${extensionId}`))).toEqual([]);
});

test('saved region: remembered per site, captured again from the menu, clamped to the viewport', async () => {
  const worker = context.serviceWorkers()[0];
  const card = await capture([300, 120], [620, 320]);
  await card.getByRole('button', { name: 'Region' }).click();
  await expect(card.getByRole('menuitem', { name: 'Capture saved region' })).toBeDisabled();
  await card.screenshot({ path: join(shots, 'card-region.png') });
  await card.getByRole('menuitem', { name: 'Remember this region' }).click();
  await expect(card.locator('.chip')).toHaveText('Region remembered');
  await page.keyboard.press('Escape');
  const saved = await worker.evaluate(async () => (await chrome.storage.local.get('regions')).regions);
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, dpr: devicePixelRatio }));
  expect(saved[base]).toEqual({ x: 300 / viewport.width, y: 120 / viewport.height, w: 320 / viewport.width, h: 200 / viewport.height });

  // Size of the next capture, read in the editor after Annotate.
  const capturedSize = async () => {
    const next = page.locator('#shot2ai-preview-card .card');
    await next.waitFor();
    const opened = context.waitForEvent('page', (p) => p.url().includes('/src/editor.html'));
    await next.getByRole('button', { name: 'Annotate' }).click();
    const editor = await opened;
    await editor.locator('#frame').waitFor();
    const size = await editor.evaluate(() => [document.getElementById('canvas').width, document.getElementById('canvas').height]);
    await editor.close();
    await page.bringToFront();
    return size;
  };
  // A menu capture: wait until the new capture is in front of the card.
  const menuClick = async (menuItemId) => {
    const front = page.locator('#shot2ai-preview-card .card');
    const previous = await front.getAttribute('data-id', { timeout: 500 }).catch(() => null);
    await worker.evaluate(async ({ menuItemId, id }) => self.__shot2ai.onMenuClick({ menuItemId }, await chrome.tabs.get(id)), { menuItemId, id: tabId });
    await expect(front).not.toHaveAttribute('data-id', previous || '-');
  };
  await menuClick('capture-saved');
  const [w, h] = await capturedSize();
  expect(Math.abs(w - 320 * viewport.dpr)).toBeLessThanOrEqual(2);
  expect(Math.abs(h - 200 * viewport.dpr)).toBeLessThanOrEqual(2);

  // A region reaching past the viewport is cut at its edge.
  await worker.evaluate((site) => chrome.storage.local.set({ regions: { [site]: { x: 0.9, y: 0.8, w: 0.5, h: 0.5 } } }), base);
  await menuClick('capture-saved');
  const [cw, ch] = await capturedSize();
  expect(Math.abs(cw - 0.1 * viewport.width * viewport.dpr)).toBeLessThanOrEqual(2);
  expect(Math.abs(ch - 0.2 * viewport.height * viewport.dpr)).toBeLessThanOrEqual(2);
});

test('floating toolbar: off by default, on with all-site access, draggable, collapsible, hidden per site', async () => {
  const worker = context.serviceWorkers()[0];
  const registered = () => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).map((c) => c.id));
  const bar = page.locator('#shot2ai-toolbar .bar');
  await page.reload();
  await expect(page.locator('#shot2ai-toolbar')).toHaveCount(0);
  expect(await registered()).toEqual([]);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await expect(options.locator('#toolbar-state')).toHaveText('Off');
  await options.getByLabel('Show the toolbar on every page').check();
  await expect(options.locator('#toolbar-state')).toHaveText('On');
  expect(await registered()).toEqual(['shot2ai-toolbar']);
  await options.locator('section[aria-labelledby="toolbar-title"]').screenshot({ path: join(shots, 'options-toolbar.png') });

  await page.bringToFront();
  await page.reload();
  await expect(bar).toBeVisible();
  await expect(bar.locator('.dest')).toHaveText('→ Team chat');
  const start = await bar.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  expect(start.x).toBeLessThan(40);
  expect(start.y + start.height).toBeGreaterThan(viewport.height - 40);
  await page.screenshot({ path: join(shots, 'toolbar-page.png'), clip: { x: 0, y: viewport.height - 90, width: 520, height: 90 } });

  // Visible: the toolbar steps aside while the page is captured, then the card opens.
  await bar.getByRole('button', { name: 'Visible' }).click();
  await page.locator('#shot2ai-preview-card .card').waitFor();
  await expect(bar).toBeVisible();
  await page.keyboard.press('Escape');

  // Dragged by its grip; the place is kept for this site.
  const grip = bar.locator('.grip');
  const g = await grip.boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down();
  await page.mouse.move(g.x + 300, g.y - 200, { steps: 6 });
  await page.mouse.up();
  const moved = await bar.boundingBox();
  expect(Math.round(moved.x - start.x)).toBeGreaterThan(250);
  await expect.poll(() => worker.evaluate((site) => chrome.storage.local.get('toolbarPos').then((v) => !!v.toolbarPos?.[site]), base)).toBe(true);
  await page.reload();
  await expect(bar).toBeVisible();
  const kept = await bar.boundingBox();
  expect(Math.abs(kept.x - moved.x)).toBeLessThanOrEqual(2);
  expect(Math.abs(kept.y - moved.y)).toBeLessThanOrEqual(2);

  // Collapsed to a dot, and back.
  await bar.getByRole('button', { name: 'Collapse the toolbar' }).click();
  const dot = page.locator('#shot2ai-toolbar .dot');
  await expect(dot).toBeVisible();
  await expect(bar).toBeHidden();
  await page.reload();
  await expect(dot).toBeVisible();
  await dot.click();
  await expect(bar).toBeVisible();

  // Hidden on this site, listed in Options, shown again.
  await bar.getByRole('button', { name: 'More' }).click();
  await page.locator('#shot2ai-toolbar').getByRole('menuitem', { name: 'Hide on this site' }).click();
  await expect(page.locator('#shot2ai-toolbar')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#shot2ai-toolbar')).toHaveCount(0);
  await options.reload();
  await expect(options.locator('#toolbar-hidden .dest')).toContainText(new URL(base).host);
  await options.getByRole('button', { name: 'Show again' }).click();
  await page.reload();
  await expect(bar).toBeVisible();

  // A stored quality outside 50–100 is shown as it is applied.
  await worker.evaluate(() => chrome.storage.local.set({ imageFormat: 'webp', imageQuality: 30 }));
  await options.reload();
  await expect(options.locator('#quality-value')).toHaveText('50 %');
  await worker.evaluate(() => chrome.storage.local.set({ imageFormat: 'jpeg', imageQuality: 80 }));

  // Off: unregistered, and gone from the page.
  await options.getByLabel('Show the toolbar on every page').uncheck();
  await expect(options.locator('#toolbar-state')).toHaveText('Off');
  expect(await registered()).toEqual([]);
  await page.reload();
  await expect(page.locator('#shot2ai-toolbar')).toHaveCount(0);
  await options.close();

  // All-site access gone while the toolbar is on: it switches itself off.
  // (The test copy always holds all-site access, so this page pretends it is missing.)
  await worker.evaluate(() => chrome.storage.local.set({ toolbar: { enabled: true, collapsed: false } }));
  const revoked = await context.newPage();
  await revoked.addInitScript(() => { chrome.permissions.contains = async () => false; });
  await revoked.goto(`chrome-extension://${extensionId}/src/options.html`);
  await expect(revoked.locator('#toolbar-state')).toHaveText('Off');
  await expect(revoked.getByLabel('Show the toolbar on every page')).not.toBeChecked();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('toolbar')).toolbar.enabled)).toBe(false);
  expect(await registered()).toEqual([]);
  await revoked.close();
});

test('full page: stitched to the page height, sticky header once, capped feeds, the canvas limit, and Esc cancels', async () => {
  test.setTimeout(180000);
  const worker = context.serviceWorkers()[0];
  const menuClick = (menuItemId) => worker.evaluate(async ({ menuItemId, id }) => self.__shot2ai.onMenuClick({ menuItemId }, await chrome.tabs.get(id)), { menuItemId, id: tabId });
  // The capture opens in the card; Annotate opens it in the editor, where its pixels can be read.
  const inEditor = async () => {
    const card = page.locator('#shot2ai-preview-card .card');
    await card.waitFor();
    const opened = context.waitForEvent('page', (p) => p.url().includes('/src/editor.html'));
    await card.getByRole('button', { name: 'Annotate' }).click();
    const editor = await opened;
    await editor.locator('#frame').waitFor();
    return editor;
  };
  const pixel = (editor, x, y) => editor.evaluate(([x, y]) => [...document.getElementById('canvas').getContext('2d').getImageData(x, y, 1, 1).data].slice(0, 3), [x, y]);

  await page.goto(`${base}/long`);
  await page.bringToFront();
  const dpr = await page.evaluate(() => devicePixelRatio);
  await page.evaluate(() => scrollTo(0, 300));
  await menuClick('capture-full');
  const card = page.locator('#shot2ai-preview-card .card');
  await card.waitFor();
  await expect(card.locator('.note')).toBeHidden();
  await card.screenshot({ path: join(shots, 'card-fullpage.png') });
  expect(await page.evaluate(() => scrollY)).toBe(300);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('header')).visibility)).toBe('visible');
  let editor = await inEditor();
  const [w, h] = await editor.evaluate(() => [document.getElementById('canvas').width, document.getElementById('canvas').height]);
  expect(Math.abs(h - 6000 * dpr)).toBeLessThanOrEqual(dpr);
  expect(w).toBe(await page.evaluate(() => innerWidth * devicePixelRatio));
  // The markers sit at their own heights; the green header only at the very top.
  expect(await pixel(editor, 10, 30 * dpr)).toEqual([0, 160, 0]);
  expect(await pixel(editor, 10, 4250 * dpr)).toEqual([255, 0, 255]);
  expect(await pixel(editor, 10, 5950 * dpr)).toEqual([0, 0, 255]);
  const greenBelowTop = await editor.evaluate((dpr) => {
    const ctx = document.getElementById('canvas').getContext('2d');
    const rows = [];
    for (let y = 100; y < 5800; y += 20) { const [r, g, b] = ctx.getImageData(10, y * dpr, 1, 1).data; if (r < 40 && g > 120 && b < 40) rows.push(y); }
    return rows;
  }, dpr);
  expect(greenBelowTop).toEqual([]);
  await editor.close();
  await page.bringToFront();
  await page.keyboard.press('Escape');

  // Past the browser's canvas limit (9,000 px at 2x is 18,000): scaled down, and said so.
  await page.goto(`${base}/tall`);
  await page.bringToFront();
  await menuClick('capture-full');
  await expect(card.locator('.note')).toHaveText(/^Scaled to \d+ % to stay within the browser's 16,384 px image limit$/);
  editor = await inEditor();
  const tallHeight = await editor.evaluate(() => document.getElementById('canvas').height);
  expect(tallHeight).toBeLessThanOrEqual(16384);
  expect(tallHeight).toBeGreaterThan(16000);
  await editor.close();
  await page.bringToFront();
  await page.keyboard.press('Escape');

  // A long page past the height limit set in Options stops there, and says so.
  await worker.evaluate(() => chrome.storage.local.set({ fullPageMaxHeight: 5000 }));
  await menuClick('capture-full');
  await expect(card.locator('.note')).toHaveText("Stopped at 5,000 px, the limit set in Options (the page is longer)");
  editor = await inEditor();
  expect(Math.abs((await editor.evaluate(() => document.getElementById('canvas').height)) - 5000 * dpr)).toBeLessThanOrEqual(dpr);
  await editor.close();
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await worker.evaluate(() => chrome.storage.local.set({ fullPageMaxHeight: 20000 }));

  // An infinite feed stops, and says why.
  await page.goto(`${base}/feed`);
  await page.bringToFront();
  await menuClick('capture-full');
  await expect(card.locator('.note')).toHaveText(/^Stopped at [\d,]+ px \(the page keeps loading more\)$/);
  await card.screenshot({ path: join(shots, 'card-fullpage-capped.png') });
  await page.keyboard.press('Escape');

  // Esc during the capture cancels it: no card, and the page is back where it was.
  await page.goto(`${base}/long`);
  await page.bringToFront();
  await page.evaluate(() => scrollTo(0, 500));
  await worker.evaluate((id) => { chrome.tabs.get(id).then((t) => self.__shot2ai.onMenuClick({ menuItemId: 'capture-full' }, t)); }, tabId);
  const progress = page.locator('#shot2ai-progress .pill');
  await expect(progress).toContainText(/Capturing \d+\/\d+…/);
  const vp = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await expect(progress).toBeVisible();
  await page.screenshot({ path: join(shots, 'fullpage-progress.png'), clip: { x: vp.width - 320, y: vp.height - 80, width: 320, height: 80 } });
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-progress')).toHaveCount(0, { timeout: 10000 });
  await page.waitForTimeout(1000);
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  expect(await page.evaluate(() => scrollY)).toBe(500);
  await page.goto(`${base}/`);
});

test('legal: manifest name and description fit, the disclaimer shows, the version is the manifest\'s', async () => {
  const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));
  expect(manifest.name).toBe('Shot2AI — Screenshot, Annotate & Send to AI');
  expect(manifest.name.length).toBeLessThanOrEqual(75);
  expect(manifest.description.length).toBeLessThanOrEqual(132);
  expect(`${manifest.name} ${manifest.short_name}`).not.toMatch(/gpt|claude|openai|anthropic/i);

  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await expect(options.locator('#disclaimer')).toHaveText('ChatGPT is a trademark of OpenAI. Claude is a trademark of Anthropic. Shot2AI is an independent product and is not affiliated with, endorsed by or sponsored by OpenAI or Anthropic.');
  await expect(options.locator('#version')).toHaveText(`Shot2AI v${manifest.version}`);
  await expect(options.locator('#publisher')).toContainText('BELNEM s.r.o.');
  await expect(options.getByRole('link', { name: "What's new" })).toHaveAttribute('href', `https://github.com/iOSDevSK/shot2ai/releases/tag/v${manifest.version}`);
  await expect(options.locator('#privacy-link')).toHaveAttribute('href', 'https://html2wp.dev/shot2ai/privacy');
  await expect(options.locator('.foot').getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', 'https://html2wp.dev/shot2ai/privacy');
  await options.locator('#privacy').screenshot({ path: join(shots, 'options-privacy.png') });
  await options.locator('.foot').screenshot({ path: join(shots, 'options-footer.png') });
  await options.close();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await expect(popup.locator('#version')).toHaveText(`Shot2AI v${manifest.version}`);
  await expect(popup.locator('.publisher')).toHaveText('Shot2AI by BELNEM s.r.o.');
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-publisher.png') });
  await popup.close();
  const editor = await context.newPage();
  await editor.goto(`chrome-extension://${extensionId}/src/editor.html`);
  await expect(editor.locator('#version')).toHaveText(`v${manifest.version}`);
  await editor.close();
});

test('keyboard shortcuts: listed live in Options, Not set shown, Change shortcuts opens Chrome\'s page, keys in the popup', async () => {
  const worker = context.serviceWorkers()[0];
  // Chrome's own bindings, as they are in this browser.
  const real = Object.fromEntries((await worker.evaluate(() => chrome.commands.getAll())).map((c) => [c.name, c.shortcut]));
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html#shortcuts`);
  const list = options.locator('#shortcut-list');
  for (const command of ['capture-area', 'capture-visible', 'capture-full', 'capture-saved', 'show-stack']) {
    await expect(list.locator(`[data-command="${command}"]`)).toHaveText(real[command] || 'Not set');
  }
  await options.locator('#shortcuts').screenshot({ path: join(shots, 'options-shortcuts.png') });
  // Change shortcuts opens chrome://extensions/shortcuts; extensions cannot set keys themselves.
  const opened = context.waitForEvent('page', { timeout: 10000 });
  await options.getByRole('button', { name: 'Change shortcuts' }).click();
  const chromePage = await opened;
  await expect.poll(() => chromePage.url()).toBe('chrome://extensions/shortcuts');
  await chromePage.close();
  await options.close();

  // With the keys changed or removed in Chrome (stubbed here), the list follows.
  const stubbed = await context.newPage();
  await stubbed.addInitScript(() => {
    chrome.commands.getAll = async () => [
      { name: 'capture-area', shortcut: '⌥⇧A', description: 'Capture area' },
      { name: 'capture-visible', shortcut: '', description: 'Capture visible page' },
      { name: 'capture-full', shortcut: '⌥⇧F', description: 'Capture full page' },
      { name: 'capture-saved', shortcut: '', description: 'Capture saved region' },
      { name: 'show-stack', shortcut: '⌥⇧C', description: "Show this tab's captures" },
    ];
  });
  await stubbed.goto(`chrome-extension://${extensionId}/src/options.html#shortcuts`);
  const keysShown = stubbed.locator('#shortcut-list [data-command]');
  await expect(keysShown).toHaveText(['⌥⇧A', 'Not set', '⌥⇧F', 'Not set', '⌥⇧C']);
  await expect(stubbed.locator('#shortcut-list .key-row > span:first-child')).toHaveText(['Capture area', 'Capture visible page', 'Capture full page', 'Capture saved region', "Show this tab's captures"]);
  await stubbed.locator('#shortcuts').screenshot({ path: join(shots, 'options-shortcuts-unset.png') });
  await stubbed.close();

  // The popup shows the keys on its capture buttons.
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  if (real['capture-area']) await expect(popup.locator('#key-area')).toHaveText(real['capture-area']);
  if (real['capture-full']) await expect(popup.locator('#key-full')).toHaveText(real['capture-full']);
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-shortcuts.png') });
  await popup.close();
  console.log('SHORTCUTS', JSON.stringify(real));
});

test('privacy: Clear all captures and settings empties storage and captures', async () => {
  const worker = context.serviceWorkers()[0];
  expect(Object.keys(await worker.evaluate(() => chrome.storage.local.get(null)))).toEqual(expect.arrayContaining(['token', 'customChats', 'defaultDestination']));
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await options.getByRole('button', { name: 'Clear all captures and settings' }).click();
  await expect(options.locator('#clear-confirm')).toBeVisible();
  await options.locator('#privacy').screenshot({ path: join(shots, 'options-clear.png') });
  await options.getByRole('button', { name: 'Clear everything' }).click();
  await options.waitForLoadState('load');
  await expect(options.locator('#default-state')).toHaveText(/ChatGPT/);
  // Only what the reopened page writes back: the built-in prompts, and the
  // port where it just found the app. The pairing token and the rest are gone.
  const left = await worker.evaluate(() => chrome.storage.local.get(null));
  expect(Object.keys(left).filter((k) => !['prompts', 'port'].includes(k))).toEqual([]);
  expect(left.token).toBeUndefined();
  expect((left.prompts || []).map((p) => p.name)).toEqual(['Fix this bug', 'Explain this', 'Match this design', "What's wrong here?"]);
  // The captures database was deleted; the reopened page may create it again, empty.
  const counts = await worker.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('shot2ai-captures', 2);
    req.onupgradeneeded = () => { for (const n of ['captures', 'handles']) if (!req.result.objectStoreNames.contains(n)) req.result.createObjectStore(n); };
    req.onsuccess = () => {
      const tx = req.result.transaction(['captures', 'handles']);
      const a = tx.objectStore('captures').count();
      const b = tx.objectStore('handles').count();
      tx.oncomplete = () => { req.result.close(); resolve([a.result, b.result]); };
    };
  }));
  expect(counts).toEqual([0, 0]);
  await options.close();
});

test('web chat: a chat that takes no image gets nothing, and the card says why', async () => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  await options.getByLabel('Chat name').fill('Deaf chat');
  // Its own site (localhost, not 127.0.0.1): a chat on the same site would reuse Team chat's tab.
  await options.getByLabel('Chat address').fill(`${chatBase.replace('127.0.0.1', 'localhost')}/deaf`);
  await options.getByRole('button', { name: 'Add chat' }).click();
  await options.getByRole('radio', { name: /^Deaf chat/ }).check();
  await expect(options.locator('#default-state')).toHaveText('Deaf chat');
  await options.close();
  const card = await capture([300, 120], [600, 320]);
  await card.getByLabel('Message').fill('Nothing should arrive.');
  await card.getByRole('button', { name: 'Send to Deaf chat' }).click();
  const notice = card.getByRole('button', { name: 'Continue' });
  if (await notice.isVisible().catch(() => false)) await notice.click();
  await expect(card.locator('.result')).toContainText('Deaf chat did not take the image, so nothing was sent.', { timeout: 20000 });
  const deaf = context.pages().find((p) => p.url().startsWith(`${chatBase.replace('127.0.0.1', 'localhost')}/deaf`));
  expect(await deaf.evaluate(() => ({ sent: window.sent, text: document.getElementById('composer').innerText.trim() }))).toEqual({ sent: 0, text: '' });
});

// ---- 0.4.0: the destination list, auto-send and the answer card ------------

const activeTab = () => context.serviceWorkers()[0].evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.url);
// A fresh stand-in page for every case: the mode is read when it loads.
async function freshAI(mode) {
  for (const p of context.pages()) if (p.url().startsWith(aiChatGPT) || p.url().startsWith(aiClaude)) await p.close();
  ai.reset(mode);
}
async function useDefault(id) {
  await context.serviceWorkers()[0].evaluate(async (id) => {
    const { presets = {} } = await chrome.storage.local.get('presets');
    await chrome.storage.local.set({ defaultDestination: id, presets: { ...presets, [id]: true } });
  }, id);
}
// Send, and pass the first-use notice if this chat was not sent to before.
async function sendNow(card, name) {
  await card.getByRole('button', { name: `Send to ${name}` }).click();
  const notice = card.locator('.result').getByRole('button', { name: 'Continue' });
  if (await notice.isVisible().catch(() => false)) await notice.click();
}
const answerShot = async (card, name) => {
  await page.waitForTimeout(200);
  const box = await card.boundingBox();
  await page.screenshot({ path: join(shots, name), clip: { x: box.x - 14, y: box.y - 14, width: box.width + 28, height: box.height + 28 } });
};

test('popup: the destination list changes the default right there, in step with Options', async () => {
  const worker = context.serviceWorkers()[0];
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extensionId}/src/options.html`);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  const select = popup.getByLabel('Screenshots go to');
  // The same destinations as Options, in the same order.
  const listed = await select.locator('option').allTextContents();
  const inOptions = await options.locator('#default-list strong').allTextContents();
  expect(listed.map((t) => t.split(' — ')[0])).toEqual(inOptions.map((t) => t.replace(' (default)', '')));
  expect(listed[0]).toBe(`ChatGPT — ${new URL(aiChatGPT).host}`);
  expect(listed.slice(-2)).toEqual(['Copy only — the clipboard', 'Save only — Downloads/shot2ai']);
  await expect(popup.getByRole('button', { name: 'Change default destination' })).toHaveCount(0);

  // Picked in the popup: saved at once, with Claude turned on in the card's menu, and Options follows.
  await select.selectOption('claude');
  await expect.poll(() => worker.evaluate(() => chrome.storage.local.get(['defaultDestination', 'presets']))).toMatchObject({ defaultDestination: 'claude', presets: { claude: true } });
  await expect(options.getByRole('radio', { name: /^Claude/ })).toBeChecked();
  await expect(options.locator('#default-state')).toHaveText('Claude');
  await expect(popup.locator('#dest-state')).toHaveText('Site permission granted');
  // Reached with the keyboard, it shows a focus ring.
  await popup.locator('#options').focus();
  await popup.keyboard.press('Tab');
  await expect(select).toBeFocused();
  expect(await select.evaluate((el) => getComputedStyle(el).boxShadow)).not.toBe('none');
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-destination.png') });

  // Picked in Options: the open popup follows.
  await options.getByRole('radio', { name: /^ChatGPT/ }).check();
  await expect(select).toHaveValue('chatgpt');
  // html2wp: its own status appears under the list.
  await select.selectOption('html2wp');
  await expect(popup.getByRole('heading', { name: 'Pair with html2wp' })).toBeVisible();
  await expect(popup.locator('#dest-state')).toBeHidden();
  await popup.locator('.popup').screenshot({ path: join(shots, 'popup-destination-html2wp.png') });
  await select.selectOption('copy');
  await expect(popup.locator('#dest-state')).toHaveText('Ready');
  await expect(popup.locator('#pairing')).toBeHidden();
  await options.close();
  await popup.close();

  // A site not allowed yet: Chrome's prompt is asked from the change, the
  // choice is kept even when it is declined, and the popup says what is missing.
  const unallowed = await context.newPage();
  await unallowed.addInitScript(() => { chrome.permissions.contains = async () => false; chrome.permissions.request = async () => { window.asked = (window.asked || 0) + 1; return false; }; });
  await unallowed.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await unallowed.getByLabel('Screenshots go to').selectOption('claude');
  await expect.poll(() => worker.evaluate(() => chrome.storage.local.get('defaultDestination').then((v) => v.defaultDestination))).toBe('claude');
  expect(await unallowed.evaluate(() => window.asked)).toBe(1);
  await expect(unallowed.locator('#dest-state')).toHaveText('Needs permission');
  await expect(unallowed.getByRole('button', { name: 'Allow Claude' })).toBeVisible();
  await unallowed.locator('.popup').screenshot({ path: join(shots, 'popup-destination-allow.png') });
  await unallowed.close();
});

test('auto-send to Claude: sent in its tab behind the page, and the answer streams into the card', async () => {
  test.setTimeout(120000);
  await freshAI('ok');
  await useDefault('claude');
  // Slower chunks, so the answer can be seen while it streams.
  ai.state.chunkMs = 700;
  const dpr = await page.evaluate(() => devicePixelRatio);
  const card = await capture([440, 150], [760, 350]);
  await card.getByLabel('Message').fill('Why is this button off?');
  await card.getByRole('button', { name: 'Send to Claude' }).click();
  // First use: the card says it goes to that site, is sent automatically, and the answer comes here.
  await expect(card.locator('.result')).toContainText('Claude is a website.');
  await expect(card.locator('.result')).toContainText('will be sent automatically, without you reviewing it; the answer then shows here.');
  await card.screenshot({ path: join(shots, 'card-auto-notice.png') });
  await card.locator('.result').getByRole('button', { name: 'Continue' }).click();
  // At once the card turns into the answer card.
  await expect(card.locator('.a-status')).toHaveText('Sending to Claude…');
  await expect(card.locator('.a-asked')).toHaveText('Why is this button off?');
  await answerShot(card, 'answer-sending.png');
  await expect(card.locator('.a-status')).toHaveText('Claude is answering…', { timeout: 20000 });
  await expect(card.locator('.a-body strong')).toHaveText('Book a consultation', { timeout: 10000 });
  await answerShot(card, 'answer-streaming.png');
  await expect(card.locator('.a-status')).toHaveText('Claude answered', { timeout: 20000 });
  ai.state.chunkMs = 250;
  // The owner never left the page; Claude's tab got the image, the message and one press of Send.
  expect(await activeTab()).toBe(`${base}/`);
  expect(ai.state.sent).toHaveLength(1);
  expect(ai.state.sent[0]).toMatchObject({ kind: 'claude', text: 'Why is this button off?' });
  expect(ai.state.uploads).toHaveLength(1);
  expect(ai.state.uploads[0]).toMatchObject({ type: 'image/png', width: 320 * dpr, height: 200 * dpr });
  // The answer, readable: bold, a list, a code block, a safe link.
  const body = card.locator('.a-body');
  await expect(body.locator('p').first()).toContainText('Answer 1: the Book a consultation button is pushed to the right by transform: translateX(38px).');
  await expect(body.locator('li')).toHaveText(['Remove the transform', 'Or set it to none']);
  await expect(body.locator('pre code')).toHaveText(ANSWER_CODE);
  await expect(body.locator('pre .lang')).toHaveText('css');
  const mdn = body.getByRole('link', { name: 'MDN' });
  await expect(mdn).toHaveAttribute('href', 'https://developer.mozilla.org/en-US/docs/Web/CSS/transform');
  await expect(mdn).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  await expect(card.getByRole('button', { name: 'Copy answer' })).toBeVisible();
  await expect(card.getByRole('button', { name: 'Continue in Claude' })).toBeVisible();
  await page.mouse.move(40, 800);
  await answerShot(card, 'answer-done.png');
  // Copy answer: the answer as Markdown.
  await card.getByRole('button', { name: 'Copy answer' }).click();
  await expect(card.getByRole('button', { name: 'Copied' })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain('Answer 1: the **Book a consultation** button is pushed to the right by `transform: translateX(38px)`.');
  expect(copied).toContain('- Remove the transform\n- Or set it to `none`');
  expect(copied).toContain(`\`\`\`css\n${ANSWER_CODE}\n\`\`\``);
  expect(copied).toContain('[MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/transform)');
  // An answer never hides by itself.
  await page.waitForTimeout(6500);
  await expect(card).toBeVisible();
  // Resized by its corner, with the keyboard.
  const before = await card.boundingBox();
  await card.getByRole('button', { name: 'Resize the answer' }).focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowUp');
  const after = await card.boundingBox();
  expect(Math.round(after.width - before.width)).toBe(24);
  expect(Math.round(after.height - before.height)).toBe(24);

  // A second screenshot to the same Claude tab: the answer read is the new one.
  const second = await capture([300, 120], [620, 320]);
  await second.getByLabel('Message').fill('And on mobile?');
  await second.getByRole('button', { name: 'Send to Claude' }).click();
  await expect(second.locator('.a-status')).toHaveText('Claude answered', { timeout: 30000 });
  await expect(second.locator('.a-body p').first()).toContainText('Answer 2:');
  expect(ai.state.sent).toHaveLength(2);
  expect(context.pages().filter((p) => p.url().startsWith(aiClaude))).toHaveLength(1);
  // The first answer is still in the stack, behind.
  await second.getByRole('button', { name: 'Previous capture' }).click();
  await expect(card.locator('.a-body p').first()).toContainText('Answer 1:');

  // Put away with Esc, the answers can be brought back from the popup.
  await page.keyboard.press('Escape');
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/src/popup.html?tabId=${tabId}`);
  await popup.getByRole('button', { name: 'Show 2 captures on this page' }).click();
  await popup.close();
  await page.bringToFront();
  await expect(card.locator('.a-status')).toHaveText('Claude answered');
  // Continue in Claude brings its tab to the front; Close removes the answer.
  await card.getByRole('button', { name: 'Continue in Claude' }).click();
  await expect.poll(activeTab).toMatch(/\/claude\/chat\//);
  await page.bringToFront();
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(card.locator('.count')).toBeHidden();
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
});

test('auto-send to ChatGPT: its own page, the same answer card', async () => {
  test.setTimeout(90000);
  await freshAI('ok');
  await useDefault('chatgpt');
  const card = await capture([440, 150], [760, 350]);
  await card.getByLabel('Message').fill('What is wrong here?');
  await sendNow(card, 'ChatGPT');
  await expect(card.locator('.a-status')).toHaveText('ChatGPT answered', { timeout: 30000 });
  expect(await activeTab()).toBe(`${base}/`);
  expect(ai.state.sent).toEqual([expect.objectContaining({ kind: 'chatgpt', text: 'What is wrong here?' })]);
  // ChatGPT's code block header (language, Copy code) is not part of the code.
  await expect(card.locator('.a-body pre code')).toHaveText(ANSWER_CODE);
  await expect(card.locator('.a-body')).not.toContainText('Copy code');
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
});

test('auto-send failures: nothing half-done is sent, and the card says what happened and offers the tab', async () => {
  test.setTimeout(150000);
  const worker = context.serviceWorkers()[0];
  await useDefault('claude');
  const cases = [
    ['upload-fail', 'The screenshot did not upload to Claude, so nothing was sent. See the Claude tab.', 'answer-failed-upload.png'],
    ['nosend', 'Pasted into Claude. Its send button was not found; press Enter there.', null],
    ['notext', 'Claude took the screenshot but not your message, so nothing was sent. Finish it in the Claude tab.', null],
    ['busy', 'Claude is still answering in its tab, so nothing was sent. Send again when it finishes.', 'answer-failed-busy.png'],
  ];
  for (const [mode, text, shot] of cases) {
    await freshAI(mode);
    await worker.evaluate((id) => self.__shot2ai.clearStack(id), tabId);
    await page.evaluate(() => document.getElementById('shot2ai-preview-card')?.remove());
    const card = await capture([440, 150], [760, 350]);
    await card.getByLabel('Message').fill(`Case ${mode}`);
    await sendNow(card, 'Claude');
    // Back from the answer card to the preview, with the reason and the way on.
    await expect(card.locator('.result')).toContainText(text, { timeout: 45000 });
    await expect(card.locator('.answer')).toBeHidden();
    await expect(card.getByRole('button', { name: 'Open Claude tab' })).toBeVisible();
    if (mode === 'busy') await expect(card.getByRole('button', { name: 'Try again' })).toBeVisible();
    // Nothing reached the chat, the message is kept, and the page stayed in front.
    expect(ai.state.sent, mode).toEqual([]);
    await expect(card.getByLabel('Message')).toHaveValue(`Case ${mode}`);
    expect(await activeTab()).toBe(`${base}/`);
    if (shot) await answerShot(card, shot);
  }
  // Open Claude tab: the owner finishes there.
  await page.locator('#shot2ai-preview-card .card').getByRole('button', { name: 'Open Claude tab' }).click();
  await expect.poll(activeTab).toMatch(/\/claude\/new$/);
  await page.bringToFront();
  await page.keyboard.press('Escape');
});

test('answer timeout: a chat that never answers falls back to Open Claude tab', async () => {
  test.setTimeout(90000);
  await freshAI('silent');
  await useDefault('claude');
  const card = await capture([440, 150], [760, 350]);
  await card.getByLabel('Message').fill('Anyone there?');
  await sendNow(card, 'Claude');
  await expect(card.locator('.a-status')).toHaveText('Claude is answering…', { timeout: 20000 });
  // The send itself went (it cannot be taken back); only the answer is missing.
  expect(ai.state.sent).toHaveLength(1);
  await expect(card.locator('.a-status')).toHaveText('No answer from Claude yet', { timeout: 20000 });
  await expect(card.locator('.a-body')).toContainText('Claude has not answered, or something stopped it (a usage limit, a sign-in). See the Claude tab.');
  await expect(card.locator('.a-actions button.primary')).toHaveText('Open Claude tab');
  await answerShot(card, 'answer-timeout.png');
  await card.getByRole('button', { name: 'Open Claude tab' }).click();
  await expect.poll(activeTab).toMatch(/\/claude\/chat\//);
  await page.bringToFront();
  await card.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('#shot2ai-preview-card')).toHaveCount(0);
});

test('answer sanitization: script, event handlers and javascript: links arrive as inert text', async () => {
  test.setTimeout(90000);
  await freshAI('xss');
  await useDefault('claude');
  const card = await capture([440, 150], [760, 350]);
  await sendNow(card, 'Claude');
  await expect(card.locator('.a-status')).toHaveText('Claude answered', { timeout: 30000 });
  const body = card.locator('.a-body');
  // Markup written as text shows as those characters.
  await expect(body).toContainText('Here is <script>alert(1)</script> as text.');
  await expect(body).toContainText('An image that fails.');
  await expect(body).toContainText('Hover text');
  // No element or attribute from the chat's page survives.
  const found = await page.evaluate(() => {
    const root = document.getElementById('shot2ai-preview-card').shadowRoot.querySelector('.a-body');
    const attributes = [...root.querySelectorAll('*')].flatMap((el) => [...el.attributes].map((a) => a.name));
    return { tags: [...new Set([...root.querySelectorAll('*')].map((el) => el.tagName.toLowerCase()))].sort(), attributes: [...new Set(attributes)].sort(), hrefs: [...root.querySelectorAll('a')].map((a) => a.getAttribute('href')) };
  });
  expect(found.tags.filter((t) => ['script', 'img', 'svg', 'iframe', 'style'].includes(t))).toEqual([]);
  expect(found.attributes.filter((a) => a.startsWith('on') || a === 'style' || a === 'src')).toEqual([]);
  expect(found.hrefs).toEqual(['https://example.com/']);
  await expect(body.getByRole('link', { name: 'a javascript: link' })).toHaveCount(0);
  await expect(body).toContainText('a javascript: link and a real one');
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await body.getByText('Hover text').hover();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  await answerShot(card, 'answer-sanitized.png');
  await card.getByRole('button', { name: 'Close', exact: true }).click();
});
