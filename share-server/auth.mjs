import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export const AUTH_TTL = 30 * 24 * 60 * 60 * 1000;
const signature = (secret, value) => createHmac('sha256', secret).update(value).digest('base64url');
export function issueAuthorization(secret, now = Date.now()) {
  if (!secret || secret.length < 32) throw new Error('Authorization is not configured');
  const expiresAt = now + AUTH_TTL, payload = `v1.${randomBytes(32).toString('base64url')}.${expiresAt}`;
  return { token: `${payload}.${signature(secret, payload)}`, expiresAt };
}
export function validAuthorization(header, secret, now = Date.now()) {
  if (!secret || secret.length < 32 || typeof header !== 'string') return false;
  const match = /^Bearer (v1\.[A-Za-z0-9_-]{43}\.(\d{13}))\.([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match || Number(match[2]) <= now || Number(match[2]) > now + AUTH_TTL) return false;
  return timingSafeEqual(Buffer.from(match[3]), Buffer.from(signature(secret, match[1])));
}
export async function verifyTurnstile(token, ip, env, fetcher = fetch) {
  if (typeof token !== 'string' || token.length < 1 || token.length > 2048 || !env.TURNSTILE_SECRET) return false;
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET, response: token, remoteip: ip }), signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return false;
    const result = await response.json();
    return result.success === true && result.hostname === new URL(env.PUBLIC_ORIGIN).hostname && result.action === 'authorize';
  } catch { return false; }
}
