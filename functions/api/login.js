import { checkPassword, issueToken, json } from '../_auth.js';

export async function onRequestPost({ request, env }) {
  if (!env.ADMIN_PASSWORD || !env.AUTH_SECRET) {
    return json({ error: 'Admin is not configured. Set ADMIN_PASSWORD and AUTH_SECRET.' }, 503);
  }

  let password = '';
  try {
    ({ password } = await request.json());
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  if (!(await checkPassword(env, password))) {
    // Deliberately slow and vague — no hint about which part was wrong.
    await new Promise((r) => setTimeout(r, 600));
    return json({ error: 'Incorrect password' }, 401);
  }

  return json({ token: await issueToken(env) });
}
