import { issueAuthorization } from '../share-server/auth.mjs';
import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, cpSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { icons } from '../src/icons.js';
import { startServer } from '../share-server/server.mjs';
import { once } from 'node:events';

let context, home, extensionId, server, publicOrigin;
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const turns = [
  { asked: 'Prvá otázka 👋', answer: { state: 'done', name: 'ChatGPT', blocks: [{ t: 'p', c: ['First answer with čšťžýáíé.'] }], sources: [{ title: 'Evidence', href: 'https://example.com/evidence' }] } },
  { asked: 'Follow-up?', answer: { state: 'done', name: 'ChatGPT', blocks: [{ t: 'p', c: ['Last exchange — úplná história.'] }, { t: 'pre', text: '<script>window.unsafe = true</script>' }], sources: [] } },
];
test.beforeAll(async () => {
  server = startServer({ port: 0, directory: mkdtempSync(join(tmpdir(), 'shot2ai-public-data-')) });
  await once(server, 'listening'); publicOrigin = `http://127.0.0.1:${server.address().port}`;
  const source = process.env.SHOT2AI_EXT || resolve('.');
  const copy = mkdtempSync(join(tmpdir(), 'shot2ai-share-src-')); cpSync(source, copy, { recursive: true, filter: p => !/(?:node_modules|\.git|dist|screenshots|test-results)(?:\/|$)/.test(p) });
  writeFileSync(join(copy, 'src/share-config.js'), `export const SHARE_ORIGIN = ${JSON.stringify(publicOrigin)};\n`);
  const manifest = JSON.parse(readFileSync(join(copy, 'manifest.json'))); manifest.host_permissions = ['<all_urls>']; writeFileSync(join(copy, 'manifest.json'), JSON.stringify(manifest));
  context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'shot2ai-share-profile-')), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] });
  let worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker'); extensionId = new URL(worker.url()).hostname;
  await context.addInitScript(() => { window.print = () => { window.printCalls = (window.printCalls || 0) + 1; }; });
  home = await context.newPage(); await home.goto(`chrome-extension://${extensionId}/src/options.html`);
  await home.evaluate(value => chrome.storage.local.set({ shareAuthorization: value }), { ...issueAuthorization('local-browser-test-only-secret-value'), origin: publicOrigin });
});
test.afterAll(async () => { await context?.close(); await new Promise(resolve => server.close(resolve)); });

