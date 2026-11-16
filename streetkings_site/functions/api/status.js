// GET /api/status -> live player count from the FiveM server list.
// Needs one Cloudflare Pages environment variable:
//   CFX_CODE   the code at the end of your join link (cfx.re/join/abc123 -> abc123)

function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

export async function onRequestGet({ env }) {
  const code = (env.CFX_CODE || '').trim();
  if (!/^[a-z0-9]{4,10}$/i.test(code)) return json({ error: 'not_configured' }, 300);

  try {
    const r = await fetch(`https://servers-frontend.fivem.net/api/servers/single/${code}`, {
      headers: { 'User-Agent': 'StreetKingsSite/1.0', Accept: 'application/json' },
    });
    if (!r.ok) return json({ online: false, players: 0, max: 0 }, 60);
    const d = (await r.json()).Data || {};
    return json({ online: true, players: d.clients ?? (d.players || []).length, max: d.sv_maxclients ?? d.svMaxclients ?? 0 }, 60);
  } catch {
    return json({ online: false, players: 0, max: 0 }, 60);
  }
}
