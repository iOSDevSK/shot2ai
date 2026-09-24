import { encodeRecord, decodeRecord } from './record-codec.mjs';
import { createHash, createHmac } from 'node:crypto';
import { createShareApp } from './app.mjs';
import privacy from '../PRIVACY.md';
import connectHTML from './connect.html';
import connectJS from './connect.js';
import { issueAuthorization, validAuthorization, verifyTurnstile } from './auth.mjs';

// A single SQLite Durable Object serializes quota reservations and persists
// rate counters. R2 stores the conversation bytes privately, with strong reads.
// This avoids per-isolate limits resetting on every cold start.
export class ShareStore {
  constructor(ctx, env) {
    this.ctx = ctx; this.env = env; this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS records_expiry ON records(expires)');
    if (![...this.sql.exec('PRAGMA table_info(records)')].some(column => column.name === 'owner')) this.sql.exec("ALTER TABLE records ADD COLUMN owner TEXT NOT NULL DEFAULT ''");
    this.sql.exec('CREATE INDEX IF NOT EXISTS records_owner ON records(owner)');
    if (![...this.sql.exec('PRAGMA table_info(records)')].some(column => column.name === 'ip')) this.sql.exec("ALTER TABLE records ADD COLUMN ip TEXT NOT NULL DEFAULT ''");
    this.sql.exec('CREATE INDEX IF NOT EXISTS records_ip ON records(ip)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS usage (id INTEGER PRIMARY KEY, bytes INTEGER NOT NULL, count INTEGER NOT NULL)');
    if (![...this.sql.exec('SELECT id FROM usage WHERE id=1')].length) this.sql.exec('INSERT INTO usage SELECT 1, COALESCE(SUM(bytes),0), COUNT(*) FROM records');
    this.sql.exec('CREATE TABLE IF NOT EXISTS counters (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS counters_expiry ON counters(expires)');
    this.app = createShareApp({ origin: env.PUBLIC_ORIGIN, privacy, maxPerHour: Infinity,
      authorizeUpload: request => validAuthorization(request.headers.get('authorization'), env.AUTH_SIGNING_SECRET),
      allowUpload: (ip, request) => this.allowUpload(ip, request), storage: {
      get: async id => { const object = await env.CONVERSATIONS.get(this.key(id)); return decodeRecord(object); },
      put: (id, record, request) => this.put(id, record, request), delete: id => this.remove(id),
      // Cleanup runs in an alarm, not a bucket scan for every upload.
      prune: async () => {},
    } });
  }
  key(id) { if (!/^[A-Za-z0-9_-]{32}$/.test(id)) throw new Error('Invalid id'); return `shares/${id}.json`; }
  allowUpload(ip, request) {
    const now = Date.now(), minute = Math.floor(now / 60_000), hour = Math.floor(now / 3_600_000), day = Math.floor(now / 86_400_000);
    const digest = createHash('sha256').update(`${hour}:${ip}`).digest('hex');
    const limits = [[`m:${minute}:${digest}`, 5, (minute + 1) * 60_000], [`h:${hour}:${digest}`, 30, (hour + 1) * 3_600_000], [`d:${day}`, Number(this.env.MAX_UPLOADS_PER_DAY || 1000), (day + 1) * 86_400_000]];
    if (request) limits.push([`install:${day}:${createHash('sha256').update(request.headers.get('authorization') || '').digest('hex')}`, 100, (day + 1) * 86_400_000]);
    return this.count(limits, now);
  }
  count(limits, now = Date.now()) {
    return this.ctx.storage.transactionSync(() => {
      this.sql.exec('DELETE FROM counters WHERE expires <= ?', now);
      for (const [key, max] of limits) {
        const row = [...this.sql.exec('SELECT count FROM counters WHERE key = ?', key)][0];
        if ((row?.count || 0) >= max) return false;
      }
      for (const [key, , expires] of limits) this.sql.exec('INSERT INTO counters(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1', key, expires);
      return true;
    });
  }
  async put(id, record, request) {
    const owner = createHash('sha256').update(request.headers.get('authorization')).digest('hex');
    const ip = createHmac('sha256', this.env.IP_HASH_SECRET).update(request.headers.get('CF-Connecting-IP') || 'unknown').digest('hex');
    const full = () => Object.assign(new Error('Sharing storage limit reached. Delete an older shared link in Settings or try again after it expires.'), { status: 507 });
    const body = await encodeRecord(record), bytes = body.byteLength;
    this.ctx.storage.transactionSync(() => {
      const usage = [...this.sql.exec('SELECT bytes,count FROM usage WHERE id=1')][0];
      if (usage.bytes + bytes > Number(this.env.MAX_STORAGE_BYTES || 5368709120) || usage.count >= 50_000) throw full();
      const owned = [...this.sql.exec('SELECT COALESCE(SUM(bytes),0) AS bytes, COUNT(*) AS count FROM records WHERE owner=?', owner)][0];
      if (owned.bytes + bytes > Number(this.env.MAX_OWNER_BYTES || 33554432) || owned.count >= 50) throw full();
      const address = [...this.sql.exec('SELECT COALESCE(SUM(bytes),0) AS bytes FROM records WHERE ip=?', ip)][0];
      if (address.bytes + bytes > Number(this.env.MAX_IP_BYTES || 52428800)) throw full();
      this.sql.exec('INSERT INTO records(id,bytes,expires,owner,ip) VALUES(?,?,?,?,?)', id, bytes, record.expiresAt, owner, ip);
      this.sql.exec('UPDATE usage SET bytes=bytes+?, count=count+1 WHERE id=1', bytes);
    });
    // Register cleanup before storing bytes, so crashes cannot strand a record.
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm || alarm > Date.now() + 3_600_000) await this.ctx.storage.setAlarm(Date.now() + 3_600_000);
    try {
      await this.env.CONVERSATIONS.put(this.key(id), body, { httpMetadata: { contentType: 'application/json', contentEncoding: 'gzip' } });
    } catch (error) {
      // If the write outcome is uncertain, retain the quota until deletion is
      // confirmed. The alarm and bucket lifecycle are additional cleanup paths.
      await this.remove(id).catch(() => {});
      throw error;
    }
  }
  async remove(id) {
    await this.env.CONVERSATIONS.delete(this.key(id));
    this.release([id]);
  }
  release(ids) {
    if (!ids.length) return;
    this.ctx.storage.transactionSync(() => {
      const slots = ids.map(() => '?').join(',');
      const freed = [...this.sql.exec(`SELECT COALESCE(SUM(bytes),0) AS bytes, COUNT(*) AS count FROM records WHERE id IN (${slots})`, ...ids)][0];
      this.sql.exec(`DELETE FROM records WHERE id IN (${slots})`, ...ids);
      this.sql.exec('UPDATE usage SET bytes=MAX(0,bytes-?), count=MAX(0,count-?) WHERE id=1', freed.bytes, freed.count);
    });
  }
  async alarm() {
    const expired = [...this.sql.exec('SELECT id FROM records WHERE expires <= ? ORDER BY expires LIMIT 250', Date.now())];
    if (expired.length) {
      await this.env.CONVERSATIONS.delete(expired.map(row => this.key(row.id)));
      this.release(expired.map(row => row.id));
    }
    this.sql.exec('DELETE FROM counters WHERE expires <= ?', Date.now());
    const count = [...this.sql.exec('SELECT COUNT(*) AS n FROM records')][0].n;
    if (count) await this.ctx.storage.setAlarm(Date.now() + (expired.length === 250 ? 60_000 : 3_600_000));
  }
  async fetch(request) {
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (new URL(request.url).pathname === '/api/authorize' && request.method === 'POST') {
      const minute = Math.floor(Date.now() / 60_000), hour = Math.floor(Date.now() / 3_600_000);
      const hash = createHash('sha256').update(`${hour}:${ip}`).digest('hex');
      if (!this.count([[`auth:${minute}:${hash}`, 3, (minute + 1) * 60_000], [`auth:${hour}`, 200, (hour + 1) * 3_600_000]])) return Response.json({ error: 'Too many attempts.' }, { status: 429 });
      if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) return new Response(null, { status: 415 });
      // Bounded stream: do not trust the client's Content-Length.
      const reader = request.body?.getReader(); let text = '', size = 0; const decoder = new TextDecoder();
      if (!reader) return new Response(null, { status: 400 });
      while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength;
        if (size > 4096) { await reader.cancel(); return new Response(null, { status: 413 }); } text += decoder.decode(chunk.value, { stream: true }); }
      let token; try { token = JSON.parse(text + decoder.decode()).turnstileToken; } catch { return new Response(null, { status: 400 }); }
      if (!await verifyTurnstile(token, ip, this.env)) return Response.json({ error: 'Verification failed.' }, { status: 403 });
      return Response.json(issueAuthorization(this.env.AUTH_SIGNING_SECRET), { headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
    }
    return this.app(request, ip);
  }
}