async function exportPage(format, patch = {}) {
  const id = await home.evaluate(async ({ png, turns, patch }) => {
    const { putExport } = await import('./share-store.js');
    return putExport({ kind: 'pasted', png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }), url: 'https://example.com/article',
      history: turns.slice(0, -1), asked: turns.at(-1).asked, answer: turns.at(-1).answer, chatDraft: 'PRIVATE UNSENT DRAFT', ...patch });
  }, { png, turns, patch });
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/share.html?id=${id}&format=${format}`);
  return page;
}

test('Share menu replaces the duplicate Close, supports keys and older icon payloads', async ({ page }) => {
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.messages = [];
    window.chrome = { runtime: { onMessage: { addListener() {} }, sendMessage: async m => { window.messages.push(m); return { ok: true }; } } };
    const attach = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return attach.call(this, { ...o, mode: 'open' }); };
  });
  await page.addScriptTag({ path: resolve('src/card.js') });
  await page.evaluate(({ icons, png, turns }) => {
    delete icons.share;
    const main = { id: 'chatgpt', name: 'ChatGPT', kind: 'chat', label: 'Send to ChatGPT' };
    window.__shot2aiStack({ icons, main, destinations: [main], prompts: [], acknowledged: {}, keys: {}, entries: [{ id: 'one', thumb: png, asked: turns[0].asked, answer: turns[0].answer }] });
  }, { icons, png, turns });
  const card = page.locator('#shot2ai-preview-card');
  await expect(card.getByRole('button', { name: 'Close', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Close this capture' })).toBeVisible();
  const share = card.getByRole('button', { name: 'Share conversation', exact: true });
  await expect(share.locator('svg')).toBeVisible(); await expect(card).not.toContainText('undefined');
  await share.click();
  await expect(card.getByRole('button', { name: 'Share on WhatsApp' })).toBeFocused();
  await page.keyboard.press('End'); await expect(card.getByRole('button', { name: 'Download Markdown' })).toBeFocused();
  await page.keyboard.press('Escape'); await expect(share).toBeFocused(); await expect(card.locator('.card')).toBeVisible();
  for (const [label, format] of [['Share on WhatsApp', 'whatsapp'], ['Share on Facebook', 'facebook'], ['Share on X', 'x'], ['Export PDF', 'pdf'], ['Download Markdown', 'md']]) {
    await share.click(); await card.getByRole('button', { name: label, exact: true }).click();
    expect(await page.evaluate(() => window.messages.at(-1))).toEqual({ type: 'share-conversation', id: 'one', format });
  }
  await page.setViewportSize({ width: 390, height: 844 }); await share.click();
  const box = await card.locator('.share-menu').boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(390);
  mkdirSync(process.env.SHOT2AI_SHOTS || '/tmp/shot2ai-share-shots', { recursive: true });
  await page.screenshot({ path: join(process.env.SHOT2AI_SHOTS || '/tmp/shot2ai-share-shots', 'share-menu.png') });
});

test('PDF preview includes screenshot, all exchanges and sources without executing markup; real PDF paginates', async () => {
  const longAnswer = { ...turns[1].answer, blocks: [...turns[1].answer.blocks, ...Array.from({ length: 45 }, (_, i) => ({ t: 'p', c: [`Paragraph ${i}: Slovenská odpoveď s kompletným textom, ktorý sa nesmie skrátiť.`] }))] };
  const page = await exportPage('pdf', { answer: longAnswer });
  await expect(page.locator('#conversation')).toContainText('Prvá otázka 👋'); await expect(page.locator('#conversation')).toContainText('Paragraph 44:');
  await expect(page.locator('img')).toHaveJSProperty('naturalWidth', 1);
  await expect(page.locator('#conversation')).not.toContainText('PRIVATE UNSENT DRAFT');
  expect(await page.evaluate(() => window.unsafe)).toBeUndefined(); expect(await page.evaluate(() => window.printCalls)).toBe(1);
  const pdf = await page.pdf({ preferCSSPageSize: true });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF'); expect(pdf.toString('latin1')).toContain('/Subtype /Image');
  expect(Math.max(...[...pdf.toString('latin1').matchAll(/\/Count (\d+)/g)].map(m => Number(m[1])))).toBeGreaterThan(1);
  await page.close();
});

test('Markdown includes full history, exact original PNG bytes, links and Unicode', async () => {
  const page = await exportPage('md');
  await expect(page.locator('#status')).toContainText('Markdown downloaded');
  const pending = page.waitForEvent('download'); await page.locator('#primary').click(); const download = await pending;
  const text = readFileSync(await download.path(), 'utf8');
  expect(download.suggestedFilename()).toMatch(/\.md$/);
  expect(text).toContain(`data:image/png;base64,${png}`); expect(text).toContain('Prvá otázka 👋'); expect(text).toContain('Last exchange — úplná história.'); expect(text).toContain('https://example.com/evidence'); expect(text).not.toContain('PRIVATE UNSENT DRAFT');
  await page.close();
});

test('text-only exports contain selected text without inventing an image; missing exports are actionable', async () => {
  const page = await exportPage('pdf', { kind: 'text', selectedText: 'Selected čisto text', png: null });
  await expect(page.locator('.selection')).toHaveText('Selected čisto text'); await expect(page.locator('img')).toHaveCount(0); await page.close();
  const missing = await context.newPage(); await missing.goto(`chrome-extension://${extensionId}/src/share.html?id=missing&format=pdf`);
  await expect(missing.locator('#help')).toContainText('expired or was cleared'); expect(await missing.evaluate(() => window.printCalls || 0)).toBe(0); await missing.close();
});

