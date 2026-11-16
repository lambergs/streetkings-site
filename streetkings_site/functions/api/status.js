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

  // the server list moved to cfx-services; the old servers-frontend.fivem.net address now answers "not found" for everyone
  const hosts = ['https://frontend.cfx-services.net', 'https://servers-frontend.fivem.net'];
  for (const host of hosts) {
    try {
      const r = await fetch(`${host}/api/servers/single/${code}`, {
        headers: { 'User-Agent': 'StreetKingsSite/1.1', Accept: 'application/json' },
      });
      if (!r.ok) continue;
      const d = (await r.json()).Data || {};
      // the list keeps a server for a while after it goes down; lastSeen older than 10 minutes counts as offline
      const seen = d.lastSeen ? Date.parse(d.lastSeen) : Date.now();
      const online = Number.isFinite(seen) ? Date.now() - seen < 10 * 60 * 1000 : true;
      return json({ online, players: online ? (d.clients ?? (d.players || []).length) : 0, max: d.sv_maxclients ?? d.svMaxclients ?? 0 }, 60);
    } catch {
      // try the next address
    }
  }
  return json({ online: false, players: 0, max: 0 }, 60);
}
