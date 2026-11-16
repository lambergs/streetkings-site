// POST /api/contact -> posts the contact form to a Discord channel through a webhook.
// Needs one Cloudflare Pages environment variable (encrypted):
//   DISCORD_WEBHOOK   the webhook URL. It stays on the server; never put it in the site files.

const TOPICS = ['Question', 'Business enquiry', 'Report a problem', 'Other'];

function reply(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0009\u000B-\u001F]/g, '').trim().slice(0, max);
}

export async function onRequestPost({ request, env }) {
  if (!env.DISCORD_WEBHOOK) return reply(503, { ok: false, error: 'The contact form is not set up yet. Message us on Discord.' });

  // one message per visitor per minute (best effort, per Cloudflare location)
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const cache = caches.default;
  const limitKey = new Request(`${new URL(request.url).origin}/__contact_limit/${encodeURIComponent(ip)}`);
  if (await cache.match(limitKey).catch(() => null)) {
    return reply(429, { ok: false, error: 'Please wait a minute before sending another message.' });
  }

  let data;
  try { data = await request.json(); } catch { return reply(400, { ok: false, error: 'Bad request.' }); }

  // bots fill the hidden field or send instantly
  if (clean(data.website, 100) || Number(data.elapsed) < 3000) return reply(200, { ok: true });

  const name = clean(data.name, 60);
  const discord = clean(data.discord, 40);
  const message = clean(data.message, 1500);
  const topic = TOPICS.includes(data.topic) ? data.topic : 'Other';
  if (!name || !discord || message.length < 10) return reply(400, { ok: false, error: 'Fill in every field (message at least 10 characters).' });

  const res = await fetch(env.DISCORD_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'StreetKings Website',
      allowed_mentions: { parse: [] }, // nobody can ping @everyone through the form
      embeds: [{
        title: `Website: ${topic}`,
        description: message,
        color: 0xf7931e,
        fields: [
          { name: 'Name', value: name, inline: true },
          { name: 'Discord', value: discord, inline: true },
        ],
        timestamp: new Date().toISOString(),
      }],
    }),
  });
  if (!res.ok) return reply(502, { ok: false, error: 'Could not reach Discord. Try again in a minute.' });

  await cache.put(limitKey, new Response('1', { headers: { 'Cache-Control': 'max-age=60' } })).catch(() => {});
  return reply(200, { ok: true });
}