test('public sharing uploads the exact image and full history once, with crawler-readable metadata and no drafts', async () => {
  const result = await home.evaluate(async ({ png, turns }) => {
    const { publishCapture } = await import('./public-share.js');
    const capture = { kind: 'pasted', png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }), url: 'https://example.com/article',
      history: turns.slice(0, -1), asked: turns.at(-1).asked, answer: { ...turns.at(-1).answer, url: 'https://chatgpt.com/c/PRIVATE_CHAT', privateField: 'PRIVATE ANSWER FIELD' }, chatDraft: 'PRIVATE UNSENT DRAFT' };
    const [first, second] = await Promise.all([publishCapture(capture), publishCapture(capture)]);
    const repeated = await publishCapture(capture);
    return { first, second, repeated };
  }, { png, turns });
  expect(result.first.url).toBe(result.second.url); expect(result.first.url).toBe(result.repeated.url);
  expect(result.first.url).toMatch(new RegExp(`^${publicOrigin}/s/[A-Za-z0-9_-]{32}$`));
  const page = await context.newPage(); await page.goto(result.first.url);
  await expect(page.locator('main')).toContainText('Prvá otázka 👋'); await expect(page.locator('main')).toContainText('Last exchange — úplná história.');
  await expect(page.locator('main')).toContainText('<script>window.unsafe = true</script>'); expect(await page.evaluate(() => window.unsafe)).toBeUndefined();
  const html = await (await fetch(result.first.url)).text();
  expect(html).not.toContain('PRIVATE'); expect(html).not.toContain(result.first.deleteToken);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', result.first.url);
  const image = await page.locator('meta[property="og:image"]').getAttribute('content');
  expect(image).toBe(result.first.url + '/preview.png');
  const preview = Buffer.from(await (await fetch(image)).arrayBuffer());
  expect(preview.readUInt32BE(16)).toBe(1200); expect(preview.readUInt32BE(20)).toBe(630);
  writeFileSync(join(process.env.SHOT2AI_SHOTS || '/tmp/shot2ai-share-shots', 'social-preview.png'), preview);
  expect(Buffer.from(await (await fetch(result.first.url + '/image.png')).arrayBuffer()).toString('base64')).toBe(png);
  await expect(page.locator('.capture')).toHaveJSProperty('naturalWidth', 1);
  await expect(page.getByRole('link', { name: 'Evidence', exact: true })).toHaveAttribute('href', 'https://example.com/evidence');
  const headers = (await fetch(result.first.url)).headers; expect(headers.get('x-robots-tag')).toContain('noindex');
  await page.close();
});

for (const format of ['facebook', 'x', 'whatsapp']) test(`one card action opens ${format} with a public link, without clipboard or export preview`, async () => {
  await home.evaluate(async ({ png, turns }) => {
    const { putCapture } = await import('./captures.js'); const tab = await chrome.tabs.getCurrent();
    await putCapture('public-social', { tabId: tab.id, kind: 'pasted', png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }), history: turns.slice(0, -1), asked: turns.at(-1).asked, answer: turns.at(-1).answer });
  }, { png, turns });
  // Intercept only the final third-party composer. Upload, persisted link, and
  // the public page/image are real HTTP. Never submit a real social post.
  const pattern = format === 'facebook' ? 'https://www.facebook.com/sharer/**' : 'https://x.com/intent/**';
  if (format !== 'whatsapp') await context.route(pattern, route => route.fulfill({ contentType: 'text/html', body: '<h1>Social composer boundary</h1>' }));
  const opened = context.waitForEvent('page');
  const result = await home.evaluate(async format => chrome.runtime.sendMessage({ type: 'share-conversation', id: 'public-social', format }), format);
  expect(result.ok).toBe(true); expect((await fetch(result.url)).status).toBe(200);
  const page = await opened; await page.waitForLoadState('domcontentloaded');
  const actual = new URL(page.url());
  if (format === 'whatsapp') {
    expect(actual.pathname).toBe('/src/share-launch.html');
    await expect(page.locator('#native')).toHaveAttribute('href', `whatsapp://send?text=${encodeURIComponent(result.url)}`);
    await expect(page.locator('#web')).toHaveAttribute('href', `https://web.whatsapp.com/send?text=${encodeURIComponent(result.url)}`);
    await expect(page.locator('#status')).toContainText('Choose a recipient');
  } else {
    expect(actual.pathname).toBe(format === 'facebook' ? '/sharer/sharer.php' : '/intent/post');
    expect(actual.searchParams.get(format === 'facebook' ? 'u' : 'url')).toBe(result.url);
    await context.unroute(pattern);
  }
  expect(page.url()).not.toContain('/share.html'); await page.close();
});

