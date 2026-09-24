import { test, expect } from '@playwright/test';
import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createShareApp, RETENTION_MS, MAX_BODY } from '../share-server/app.mjs';
import { fileStorage } from '../share-server/storage.mjs';

const origin = 'https://share.example.test';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const conversation = { kind: 'text', selectedText: 'Čisto text 👋', turns: [{ asked: 'Explain', answer: { state: 'done', name: 'Claude', blocks: [{ t: 'p', c: ['Complete answer'] }] } }] };
async function setup({ maxBytes, maxPerHour } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'shot2ai-server-test-'));
  const storage = fileStorage(directory, maxBytes); let time = Date.now();
  const app = createShareApp({ storage, origin, now: () => time, maxPerHour });
  return { directory, storage, app, advance: n => { time += n; }, post: (body = conversation, ip = '127.0.0.1') => app(new Request(`${origin}/api/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), ip) };
}

test('server preserves text/history, excludes arbitrary fields and escapes hostile HTML and links', async () => {
  const { post, app } = await setup();
  const input = structuredClone(conversation); input.chatDraft = 'SECRET'; input.token = 'SECRET'; input.url = 'javascript:alert(1)';
  input.turns[0].asked = '</h1><script>alert(1)</script>';
  input.turns[0].answer.blocks.push({ t: 'p', c: [{ t: 'a', href: 'javascript:alert(1)', c: ['bad link'] }, { t: 'b', c: ['<img src=x onerror=alert(1)>'] }] });
  input.turns[0].answer.sources = [{ href: 'javascript:alert(1)', title: 'bad' }, { href: 'https://example.com/?a=1&b=2', title: 'Valid source' }];
  const result = await post(input); expect(result.status).toBe(201); const record = await result.json();
  const page = await app(new Request(record.url)); const html = await page.text();
  expect(html).toContain('Čisto text 👋'); expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('javascript:'); expect(html).not.toContain('SECRET');
  expect(html).toContain('Valid source'); expect(html).not.toContain('og:image');
  expect(page.headers.get('content-security-policy')).toContain("default-src 'none'");
  expect((await app(new Request(`${record.url}/image.png`))).status).toBe(404);
});

test('deletion capability is required, not embedded in public HTML; data survives server restart and expires', async () => {
  const { directory, storage, app, post, advance } = await setup();
  const result = await (await post({ ...conversation, kind: 'image', png })).json();
  const id = new URL(result.url).pathname.split('/').at(-1);
  const stored = await storage.get(id); expect(stored.deleteToken).toBeUndefined(); expect(stored.deleteHash).not.toBe(result.deleteToken);
  const restarted = createShareApp({ storage: fileStorage(directory), origin });
  expect((await restarted(new Request(result.url))).status).toBe(200);
  const endpoint = `${origin}/api/shares/${id}`;
  expect((await app(new Request(endpoint, { method: 'DELETE' }))).status).toBe(403);
  expect((await app(new Request(endpoint, { method: 'DELETE', headers: { Authorization: 'Bearer wrong' } }))).status).toBe(403);
  expect((await app(new Request(endpoint, { method: 'DELETE', headers: { Authorization: `Bearer ${result.deleteToken}` } }))).status).toBe(204);
  expect((await app(new Request(result.url))).status).toBe(404);
  expect((await app(new Request(`${result.url}/image.png`))).status).toBe(404);
  const expires = await (await post()).json(); advance(RETENTION_MS + 1);
  expect((await app(new Request(expires.url))).status).toBe(404); expect(await readdir(directory)).toHaveLength(0);
});

test('body size, malformed input, file type, upload rate and disk quota are enforced', async () => {
  const { app, post } = await setup({ maxPerHour: 4 });
  expect((await post({ ...conversation, kind: 'image', png: 'bm90LXBuZw==' })).status).toBe(400);
  expect((await post({ turns: [] })).status).toBe(400);
  expect((await app(new Request(`${origin}/api/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_BODY + 1) }, body: '{}' }), '127.0.0.1')).status).toBe(413);
  expect((await post()).status).toBe(201); expect((await post()).status).toBe(429);
  const full = await setup({ maxBytes: 1 }); expect((await full.post()).status).toBe(503); expect(await readdir(full.directory)).toHaveLength(0);
  const other = await setup();
  expect((await other.app(new Request(`${origin}/api/shares`, { method: 'POST', body: '{}' }))).status).toBe(415);
  expect((await other.app(new Request(`${origin}/api/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }))).status).toBe(400);
  const oversized = 'x'.repeat(MAX_BODY + 1);
  expect((await other.app(new Request(`${origin}/api/shares`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: oversized }))).status).toBe(413);
});

test('public origin is pinned, crawler HEAD works, and there is no listing or traversal endpoint', async () => {
  const { app, post } = await setup(); const { url } = await (await post({ ...conversation, kind: 'image', png })).json();
  for (const endpoint of ['/api/shares', '/s/', '/s/../../private', '/api/shares/not-an-id']) expect((await app(new Request(origin + endpoint))).status).toBe(404);
  const head = await app(new Request(url, { method: 'HEAD' })); expect(head.status).toBe(200); expect(await head.text()).toBe('');
  expect((await app(new Request(`${url}/image.png`, { method: 'HEAD' }))).headers.get('content-type')).toBe('image/png');
  const cors = await app(new Request(`${origin}/api/shares`, { method: 'OPTIONS' })); expect(cors.status).toBe(204); expect(cors.headers.get('access-control-allow-methods')).toContain('POST');
  expect(() => createShareApp({ storage: {}, origin: 'http://untrusted.example/' })).toThrow('HTTPS');
});


test('social preview fetchers are allowed without granting API privileges or general indexing', async () => {
  const { app } = await setup();
  const robots = await (await app(new Request(origin + '/robots.txt'))).text();
  expect(robots).toContain('User-agent: Twitterbot'); expect(robots).toContain('User-agent: facebookexternalhit');
  expect(robots).toContain('Allow: /s/'); expect(robots).toContain('Disallow: /api/');
  expect(robots).toContain('User-agent: *\nDisallow: /');
});
