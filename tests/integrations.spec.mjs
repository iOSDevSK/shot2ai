import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateRegistry, matchesScope, registry, approvedIntegration, syncIntegrations } from '../src/integrations.js';
const bundled = JSON.parse(readFileSync(new URL('../src/integration-registry.json', import.meta.url)));
const entry = bundled.integrations[0];
let storage, allowed, tabURL, scripts, fetches, fetchImpl;
test.beforeEach(() => {
  storage = { websiteIntegrations: true, integrationRegistry: { at: Date.now(), value: structuredClone(bundled) } }; allowed = true; tabURL = 'https://agentmods.dev/plugins/owner/repo/mod'; scripts = []; fetches = [];
  globalThis.chrome = {
    storage: { local: { get: async key => ({ [key]: storage[key] }), set: async value => Object.assign(storage, value) } },
    permissions: { contains: async () => allowed }, tabs: { get: async id => ({ id, url: tabURL }) },
    runtime: { getURL: path => `chrome-extension://test/${path}` },
    scripting: { getRegisteredContentScripts: async () => scripts, registerContentScripts: async value => { if (scripts.length) throw new Error('duplicate'); scripts.push(...value); }, unregisterContentScripts: async () => { scripts = []; } },
  };
  fetchImpl = globalThis.fetch;
});
test.afterEach(() => { delete globalThis.chrome; globalThis.fetch = fetchImpl; });

test('registry generator assigns deterministic URL tags and validates the bundled registry', async () => {
  expect(await validateRegistry(bundled)).toEqual(bundled);
  expect(execFileSync('python3', ['scripts/integrations.py', '--check'], { encoding: 'utf8' })).toContain(entry.tag);
  const out = execFileSync('python3', ['-c', `from scripts.integrations import registration\na=registration({'url':'https://Agentmods.dev', 'prompt':'one'})\nb=registration({'url':'https://agentmods.dev/', 'prompt':'two'})\nassert a['tag']==b['tag']\nfor url in ['http://example.com', 'https://user:password@example.com/', 'https://127.0.0.2/', 'https://example.com/a/../b', 'https://example.com/?x=1', 'https://example.com/ž']:\n try: registration({'url':url, 'prompt':'test'})\n except ValueError: pass\n else: raise AssertionError(url)\nprint(a['tag'])`], { encoding: 'utf8' });
  expect(out.trim()).toBe(entry.tag);
});
test('registry rejects page-supplied code, wrong tags, duplicates, empty prompts and unsafe scopes', async () => {
  for (const change of [{ tag: 's2ai-0000000000000000' }, { url: 'http://agentmods.dev/' }, { prompt: '' }, { script: 'alert(1)' }, { url: 'https://127.0.0.2/' }]) await expect(validateRegistry({ schemaVersion: 1, integrations: [{ ...entry, ...change }] })).rejects.toThrow();
  await expect(validateRegistry({ schemaVersion: 1, integrations: [entry, entry] })).rejects.toThrow();
});
test('scopes refuse lookalike domains, credentials, sibling paths and encoded traversal', () => {
  const scope = 'https://example.com/mods/';
  for (const url of ['https://example.com/mods', 'https://example.com/mods/a?x=1#anchor']) expect(matchesScope(scope, url)).toBe(true);
  for (const url of ['https://example.com/mods-other/a', 'https://example.com.evil.com/mods/a', 'https://evil.com/mods/a', 'https://example.com/mods/%2f../other', 'https://example.com/mods/../private', 'https://secret@example.com/mods/', 'http://example.com/mods/a']) expect(matchesScope(scope, url)).toBe(false);
});
test('approved click requires opt-in, permission, main frame and both live source and target in scope', async () => {
  const sender = { tab: { id: 42 }, frameId: 0, url: tabURL };
  const message = { tag: entry.tag, url: tabURL, prompt: 'Ignored untrusted override' };
  expect((await approvedIntegration(message, sender)).entry.prompt).toBe(entry.prompt);
  for (const next of [{ ...sender, frameId: 1 }, { ...sender, url: 'https://evil.com/' }]) expect(await approvedIntegration(message, next)).toBeNull();
  expect(await approvedIntegration({ ...message, url: 'https://evil.com' }, sender)).toBeNull();
  expect(await approvedIntegration({ ...message, tag: 's2ai-0000000000000000' }, sender)).toBeNull();
  storage.websiteIntegrations = false; expect(await approvedIntegration(message, sender)).toBeNull();
  storage.websiteIntegrations = true; allowed = false; expect(await approvedIntegration(message, sender)).toBeNull();
  allowed = true; tabURL = 'https://agentmods.dev/other'; expect(await approvedIntegration(message, sender)).toBeNull();
});
test('registry uses a fresh cache, falls back safely offline, and replaces stale cache with reviewed updates', async () => {
  globalThis.fetch = async url => { fetches.push(url); throw new Error('offline'); };
  expect(await registry()).toEqual(bundled); expect(fetches).toHaveLength(0);
  storage.integrationRegistry.at = 0; expect(await registry()).toEqual(bundled); expect(fetches).toHaveLength(1);
  const changed = structuredClone(bundled); changed.integrations[0].prompt = 'Updated approved prompt'; storage.integrationRegistry.at = 0;
  globalThis.fetch = async () => new Response(JSON.stringify(changed)); expect(await registry()).toEqual(changed);
  storage.integrationRegistry = null;
  globalThis.fetch = async url => url.startsWith('chrome-extension:') ? new Response(JSON.stringify(bundled)) : new Response('{"invalid":true}');
  expect(await registry()).toEqual(bundled);
});
test('integration registration is serialized and removed when disabled or permission is revoked', async () => {
  await Promise.all([syncIntegrations(), syncIntegrations(), syncIntegrations()]); expect(scripts).toHaveLength(1);
  storage.websiteIntegrations = false; await syncIntegrations(); expect(scripts).toHaveLength(0);
  storage.websiteIntegrations = true; allowed = false; await syncIntegrations(); expect(storage.websiteIntegrations).toBe(false);
});

