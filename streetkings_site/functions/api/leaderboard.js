// /api/leaderboard
//   POST  from the game server (eastla_dragstrip server/website.lua): stores the drag strip leaderboards
//   GET   for the site: returns what was stored last
// Needs:
//   LEADERBOARD     KV namespace binding (wrangler.jsonc "kv_namespaces")
//   LEADERBOARD_KEY Secret: long random text, the same as eastla_drag_site_key in server.cfg

const KEY = 'board';
const MAX_BYTES = 200 * 1024;

function json(status, body, maxAge = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
  });
}

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001F]/g, '').slice(0, max) : '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// keep only the fields the site shows, whatever the server sends
function clean(data) {
  const strips = (Array.isArray(data.strips) ? data.strips : []).slice(0, 30).map((s) => ({
    id: str(s.id, 32),
    label: str(s.label, 60),
    lengthFt: num(s.lengthFt),
    rows: (Array.isArray(s.rows) ? s.rows : []).slice(0, 25).map((r) => ({
      name: str(r.name, 60), car: str(r.car, 60), et: num(r.et), trap: num(r.trap), rt: num(r.rt), et60: num(r.et60), day: str(r.day, 10),
    })).filter((r) => r.et !== null),
  })).filter((s) => s.rows.length);
  const ratings = (Array.isArray(data.ratings) ? data.ratings : []).slice(0, 25).map((r) => ({
    name: str(r.name, 60), elo: num(r.elo), peak: num(r.peak), races: num(r.races),
  })).filter((r) => r.elo !== null);
  return { units: data.units === 'mph' ? 'mph' : 'kph', strips, ratings, updatedAt: num(data.updatedAt) || Math.floor(Date.now() / 1000) };
}

function sameSecret(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function onRequestPost({ request, env }) {
  if (!env.LEADERBOARD || !env.LEADERBOARD_KEY) return json(503, { ok: false, error: 'not_configured' });
  const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!sameSecret(auth, env.LEADERBOARD_KEY)) return json(401, { ok: false, error: 'unauthorized' });

  const text = await request.text();
  if (text.length > MAX_BYTES) return json(413, { ok: false, error: 'too_large' });
  let data;
  try { data = JSON.parse(text); } catch { return json(400, { ok: false, error: 'bad_json' }); }

  await env.LEADERBOARD.put(KEY, JSON.stringify(clean(data)));
  return json(200, { ok: true });
}

export async function onRequestGet({ env }) {
  if (!env.LEADERBOARD) return json(200, { strips: [], ratings: [], error: 'not_configured' }, 60);
  const stored = await env.LEADERBOARD.get(KEY);
  if (!stored) return json(200, { strips: [], ratings: [] }, 60);
  return new Response(stored, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=60' } });
}
