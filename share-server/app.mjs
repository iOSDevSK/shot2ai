import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { cleanSnapshot } from '../src/share-snapshot.js';
import { renderConversation, style } from './render.mjs';

export const MAX_BODY = 12 * 1024 * 1024;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const identifier = '[A-Za-z0-9_-]{32}';
const hash = value => createHash('sha256').update(value).digest('hex');
const headers = {
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
  'x-robots-tag': 'noindex, nofollow, noarchive', 'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; img-src 'self'; style-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, DELETE, OPTIONS',
  'access-control-allow-headers': 'Content-Type, Authorization',
};
const reply = (body, status = 200, type = 'application/json; charset=utf-8', extra = {}) => new Response(type.startsWith('application/json') ? JSON.stringify(body) : body, { status, headers: { ...headers, 'content-type': type, ...extra } });
const error = (status, message) => reply({ error: message }, status);
async function readJSON(request) {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || '')) throw Object.assign(new Error('Send JSON.'), { status: 415 });
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw Object.assign(new Error('Conversation exceeds 12 MB. Use PDF or MD.'), { status: 413 });
  const reader = request.body?.getReader(); let size = 0; const chunks = [];
  if (!reader) throw Object.assign(new Error('Missing conversation.'), { status: 400 });
  while (true) {
    const { value, done } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY) { await reader.cancel(); throw Object.assign(new Error('Conversation exceeds 12 MB. Use PDF or MD.'), { status: 413 }); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
}
function imageData(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error('Missing PNG image.');
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length < 33 || bytes.toString('hex', 0, 8) !== '89504e470d0a1a0a' || bytes.toString('ascii', 12, 16) !== 'IHDR' || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20)) throw new Error('Invalid PNG image.');
  if (bytes.length > 8 * 1024 * 1024 || bytes.readUInt32BE(16) > 32768 || bytes.readUInt32BE(20) > 32768 || bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 64_000_000) throw new Error('PNG exceeds supported dimensions or size.');
  return bytes.toString('base64');
}

// Storage implements get(id), put(id, record), delete(id), prune(now).
// There is deliberately no public list/search endpoint.
export function createShareApp({ storage, origin, now = Date.now, maxPerHour = 30, allowUpload, authorizeUpload, privacy = '' }) {
  const base = new URL(origin);
  if (base.pathname !== '/' || base.search || base.hash || base.username || base.password || (base.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(base.hostname))) throw new Error('PUBLIC_ORIGIN must be an HTTPS origin (HTTP localhost is allowed for tests).');
  const limits = new Map();
  return async function handle(request, clientIP = 'unknown') {
    try {
      const url = new URL(request.url), path = url.pathname;
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
      if (request.method === 'GET' && path === '/health') return reply({ ok: true });
      if (request.method === 'GET' && path === '/') return reply('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Shared conversations · Shot2AI</title><link rel="stylesheet" href="/style.css"></head><body><main><h1>Shared with Shot2AI</h1><p>Open a conversation link to see its original screenshot and saved questions and answers.</p><p>Shared links are available for 30 days. Their creator can delete them earlier from Shot2AI settings.</p><p><a href="https://github.com/iOSDevSK/shot2ai">Get Shot2AI</a> · <a href="/privacy">Privacy</a></p></main></body></html>', 200, 'text/html; charset=utf-8');
      if (request.method === 'GET' && path === '/privacy' && privacy) return reply(privacy, 200, 'text/plain; charset=utf-8');
      if (request.method === 'GET' && path === '/style.css') return reply(style, 200, 'text/css; charset=utf-8');
      if (request.method === 'GET' && path === '/robots.txt') return reply('User-agent: Twitterbot\nUser-agent: facebookexternalhit\nUser-agent: WhatsApp\nAllow: /s/\nDisallow: /api/\nDisallow: /connect\n\nUser-agent: *\nDisallow: /\n', 200, 'text/plain; charset=utf-8');
      if (request.method === 'POST' && path === '/api/shares') {
        if (authorizeUpload && !await authorizeUpload(request)) return error(401, 'Verify Shot2AI before publishing a conversation.');
        if (allowUpload && !await allowUpload(clientIP, request)) return error(429, 'Too many shared links. Try again later.');
        // Only retain a salted, hourly hash of the IP for abuse throttling.
        const hour = Math.floor(now() / 3_600_000);
        for (const [key, value] of limits) if (value.hour !== hour) limits.delete(key);
        const key = hash(`${hour}:${clientIP}`), used = limits.get(key)?.count || 0;
        if (used >= maxPerHour || limits.size >= 10_000) return error(429, 'Too many shared links. Try again later.');
        limits.set(key, { hour, count: used + 1 });
        const input = await readJSON(request);
        if (!input || !Array.isArray(input.turns) || !input.turns.length || input.turns.some(t => ['sending', 'answering'].includes(t?.answer?.state))) return error(400, 'A completed conversation is required.');
        let snapshot, png, preview = null;
        try {
          snapshot = cleanSnapshot(input); png = snapshot.kind === 'text' ? null : imageData(input.png);
          if (input.preview) {
            preview = imageData(input.preview); const bytes = Buffer.from(preview, 'base64');
            if (bytes.length > 1024 * 1024 || bytes.readUInt32BE(16) !== 1200 || bytes.readUInt32BE(20) !== 630) throw new Error('Invalid preview.');
          }
        } catch { return error(400, 'Invalid conversation or PNG image.'); }
        const id = randomBytes(24).toString('base64url'), deleteToken = randomBytes(32).toString('base64url');
        const expiresAt = now() + RETENTION_MS;
        await storage.prune(now());
        await storage.put(id, { snapshot, png, preview, expiresAt, deleteHash: hash(deleteToken) }, request);
        return reply({ url: `${base.origin}/s/${id}`, deleteToken, expiresAt }, 201);
      }
      const api = path.match(new RegExp(`^/api/shares/(${identifier})$`));
      if (request.method === 'DELETE' && api) {
        const record = await storage.get(api[1]);
        if (!record || record.expiresAt <= now()) return error(404, 'This link is unavailable.');
        const supplied = request.headers.get('authorization') || '';
        const expected = Buffer.from(record.deleteHash, 'hex'), actual = Buffer.from(hash(supplied.replace(/^Bearer /, '')), 'hex');
        if (!supplied.startsWith('Bearer ') || !timingSafeEqual(expected, actual)) return error(403, 'Invalid deletion token.');
        await storage.delete(api[1]);
        return new Response(null, { status: 204, headers });
      }
      const view = path.match(new RegExp(`^/s/(${identifier})(/(?:image|preview)\\.png)?$`));
      if (['GET', 'HEAD'].includes(request.method) && view) {
        const record = await storage.get(view[1]);
        if (!record || record.expiresAt <= now()) {
          if (record) await storage.delete(view[1]);
          return reply('This shared conversation has expired or was deleted.', 404, 'text/plain; charset=utf-8');
        }
        if (view[2]) {
          const image = view[2] === '/preview.png' ? record.preview : record.png;
          return image ? reply(request.method === 'HEAD' ? null : Buffer.from(image, 'base64'), 200, 'image/png') : error(404, 'No image.');
        }
        return reply(request.method === 'HEAD' ? null : renderConversation(record, base.origin, view[1]), 200, 'text/html; charset=utf-8');
      }
      return error(404, 'Not found.');
    } catch (e) {
      return error(e.status || 503, e.status ? e.message : 'Shared links are temporarily unavailable. Try again later.');
    }
  };
}
