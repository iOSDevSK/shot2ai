import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createShareApp } from './app.mjs';
import { fileStorage } from './storage.mjs';

export function startServer({ port = 8788, hostname = '127.0.0.1', origin, directory, maxBytes, trustProxy = false }) {
  const storage = fileStorage(directory, maxBytes);
  const privacy = readFileSync(new URL('../PRIVACY.md', import.meta.url), 'utf8');
  let handle = origin ? createShareApp({ storage, origin, privacy }) : null;
  const server = createServer(async (req, res) => {
    try {
      const publicOrigin = origin || `http://127.0.0.1:${server.address().port}`;
      handle ||= createShareApp({ storage, origin: publicOrigin, privacy });
      const request = new Request(new URL(req.url, publicOrigin), { method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: Readable.toWeb(req), duplex: 'half' } : {}) });
      // Enable only behind a reverse proxy that overwrites X-Forwarded-For.
      const ip = trustProxy ? String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim() : req.socket.remoteAddress;
      const response = await handle(request, ip);
      res.writeHead(response.status, Object.fromEntries(response.headers));
      if (response.body) Readable.fromWeb(response.body).pipe(res); else res.end();
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  server.requestTimeout = 30_000;
  const cleanup = setInterval(() => storage.prune(Date.now()).catch(() => {}), 3_600_000); cleanup.unref();
  server.on('close', () => clearInterval(cleanup));
  server.listen(port, hostname);
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.PUBLIC_ORIGIN) throw new Error('Set PUBLIC_ORIGIN to the public HTTPS origin.');
  const port = Number(process.env.PORT || 8788);
  startServer({ port, hostname: process.env.HOST || '127.0.0.1', origin: process.env.PUBLIC_ORIGIN,
    directory: process.env.SHARE_DATA_DIR || './share-data', maxBytes: Number(process.env.MAX_STORAGE_BYTES || 512 * 1024 * 1024), trustProxy: process.env.TRUST_PROXY === '1' });
  console.log(`Shot2AI sharing service listening on port ${port}`);
}
