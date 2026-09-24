// Opt-in real Turnstile render check. Never clicks or solves a human challenge.
import { chromium } from '@playwright/test';
import { mkdtempSync, cpSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
const dir = mkdtempSync(join(tmpdir(), 'shot2ai-live-verification-')), copy = join(dir, 'extension');
for (const file of ['manifest.json', 'src', 'icons', 'licenses']) cpSync(resolve(file), join(copy, file), { recursive: true });
const context = await chromium.launchPersistentContext(join(dir, 'profile'), { channel: 'chromium', headless: false, args: [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] });
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const home = await context.newPage(); await home.goto(`chrome-extension://${new URL(worker.url()).hostname}/src/options.html`);
  const opened = context.waitForEvent('page');
  const result = home.evaluate(async () => { try { await (await import('./share-auth.js')).authorizeSharing(); return 'verified'; } catch { return 'not verified'; } }).catch(() => 'closed');
  const verify = await opened; const errors = [];
  verify.on('console', message => { if (message.type() === 'error') errors.push(message.text().slice(0, 300)); });
  await new Promise(r => setTimeout(r, 10_000));
  const verified = await home.evaluate(async () => Boolean((await chrome.storage.local.get('shareAuthorization')).shareAuthorization));
  console.log(JSON.stringify({ verified, errors }));
  if (!verify.isClosed()) { console.log(await verify.locator('#status').innerText().catch(() => 'No verification status')); await verify.screenshot({ path: '/tmp/shot2ai-real-turnstile.png' }); }
} finally { await context.close(); }
