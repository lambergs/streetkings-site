// GET /api/community -> real member counts of the Discord server, read from its public invite.
// Uses DISCORD_BOT_TOKEN when it is set (kinder rate limits); DISCORD_INVITE overrides the invite code.

const DEFAULT_INVITE = 'puXrPjHDu2';
const MEMORY_MS = 5 * 60 * 1000;
let memo = { at: 0, body: null };

function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

export async function onRequestGet({ env }) {
  if (memo.body && Date.now() - memo.at < MEMORY_MS) return json(memo.body, 300);
  const code = String(env.DISCORD_INVITE || DEFAULT_INVITE).replace(/[^A-Za-z0-9-]/g, '');
  const headers = { 'User-Agent': 'StreetKingsSite (https://discord.gg, 1.3)' };
  if (env.DISCORD_BOT_TOKEN) headers.Authorization = `Bot ${env.DISCORD_BOT_TOKEN}`;
  try {
    const r = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, { headers });
    if (!r.ok) return json({ error: `discord_${r.status}` }, 60);
    const d = await r.json();
    const g = d.guild || {};
    const body = {
      name: g.name || null,
      members: typeof d.approximate_member_count === 'number' ? d.approximate_member_count : null,
      online: typeof d.approximate_presence_count === 'number' ? d.approximate_presence_count : null,
      icon: g.id && g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=128` : null,
    };
    memo = { at: Date.now(), body };
    return json(body, 300);
  } catch {
    return json({ error: 'unreachable' }, 60);
  }
}
