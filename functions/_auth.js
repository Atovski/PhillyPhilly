/**
 * Shared auth helpers for the admin API (Cloudflare Pages Functions).
 *
 * Two environment variables must be set in the Pages project
 * (Settings -> Environment variables, marked as "Secret"):
 *
 *   ADMIN_PASSWORD  the password the owner types on /admin/
 *   AUTH_SECRET     any long random string; used to sign session tokens
 *
 * Tokens are "<expiry>.<hmac>" — stateless, so there is nothing to store and
 * nothing to clean up. They last 12 hours.
 */

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

const enc = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time string compare, so a wrong password leaks no timing signal. */
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function issueToken(env) {
  const exp = String(Date.now() + TOKEN_TTL_MS);
  return `${exp}.${await hmac(env.AUTH_SECRET, exp)}`;
}

export async function checkPassword(env, password) {
  if (!env.ADMIN_PASSWORD) return false;
  return safeEqual(String(password || ''), env.ADMIN_PASSWORD);
}

/** Returns true only for an unexpired, correctly signed token. */
export async function isAuthorised(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  const [exp, sig] = token.split('.');

  if (!exp || !sig) return false;
  if (!Number(exp) || Number(exp) < Date.now()) return false;

  return safeEqual(sig, await hmac(env.AUTH_SECRET, exp));
}

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