test('network failure reports no success and opens no empty social tab', async () => {
  const result = await home.evaluate(async () => {
    const { shareConversation } = await import('./share.js'); const { putCapture } = await import('./captures.js');
    const tab = await chrome.tabs.getCurrent(); await putCapture('failed-public', { tabId: tab.id, kind: 'text', selectedText: 'Network failure test', asked: 'Explain', answer: { state: 'done', blocks: [{ t: 'p', c: ['A new answer.'] }] } });
    const before = (await chrome.tabs.query({})).length, original = window.fetch;
    window.fetch = async () => { throw new TypeError('network unavailable'); };
    try { return { result: await shareConversation({ id: 'failed-public', format: 'facebook' }, { tab }), before, after: (await chrome.tabs.query({})).length }; }
    finally { window.fetch = original; }
  });
  expect(result.result.ok).toBe(false); expect(result.result.text).toContain('could not be reached'); expect(result.after).toBe(result.before);
});

test('real extension card click publishes and opens a prefilled Facebook composer in one action', async () => {
  await context.route('https://shot2ai-fixture.example/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Screenshot source</h1>' }));
  await context.route('https://www.facebook.com/sharer/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Facebook composer boundary</h1>' }));
  const source = await context.newPage(); await source.goto('https://shot2ai-fixture.example/');
  await home.evaluate(async ({ icons, png, turns }) => {
    const [tab] = await chrome.tabs.query({ url: 'https://shot2ai-fixture.example/*' });
    const { putCapture } = await import('./captures.js');
    await putCapture('real-card-share', { tabId: tab.id, kind: 'pasted', png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }), asked: turns[0].asked, answer: turns[0].answer });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => {
      const original = Element.prototype.attachShadow; Element.prototype.attachShadow = function (o) { return original.call(this, { ...o, mode: 'open' }); };
    } });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/card.js'] });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: ({ icons, png, turn }) => {
      const main = { id: 'chatgpt', name: 'ChatGPT', kind: 'chat', label: 'Send to ChatGPT' };
      window.__shot2aiStack({ icons, main, destinations: [main], prompts: [], acknowledged: {}, keys: {}, entries: [{ id: 'real-card-share', thumb: png, ...turn }] });
    }, args: [{ icons, png, turn: turns[0] }] });
  }, { icons, png, turns });
  await source.getByRole('button', { name: 'Share conversation', exact: true }).click();
  const opened = context.waitForEvent('page');
  await source.getByRole('button', { name: 'Share on Facebook', exact: true }).click();
  const composer = await opened; await composer.waitForLoadState('domcontentloaded');
  const target = new URL(composer.url()); expect(target.pathname).toBe('/sharer/sharer.php');
  const url = target.searchParams.get('u'); expect(url).toContain(publicOrigin + '/s/');
  const recipient = await context.newPage(); await recipient.goto(url);
  await expect(recipient.locator('main')).toContainText(turns[0].asked); await expect(recipient.locator('.capture')).toHaveJSProperty('naturalWidth', 1);
  await expect(source.locator('#shot2ai-preview-card .share-menu')).toBeHidden();
  await recipient.close(); await composer.close(); await source.close();
  await context.unroute('https://shot2ai-fixture.example/**'); await context.unroute('https://www.facebook.com/sharer/**');
});

test('shared-link management revokes both the public page and image', async () => {
  await home.evaluate(async () => {
    const { publishCapture } = await import('./public-share.js');
    await publishCapture({ kind: 'text', selectedText: 'Revocation test', asked: 'Explain deletion', answer: { state: 'done', blocks: [{ t: 'p', c: ['Delete this public copy.'] }] } });
  });
  const page = await context.newPage(); await page.goto(`chrome-extension://${extensionId}/src/shared-links.html`);
  const section = page.locator('#links section').first(); await expect(section).toBeVisible();
  const url = await section.locator('a').getAttribute('href');
  await section.getByRole('button', { name: 'Delete shared link' }).click();
  await expect(page.locator('#status')).toHaveText('Shared link deleted.');
  expect((await fetch(url)).status).toBe(404); expect((await fetch(`${url}/image.png`)).status).toBe(404);
  await page.close();
});