export default {
  async fetch(request, env) {
    // There are no alternate workers.dev/preview hosts serving private copies.
    if (new URL(request.url).origin !== env.PUBLIC_ORIGIN) return new Response('Unknown sharing host.', { status: 404 });
    if (env.REQUEST_LIMIT) {
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!(await env.REQUEST_LIMIT.limit({ key: ip })).success) return new Response('Too many requests. Try again later.', { status: 429, headers: { 'Cache-Control': 'no-store' } });
    }
    const path = new URL(request.url).pathname;
    // Reject anonymous uploads at the outer Worker, before forwarding an
    // unread request body across the Durable Object service boundary.
    if (path === '/api/shares' && request.method === 'POST' && !validAuthorization(request.headers.get('authorization'), env.AUTH_SIGNING_SECRET)) {
      return Response.json({ error: 'Verify Shot2AI before publishing a conversation.' }, { status: 401, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*', 'X-Content-Type-Options': 'nosniff' } });
    }

    if (request.method === 'GET' && ['/connect', '/connect.js', '/api/sharing-config'].includes(path)) {
      const headers = { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex',
        'Content-Security-Policy': "default-src 'none'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; style-src 'self'; base-uri 'none'; frame-ancestors 'none'" };
      if (path === '/api/sharing-config') return Response.json({ sitekey: env.TURNSTILE_SITEKEY }, { headers });
      return new Response(path === '/connect' ? connectHTML : connectJS, { headers: { ...headers, 'Content-Type': path === '/connect' ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8' } });
    }
    try { return await env.SHARES.getByName('conversations').fetch(request); }
    catch { return Response.json({ error: 'Shared links are temporarily unavailable. Try again later.' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' } }); }
  },
};