test('website marker keeps install fallback, enhances reviewed tags, refuses synthetic clicks and observes new buttons', async ({ page }) => {
  await page.setContent(`<a href="https://github.com/iOSDevSK/shot2ai#install" data-shot2ai="${entry.tag}" data-shot2ai-url="https://agentmods.dev/mod"><span data-shot2ai-install>Get Shot2AI</span><span data-shot2ai-ready hidden>Explain with Shot2AI</span></a>`);
  await expect(page.getByText('Get Shot2AI')).toBeVisible();
  await page.evaluate(() => { window.messages = []; window.chrome = { runtime: { sendMessage: async m => { window.messages.push(m); return { ok: true }; } }, storage: { onChanged: { addListener(fn) { window.settingsChange = fn; } } } }; });
  await page.addScriptTag({ path: 'src/integration-content.js' });
  await expect(page.getByText('Explain with Shot2AI')).toBeVisible();
  await page.locator('a').evaluate(el => el.click()); expect(await page.evaluate(() => window.messages.filter(m => m.type === 'integration-open'))).toHaveLength(0);
  await page.getByText('Explain with Shot2AI').click(); expect(await page.evaluate(() => window.messages.filter(m => m.type === 'integration-open'))).toHaveLength(1);
  await page.locator('a').evaluate(el => { const next = el.cloneNode(true); next.dataset.shot2aiUrl = 'https://agentmods.dev/another'; el.after(next); });
  await expect.poll(async () => page.evaluate(() => window.messages.filter(m => m.type === 'integration-check').length)).toBe(2);
  await page.evaluate(() => window.settingsChange({ websiteIntegrations: { newValue: false } }));
  await expect(page.locator('[data-shot2ai-install]:visible')).toHaveCount(2);
});

test('Agentmods install hook fits narrow and wide screens without an extension', async ({ page }) => {
  const html = readFileSync(new URL('./fixtures/agentmods-hook.html', import.meta.url), 'utf8');
  await page.setContent(html);
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.getByText('Get Shot2AI — it’s free')).toBeVisible();
    const button = page.locator('[data-shot2ai]');
    await expect(button).toHaveAttribute('href', 'https://github.com/iOSDevSK/shot2ai#install');
    const box = await button.boundingBox(); expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});