test('share service snapshots the right capture and rejects another tab or format', async () => {
  const values = await home.evaluate(async ({ png, turns }) => {
    const { putCapture } = await import('./captures.js'); const { shareConversation } = await import('./share.js');
    const tab = await chrome.tabs.getCurrent(); await putCapture('service-test', { tabId: tab.id, png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }), asked: turns[0].asked, answer: turns[0].answer });
    return [await shareConversation({ id: 'service-test', format: 'pdf' }, { tab: { id: tab.id + 1 } }), await shareConversation({ id: 'service-test', format: 'bad' }, { tab })];
  }, { png, turns });
  expect(values.every(v => v.ok === false)).toBe(true);
  const next = context.waitForEvent('page');
  expect(await home.evaluate(async () => chrome.runtime.sendMessage({ type: 'share-conversation', id: 'service-test', format: 'pdf' }))).toMatchObject({ ok: true });
  const preview = await next; await expect(preview.locator('#conversation')).toContainText('Prvá otázka 👋'); await preview.close();
});

test('capture storage opens newer schema 3 without downgrade or data loss', async () => {
  const result = await home.evaluate(async () => {
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('shot2ai-captures', 3);
      req.onsuccess = () => { req.result.close(); resolve(); }; req.onerror = () => reject(req.error);
    });
    const { putCapture, getCapture, updateCapture } = await import('./captures.js');
    await putCapture('schema-regression', { selectedText: 'Must survive', history: [{ asked: 'Old question' }] });
    await updateCapture('schema-regression', { chatDraft: 'My draft' });
    return getCapture('schema-regression');
  });
  expect(result.selectedText).toBe('Must survive'); expect(result.chatDraft).toBe('My draft'); expect(result.history).toEqual([{ asked: 'Old question' }]);
});

test('export snapshots expire without deleting captures; Clear all also removes unexpired export snapshots', async () => {
  const result = await home.evaluate(async () => {
    const { putExport, getExport } = await import('./share-store.js');
    const { getCapture } = await import('./captures.js');
    const capture = { asked: 'Export', answer: { state: 'done', name: 'ChatGPT', blocks: [] } };
    const expired = await putExport(capture), kept = await putExport(capture);
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('shot2ai-exports', 1);
      req.onsuccess = () => { const db = req.result, tx = db.transaction('exports', 'readwrite'), s = tx.objectStore('exports'), r = s.get(expired);
        r.onsuccess = () => s.put({ ...r.result, expires: 0 }, expired); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    });
    return { expired: await getExport(expired), kept, alive: !!await getExport(kept), captureAlive: !!await getCapture('service-test') };
  });
  expect(result.expired).toBeUndefined(); expect(result.alive).toBe(true); expect(result.captureAlive).toBe(true);
  await home.locator('#clear-all').click(); await Promise.all([home.waitForEvent('framenavigated'), home.locator('#clear-yes').click()]); await home.waitForLoadState();
  await expect.poll(() => home.evaluate(async id => { const { getExport } = await import('./share-store.js'); return !!await getExport(id); }, result.kept)).toBe(false);
});

test('legacy schema 1 is upgraded with its captures preserved and save-folder handles available', async () => {
  const value = await home.evaluate(async () => {
    await new Promise(resolve => { const req = indexedDB.deleteDatabase('shot2ai-captures'); req.onsuccess = () => resolve(); });
    await new Promise((resolve, reject) => {
      const req = indexedDB.open('shot2ai-captures', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('captures').put({ selectedText: 'Legacy data' }, 'legacy');
      req.onsuccess = () => { req.result.close(); resolve(); }; req.onerror = () => reject(req.error);
    });
    const { getCapture, putHandle, getHandle } = await import('./captures.js');
    const capture = await getCapture('legacy'); await putHandle('folder-test', { name: 'Saved folder' });
    return { capture, handle: await getHandle('folder-test') };
  });
  expect(value.capture.selectedText).toBe('Legacy data'); expect(value.handle.name).toBe('Saved folder');
});
