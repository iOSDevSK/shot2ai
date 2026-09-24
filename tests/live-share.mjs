import { issueAuthorization } from '../share-server/auth.mjs';
// Opt-in: node tests/live-share.mjs. Publishes only synthetic test content and
// deletes it in finally. No social messages/posts are submitted.
import { chromium, expect } from '@playwright/test';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'shot2ai-share-live-'));
const source = process.env.SHOT2AI_EXT || resolve('.'), copy = join(dir, 'extension');
mkdirSync(copy);
for (const file of ['manifest.json', 'src', 'icons', 'licenses']) cpSync(join(source, file), join(copy, file), { recursive: true });
const screenshotDir = process.env.SHOT2AI_SHOTS || dir; mkdirSync(screenshotDir, { recursive: true });
const args = [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`];
// Optional per-test DNS override when the local router still caches NXDOMAIN.
// Keep the real host, HTTPS certificate checks and public API; never ship this.
if (process.env.SHOT2AI_TEST_IP) args.push(`--host-resolver-rules=MAP share.shot2ai.com ${process.env.SHOT2AI_TEST_IP}`);
const context = await chromium.launchPersistentContext(join(dir, 'profile'), { channel: 'chromium', headless: true, args });
let home, record;
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  home = await context.newPage(); await home.goto(`chrome-extension://${extensionId}/src/options.html`);
  if (!process.env.SHOT2AI_ADMIN_SECRET_FILE) throw new Error('Provide a private signing-secret file for this explicitly authorized synthetic production test.');
  const authorization = issueAuthorization(JSON.parse(readFileSync(process.env.SHOT2AI_ADMIN_SECRET_FILE, 'utf8')).signing);
  await home.evaluate(value => chrome.storage.local.set({ shareAuthorization: value }), { ...authorization, origin: 'https://share.shot2ai.com' });
  const anonymous = await home.evaluate(async () => (await fetch('https://share.shot2ai.com/api/shares', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status);
  expect(anonymous).toBe(401);
  const fixture = await context.newPage();
  await fixture.setContent('<body style="font:24px system-ui;background:#eef0e9;padding:40px"><h1>Shot2AI public sharing test</h1><p>Synthetic content only. Žiadne súkromné údaje.</p></body>');
  const png = (await fixture.screenshot()).toString('base64'); await fixture.close();
  record = await home.evaluate(async png => {
    const { publishCapture } = await import('./public-share.js');
    return publishCapture({ kind: 'image', png: new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }),
      url: 'https://github.com/iOSDevSK/shot2ai',
      history: [{ asked: 'What is this test?', answer: { name: 'Test assistant', state: 'done', blocks: [{ t: 'p', c: ['A synthetic test of public sharing.'] }] } }],
      asked: 'Does it include the complete history? 👋',
      answer: { name: 'Test assistant', state: 'done', blocks: [{ t: 'p', c: ['Yes. Both exchanges and the original image are included. Čšťž.'] }], sources: [{ title: 'Shot2AI', href: 'https://github.com/iOSDevSK/shot2ai' }] }, chatDraft: 'PRIVATE_UNSENT_TEST_DRAFT' });
  }, png);
  const deniedDeletion = await home.evaluate(async url => (await fetch('https://share.shot2ai.com/api/shares/' + url.split('/').at(-1), { method: 'DELETE', headers: { Authorization: 'Bearer unrelated-token' } })).status, record.url);
  expect(deniedDeletion).toBe(403);
  const visitor = await context.newPage(); await visitor.goto(record.url);
  await expect(visitor.locator('main')).toContainText('What is this test?');
  await expect(visitor.locator('main')).toContainText('Yes. Both exchanges');
  await expect(visitor.locator('main')).not.toContainText('PRIVATE_UNSENT');
  await expect(visitor.locator('.capture')).toHaveJSProperty('naturalWidth', 1280);
  await expect(visitor.locator('meta[property="og:image"]')).toHaveAttribute('content', record.url + '/preview.png');
  const roundTrip = await home.evaluate(async url => {
    const bytes = new Uint8Array(await (await fetch(url + '/image.png')).arrayBuffer()); let value = '';
    for (let i = 0; i < bytes.length; i += 32768) value += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(value);
  }, record.url);
  expect(roundTrip).toBe(png);
  const preview = await context.request.get(record.url + '/preview.png');
  expect(preview.status()).toBe(200); const bytes = await preview.body();
  expect(bytes.readUInt32BE(16)).toBe(1200); expect(bytes.readUInt32BE(20)).toBe(630);
  writeFileSync(join(screenshotDir, 'social-preview.png'), bytes);
  await visitor.screenshot({ path: join(screenshotDir, 'public-share-desktop.png'), fullPage: true });
  await visitor.setViewportSize({ width: 390, height: 844 });
  expect(await visitor.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await visitor.screenshot({ path: join(screenshotDir, 'public-share-mobile.png'), fullPage: true });
  const policy = await context.newPage(); await policy.goto('https://share.shot2ai.com/privacy');
  await expect(policy.locator('body')).toContainText('Cloudflare Workers'); await policy.close();
  // Real social pages: inspect where they land, do not log in or submit.
  for (const format of ['facebook', 'x']) {
    const url = await home.evaluate(async ({ format, url }) => (await import('./public-share.js')).socialURL(format, url), { format, url: record.url });
    const page = await context.newPage(); let error = '';
    try { await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 }); } catch (e) { error = e.message.split('\n')[0]; }
    console.log(JSON.stringify({ platform: format, target: url, finalURL: page.url(), title: await page.title().catch(() => ''), error }));
    await page.screenshot({ path: join(screenshotDir, `live-${format}-boundary.png`) }).catch(() => {});
    await page.close();
  }
  console.log(JSON.stringify({ result: 'public page, PNG bytes, complete history, mobile layout and privacy verified', url: record.url, screenshots: screenshotDir }));
  if (process.env.SHOT2AI_KEEP_TEST_LINK === '1') {
    // Private temporary file for a separate native-app handoff check. Never print
    // or include the deletion capability in screenshots or the shared URL.
    writeFileSync(join(dir, 'cleanup.json'), JSON.stringify(record), { mode: 0o600 });
    console.log(`Synthetic link retained for native check; delete using ${join(dir, 'cleanup.json')}`);
    record = null;
  }
} finally {
  if (record && home) {
    const result = await home.evaluate(async record => {
      const { sharedLinks, deleteSharedLink } = await import('./public-share.js');
      const link = (await sharedLinks()).find(x => x.url === record.url); if (link) await deleteSharedLink(link.key);
      return { page: (await fetch(record.url)).status, image: (await fetch(record.url + '/image.png')).status, preview: (await fetch(record.url + '/preview.png')).status };
    }, record);
    expect(result).toEqual({ page: 404, image: 404, preview: 404 }); console.log('Synthetic public page and PNG deleted (404).');
  }
  await context.close();
}
