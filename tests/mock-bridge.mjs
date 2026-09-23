// A stand-in for the html2wp app's bridge, speaking the same contract:
//   GET  /status   POST /pair {code}   POST /message {token, projectId, text, imagePng | imagesPng[]}
import http from 'node:http';

export const CODE = '482913';
export const TOKEN = 'mock-token-7f3a9c';
export const PROJECT = { id: '0584dcf1-7f08-4efb-85cf-ae7284faf8f9', name: 'Studio site' };

// Port 0 picks a free port: the real html2wp app may be listening on 47811–47815.
export function startMockBridge(port = 0) {
  const state = {
    chat: { available: true, reason: null },
    // When set, /status says the chat is open but /message still refuses with this reason.
    refuseMessage: null,
    messages: [],
    origins: [],
  };
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      state.origins.push(req.headers.origin || null);
      const reply = (status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
      const origin = req.headers.origin;
      if (origin && !origin.startsWith('chrome-extension://')) return reply(403, { error: 'forbidden' });
      let body = {};
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; } catch { return reply(400, {}); }
      const bearer = (req.headers.authorization || '').replace(/^Bearer /, '');
      if (req.method === 'GET' && req.url === '/status') {
        const paired = bearer === TOKEN;
        // Like an app that takes up to 4 screenshots per message.
        return reply(200, { app: 'html2wp', version: 'mock', paired, project: paired ? PROJECT : null, chat: paired ? state.chat : null, maxImages: 4 });
      }
      if (req.method === 'POST' && req.url === '/pair') {
        return body.code === CODE ? reply(200, { token: TOKEN }) : reply(403, { error: 'wrong code' });
      }
      if (req.method === 'POST' && req.url === '/message') {
        if ((body.token || bearer) !== TOKEN) return reply(401, { error: 'not paired' });
        if (!state.chat.available) return reply(409, { reason: state.chat.reason });
        if (state.refuseMessage) return reply(409, { reason: state.refuseMessage });
        const pngs = (body.imagesPng || [body.imagePng || '']).map((b) => Buffer.from(b, 'base64'));
        state.messages.push({ projectId: body.projectId, text: body.text, png: pngs[0], pngs });
        return reply(200, { ok: true });
      }
      reply(404, {});
    });
  });
  return new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve({ state, port: server.address().port, close: () => new Promise((r) => server.close(r)) })));
}

// Width and height from a PNG's IHDR chunk.
export function pngSize(png) {
  if (png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('not a PNG');
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}
