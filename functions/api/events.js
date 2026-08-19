/**
 * Trading calendar API.
 *
 *   GET    /api/events        public — the site reads this
 *   POST   /api/events        admin  — add an event
 *   DELETE /api/events?id=…   admin  — remove an event
 *
 * Storage is a Cloudflare KV namespace bound as EVENTS. If the binding is
 * missing (e.g. someone deploys the site as pure static hosting), GET falls
 * back to the version of data/events.json shipped with the build, so the
 * calendar still renders and only editing is unavailable.
 */

import { isAuthorised, json } from '../_auth.js';

const KEY = 'events';
const MAX_EVENTS = 500;

const TYPES = ['market', 'festival', 'concert', 'private', 'closed'];

async function readEvents(env, request) {
  if (env.EVENTS) {
    const raw = await env.EVENTS.get(KEY);
    if (raw) return JSON.parse(raw);
  }
  // Fallback: the static file bundled with the deployment.
  const res = await env.ASSETS.fetch(new URL('/data/events.json', request.url));
  return res.ok ? res.json() : [];
}

function clean(value, max) {
  return String(value == null ? '' : value).trim().slice(0, max);
}

/** Reject anything that is not a plain http(s) link. */
function safeLink(value) {
  const link = clean(value, 500);
  if (!link) return '';
  try {
    const url = new URL(link);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
}

export async function onRequestGet({ env, request }) {
  const events = await readEvents(env, request);
  return new Response(JSON.stringify(events), {
    headers: {
      'Content-Type': 'application/json',
      // Short cache: new dates show up quickly, but a busy day does not hammer KV.
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

export async function onRequestPost({ request, env }) {
  if (!(await isAuthorised(request, env))) return json({ error: 'Unauthorised' }, 401);
  if (!env.EVENTS) return json({ error: 'No KV namespace bound as EVENTS' }, 503);

  let input;
  try {
    input = await request.json();
  } catch {
    return json({ error: 'Bad request' }, 400);
  }

  const date = clean(input.date, 10);
  const location = clean(input.location, 120);
  const type = TYPES.includes(input.type) ? input.type : 'market';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Date must be YYYY-MM-DD' }, 400);
  if (!location) return json({ error: 'Location is required' }, 400);

  const events = await readEvents(env, request);
  if (events.length >= MAX_EVENTS) return json({ error: 'Too many events stored' }, 409);

  const event = { id: crypto.randomUUID(), date, location, type, link: safeLink(input.link) };
  events.push(event);
  events.sort((a, b) => (a.date < b.date ? -1 : 1));

  await env.EVENTS.put(KEY, JSON.stringify(events));
  return json(event, 201);
}

export async function onRequestDelete({ request, env }) {
  if (!(await isAuthorised(request, env))) return json({ error: 'Unauthorised' }, 401);
  if (!env.EVENTS) return json({ error: 'No KV namespace bound as EVENTS' }, 503);

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'Missing id' }, 400);

  const events = await readEvents(env, request);
  const remaining = events.filter((e) => e.id !== id);

  await env.EVENTS.put(KEY, JSON.stringify(remaining));
  return json({ removed: events.length - remaining.length });
}
