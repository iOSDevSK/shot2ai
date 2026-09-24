import { test, expect, chromium } from '@playwright/test';
import { mkdtempSync, cpSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { issueAuthorization } from '../share-server/auth.mjs';

for (const delayMinutes of [0, 3, 5]) test(`Chrome external handshake after ${delayMinutes} minutes returns to Share and reuses the credential`, async () => {
  const dir = mkdtempSync(join(tmpdir(), 'shot2ai-auth-browser-')), source = process.env.SHOT2AI_EXT || resolve('.');
  const copy = join(dir, 'extension');
  for (const file of ['manifest.json', 'src', 'icons', 'licenses']) cpSync(join(source, file), join(copy, file), { recursive: true });
  const context = await chromium.launchPersistentContext(join(dir, 'profile'), { channel: 'chromium', headless: true, args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] });
  const origin = 'https://share.shot2ai.com', authorization = issueAuthorization('synthetic-browser-handshake-test-secret', Date.now() + 2000);
  let verifications = 0, tokenRequests = 0;
  // Only provider/network boundaries are fixtures: real Chrome externally_connectable,
  // trusted sender URL, nonce/tab checks, storage and extension callback are exercised.
  await context.route(origin + '/connect?**', route => { verifications++; return route.fulfill({ contentType: 'text/html', body: readFileSync('share-server/connect.html', 'utf8') }); });
  await context.route(origin + '/connect.js', route => route.fulfill({ contentType: 'text/javascript', body: readFileSync('share-server/connect.js', 'utf8') }));
  await context.route(origin + '/style.css', route => route.fulfill({ contentType: 'text/css', body: '' }));
  await context.route(origin + '/api/sharing-config', route => route.fulfill({ json: { sitekey: 'test-provider-sitekey' } }));
  await context.route('https://challenges.cloudflare.com/**', route => route.fulfill({ contentType: 'text/javascript', body: 'window.turnstile = { render: (node, options) => { window.finishChallenge = () => options.callback("synthetic-provider-token"); } };' }));
  await context.route(origin + '/api/authorize', route => { tokenRequests++; expect(route.request().postDataJSON()).toEqual({ turnstileToken: 'synthetic-provider-token' }); return route.fulfill({ json: authorization }); });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    const home = await context.newPage(); await home.goto(`chrome-extension://${new URL(worker.url()).hostname}/src/options.html`);
    // Exercise real extension page → trusted site → background external callback.
    await home.evaluate(() => {
      window.authorizationResult = import('./share-auth.js').then(m => m.authorizeSharing()).then(token => ({ token }), error => ({ error: error.message }));
    });
    await expect.poll(() => context.pages().find(p => p.url().startsWith(origin + '/connect'))?.url()).toBeTruthy();
    const verification = context.pages().find(p => p.url().startsWith(origin + '/connect'));
    await verification.waitForFunction(() => typeof window.finishChallenge === 'function');
    // Move clocks, not timers: exercise the same polling/expiry branches without
    // spending minutes waiting. Turnstile itself is a provider fixture only.
    for (const realm of [home, worker]) await realm.evaluate(minutes => {
      const realNow = Date.now; Date.now = () => realNow() + minutes * 60_000;
    }, delayMinutes);
    if (delayMinutes > 4) {
      expect((await home.evaluate(() => window.authorizationResult)).error).toContain('Verification is still pending');
      expect(await home.evaluate(async () => !!(await chrome.storage.local.get('shareAuthorizationPending')).shareAuthorizationPending)).toBe(true);
    }
    await verification.evaluate(() => { window.finishChallenge(); });
    await expect.poll(() => home.evaluate(async () => !!(await chrome.storage.local.get('shareAuthorization')).shareAuthorization)).toBe(true);
    const first = delayMinutes > 4
      ? await home.evaluate(async () => (await import('./share-auth.js')).authorizeSharing())
      : (await home.evaluate(() => window.authorizationResult)).token;
    expect(first).toBe(authorization.token);
    expect(await home.evaluate(async () => (await import('./share-auth.js')).authorizeSharing())).toBe(first);
    expect(verifications).toBe(1); expect(tokenRequests).toBe(1);
    await expect.poll(() => context.pages().filter(p => p.url().startsWith(origin + '/connect')).length).toBe(0);
  } finally { await context.close(); }
});
