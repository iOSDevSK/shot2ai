import { issueAuthorization } from '../share-server/auth.mjs';
import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile, readFile, mkdir, readdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

const secret = 'test-fixture-only-authorization-secret';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==';
const payload = { kind: 'image', png, turns: [{ asked: 'Synthetic Cloudflare test čšť', answer: { state: 'done', blocks: [{ t: 'p', c: ['All saved conversation text.'] }] } }] };
async function runtime(vars = {}) {
  const socket = createServer(); socket.listen(0, '127.0.0.1'); await once(socket, 'listening'); const port = socket.address().port; await new Promise(r => socket.close(r));
  const dir = await mkdtemp(join(tmpdir(), 'shot2ai-cloudflare-test-')), origin = `http://127.0.0.1:${port}`;
  // Snapshot sources: concurrent repo edits/deploys must not hot-reload a
  // running test Worker in the middle of a request.
  await mkdir(join(dir, 'share-server')); await mkdir(join(dir, 'src'));
  for (const file of await readdir(resolve('share-server'))) if (/\.(mjs|html|js)$/.test(file)) await copyFile(resolve('share-server', file), join(dir, 'share-server', file));
  await copyFile(resolve('PRIVACY.md'), join(dir, 'PRIVACY.md'));
  await copyFile(resolve('src/share-snapshot.js'), join(dir, 'src/share-snapshot.js'));
  const config = JSON.parse(await readFile(resolve('share-server/wrangler.jsonc'), 'utf8'));
  config.main = join(dir, 'share-server/cloudflare.mjs'); config.routes = []; config.vars = { ...config.vars, PUBLIC_ORIGIN: origin, AUTH_SIGNING_SECRET: secret, IP_HASH_SECRET: 'test-only-ip-quota-hashing-secret', ...vars };
  await writeFile(join(dir, 'wrangler.json'), JSON.stringify(config));
  let child, logs;
  async function start() {
    logs = '';
    child = spawn(process.execPath, [resolve('share-server/node_modules/wrangler/bin/wrangler.js'), 'dev', '--local', '--config', join(dir, 'wrangler.json'), '--port', String(port), '--host', `127.0.0.1:${port}`, '--persist-to', join(dir, 'storage'), '--log-level', 'error'], { stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', x => { logs += x; }); child.stderr.on('data', x => { logs += x; });
    await expect.poll(async () => {
      if (child.exitCode !== null) throw new Error(logs);
      try { return (await fetch(origin + '/health')).status; } catch { return 0; }
    }, { timeout: 20_000 }).toBe(200);
  }
  async function stop() { if (child.exitCode !== null) return; const ended = once(child, 'exit'); child.kill('SIGTERM'); await ended; }
  await start();
  const credential = issueAuthorization(secret, Date.now() - 1000).token;
  return { origin, stop, restart: async () => { await stop(); await start(); }, post: (body = payload, token = credential) => fetch(origin + '/api/shares', { method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(body) }) };
}
const remove = (rt, record) => fetch(`${rt.origin}/api/shares/${new URL(record.url).pathname.split('/').at(-1)}`, { method: 'DELETE', headers: { Authorization: 'Bearer ' + record.deleteToken } });

test('real Wrangler runtime stores PNG in R2, survives restart and revokes page and image', async () => {
  const rt = await runtime();
  try {
    const response = await rt.post(); expect(response.status, await response.clone().text()).toBe(201);
    const record = await response.json();
    expect(await (await fetch(record.url)).text()).toContain('All saved conversation text.');
    expect(Buffer.from(await (await fetch(record.url + '/image.png')).arrayBuffer()).toString('base64')).toBe(png);
    await rt.restart(); expect((await fetch(record.url)).status).toBe(200);
    expect((await remove(rt, record)).status).toBe(204);
    expect((await fetch(record.url)).status).toBe(404); expect((await fetch(record.url + '/image.png')).status).toBe(404);
  } finally { await rt.stop(); }
});

test('Cloudflare daily limit persists across a runtime restart', async () => {
  const rt = await runtime({ MAX_UPLOADS_PER_DAY: '2' });
  try {
    const simultaneous = await Promise.all(Array.from({ length: 4 }, () => rt.post()));
    expect(simultaneous.map(r => r.status).sort()).toEqual([201, 201, 429, 429]);
    await rt.restart(); expect((await rt.post()).status).toBe(429);
  } finally { await rt.stop(); }
});

test('Cloudflare storage quota blocks further uploads and deletion releases capacity', async () => {
  const rt = await runtime({ MAX_STORAGE_BYTES: '700' });
  try {
    const first = await rt.post(); expect(first.status).toBe(201); const record = await first.json();
    expect((await rt.post()).status).toBe(507);
    expect((await remove(rt, record)).status).toBe(204);
    expect((await rt.post()).status).toBe(201);
  } finally { await rt.stop(); }
});


test('Cloudflare denies anonymous, forged, expired uploads, fake challenges and cross-owner deletion', async () => {
  const rt = await runtime();
  try {
    for (const token of ['', 'forged', issueAuthorization(secret, Date.now() - 31 * 86400_000).token]) {
      const result = await fetch(rt.origin + '/api/shares', { method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify(payload) });
      expect(result.status, await result.text()).toBe(401);
    }
    const challenge = await fetch(rt.origin + '/api/authorize', { method: 'POST', headers: { Connection: 'close', 'Content-Type': 'application/json' }, body: JSON.stringify({ turnstileToken: 'fabricated' }) });
    expect(challenge.status, await challenge.clone().text()).toBe(403);
    const a = await rt.post(), b = await rt.post();
    expect(a.status, await a.clone().text()).toBe(201); expect(b.status, await b.clone().text()).toBe(201);
    const first = await a.json(), second = await b.json();
    expect((await remove(rt, { ...first, deleteToken: second.deleteToken })).status).toBe(403);
    expect((await fetch(first.url)).status).toBe(200);
    expect((await fetch(rt.origin + '/api/shares')).status).toBe(404);
    const html = await (await fetch(first.url)).text(); expect(html).not.toContain(first.deleteToken);
    expect((await remove(rt, first)).status).toBe(204); expect((await fetch(second.url)).status).toBe(200);
  } finally { await rt.stop(); }
});


test('a browser token has its own storage ceiling; another token cannot use its deletion key', async () => {
  const rt = await runtime({ MAX_OWNER_BYTES: '700' });
  try {
    const firstResponse = await rt.post(); expect(firstResponse.status).toBe(201); const first = await firstResponse.json();
    expect((await rt.post()).status).toBe(507);
    const otherToken = issueAuthorization(secret, Date.now() - 1000).token;
    const otherResponse = await rt.post(payload, otherToken); expect(otherResponse.status).toBe(201); const other = await otherResponse.json();
    expect((await remove(rt, { ...first, deleteToken: other.deleteToken })).status).toBe(403);
    expect((await remove(rt, first)).status).toBe(204);
    expect((await rt.post()).status).toBe(201);
  } finally { await rt.stop(); }
});


test('one IP cannot bypass its storage quota by getting another upload credential', async () => {
  const rt = await runtime({ MAX_IP_BYTES: '700' });
  try {
    const response = await rt.post(); expect(response.status).toBe(201); const first = await response.json();
    const secondToken = issueAuthorization(secret, Date.now() - 1000).token;
    expect((await rt.post(payload, secondToken)).status).toBe(507);
    await rt.restart(); expect((await rt.post(payload, secondToken)).status).toBe(507);
    expect((await remove(rt, first)).status).toBe(204);
    expect((await rt.post(payload, secondToken)).status).toBe(201);
  } finally { await rt.stop(); }
});
