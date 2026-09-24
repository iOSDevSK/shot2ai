import { test, expect } from '@playwright/test';
import { issueAuthorization, validAuthorization, verifyTurnstile, AUTH_TTL } from '../share-server/auth.mjs';
const secret = 'test-signing-secret-never-used-in-production';
test('upload credentials are signed, expire, cannot be forged or reused after key rotation', () => {
  const now = 1_800_000_000_000, value = issueAuthorization(secret, now);
  expect(validAuthorization('Bearer ' + value.token, secret, now)).toBe(true);
  expect(validAuthorization('Bearer ' + value.token, secret, now + AUTH_TTL)).toBe(false);
  expect(validAuthorization('Bearer ' + value.token, secret + 'rotated', now)).toBe(false);
  expect(validAuthorization('Bearer ' + value.token.replace('v1.', 'v2.'), secret, now)).toBe(false);
  const parts = value.token.split('.'); parts[2] = String(value.expiresAt + 1);
  expect(validAuthorization('Bearer ' + parts.join('.'), secret, now)).toBe(false);
  expect(validAuthorization(null, secret, now)).toBe(false);
  expect(validAuthorization('Bearer ' + value.token, '', now)).toBe(false);
});
test('Turnstile requires provider success, matching hostname and action and fails closed', async () => {
  const env = { PUBLIC_ORIGIN: 'https://share.shot2ai.com', TURNSTILE_SECRET: 'test-secret' };
  const check = data => verifyTurnstile('one-use-provider-token', '127.0.0.1', env, async (url, init) => {
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(JSON.parse(init.body).secret).toBe('test-secret');
    return Response.json(data);
  });
  expect(await check({ success: true, hostname: 'share.shot2ai.com', action: 'authorize' })).toBe(true);
  for (const data of [{ success: false }, { success: true, hostname: 'evil.example', action: 'authorize' }, { success: true, hostname: 'share.shot2ai.com', action: 'other' }]) expect(await check(data)).toBe(false);
  expect(await verifyTurnstile('token', 'ip', env, () => { throw new Error('offline'); })).toBe(false);
});
test('extension accepts authorization only from its owned tab, trusted origin, frame and nonce', async () => {
  const { SHARE_ORIGIN } = await import('../src/share-config.js');
  const { acceptShareAuthorization } = await import('../src/share-auth.js');
  const nonce = crypto.randomUUID(), authorization = issueAuthorization(secret);
  let data = { shareAuthorizationPending: { nonce, tabId: 23, expiresAt: Date.now() + 60_000 } };
  globalThis.chrome = { storage: { local: { get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value), remove: async key => { delete data[key]; } } } };
  const message = { type: 'share-authorized', nonce, authorization }, sender = { url: SHARE_ORIGIN + '/connect', tab: { id: 23 }, frameId: 0 };
  try {
    for (const modified of [{ ...sender, url: 'https://evil.example/connect' }, { ...sender, tab: { id: 24 } }, { ...sender, frameId: 2 }]) expect(await acceptShareAuthorization(message, modified)).toMatchObject({ ok: false });
    expect(await acceptShareAuthorization({ ...message, nonce: 'wrong' }, sender)).toMatchObject({ ok: false });
    expect(data.shareAuthorization).toBeUndefined();
    expect(await acceptShareAuthorization(message, sender)).toEqual({ ok: true });
    expect(data.shareAuthorization.token).toBe(authorization.token);
    expect(await acceptShareAuthorization(message, sender)).toMatchObject({ ok: false });
  } finally { delete globalThis.chrome; }
});


test('trusted verification tolerates a slightly faster server clock and reports a real expired request separately', async () => {
  const { SHARE_ORIGIN } = await import('../src/share-config.js');
  const { acceptShareAuthorization } = await import('../src/share-auth.js');
  const nonce = crypto.randomUUID(); let data;
  globalThis.chrome = { storage: { local: { get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value), remove: async key => { delete data[key]; } } } };
  const sender = { url: SHARE_ORIGIN + '/connect', tab: { id: 23 }, frameId: 0 };
  try {
    data = { shareAuthorizationPending: { nonce, tabId: 23, expiresAt: Date.now() + 60_000 } };
    const message = { type: 'share-authorized', nonce, authorization: issueAuthorization(secret, Date.now() + 2000) };
    expect(await acceptShareAuthorization(message, sender)).toMatchObject({ ok: true });
    data = { shareAuthorizationPending: { nonce, tabId: 23, expiresAt: Date.now() - 1 } };
    expect(await acceptShareAuthorization(message, sender)).toMatchObject({ ok: false, reason: 'request-expired' });
    expect(data.shareAuthorization).toBeUndefined();
  } finally { delete globalThis.chrome; }
});

test('a verification callback closing its tab between polling reads is still successful', async () => {
  const { authorizeSharing } = await import('../src/share-auth.js');
  const { SHARE_ORIGIN } = await import('../src/share-config.js');
  const authorization = { ...issueAuthorization(secret), origin: SHARE_ORIGIN }, data = {};
  globalThis.chrome = {
    runtime: { id: 'a'.repeat(32) },
    storage: { local: { get: async key => ({ [key]: data[key] }), set: async value => Object.assign(data, value), remove: async key => { delete data[key]; } } },
    tabs: {
      create: async () => ({ id: 23 }), update: async () => {},
      get: async () => {
        data.shareAuthorization = authorization;
        delete data.shareAuthorizationPending;
        throw new Error('No tab with id: 23');
      },
    },
  };
  try { expect(await authorizeSharing()).toBe(authorization.token); }
  finally { delete globalThis.chrome; }
});
