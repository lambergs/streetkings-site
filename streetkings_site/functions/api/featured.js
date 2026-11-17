// GET /api/featured -> the build of the week: the newest PINNED post with a picture in #gallery.
// Staff feature a build by pinning it (only people with Pin Messages can). Unpin it to take it down.
// Uses the same DISCORD_BOT_TOKEN and GALLERY_CHANNEL_ID as the gallery.

const IMAGE_RE = /\.(png|jpe?g|webp|gif)(\?|$)/i;
const MEMORY_MS = 2 * 60 * 1000;
let memo = { at: 0, body: null }; // shared by every visitor this Worker serves

function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
  });
}

function sized(url, width, height, max) {
  if (!url) return url;
  const w = width ? Math.min(max, width) : max; // never ask Discord to enlarge a small picture
  const h = width && height ? Math.round((w * height) / width) : null;
  const base = url.replace(/[?&]+$/, '');
  return base + (base.includes('?') ? '&' : '?') + `width=${w}` + (h ? `&height=${h}` : '');
}

function pictureOf(m) {
  for (const a of m.attachments || []) {
    if ((a.content_type || '').startsWith('image/') || IMAGE_RE.test(a.filename || '')) return { url: a.url, proxy: a.proxy_url, width: a.width, height: a.height };
  }
  for (const e of m.embeds || []) {
    const img = e.image || e.thumbnail;
    if (img && img.url) return { url: img.url, proxy: img.proxy_url, width: img.width, height: img.height };
  }
  return null;
}

async function pinnedMessages(env) {
  const headers = { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'User-Agent': 'StreetKingsSite (https://discord.gg, 1.2)' };
  // newer endpoint first (returns { items: [{ pinned_at, message }] }), then the older one (returns messages, newest pin first)
  let r = await fetch(`https://discord.com/api/v10/channels/${env.GALLERY_CHANNEL_ID}/messages/pins?limit=25`, { headers });
  if (r.ok) {
    const data = await r.json();
    return (data.items || []).map((it) => ({ ...it.message, pinned_at: it.pinned_at }));
  }
  r = await fetch(`https://discord.com/api/v10/channels/${env.GALLERY_CHANNEL_ID}/pins`, { headers });
  if (r.ok) return r.json();
  throw new Error(`discord_${r.status}`);
}

export async function onRequestGet({ env }) {
  if (memo.body && Date.now() - memo.at < MEMORY_MS) return json(memo.body, 120);
  if (!env.DISCORD_BOT_TOKEN || !env.GALLERY_CHANNEL_ID) return json({ featured: null, pins: [], error: 'not_configured' }, 60);

  const pins = [];
  try {
    for (const m of await pinnedMessages(env)) {
      const pic = pictureOf(m);
      if (!pic) continue;
      pins.push({
        url: pic.url,
        image: sized(pic.proxy, pic.width, pic.height, 1280) || pic.url,
        thumb: sized(pic.proxy, pic.width, pic.height, 640) || pic.url,
        width: pic.width, height: pic.height,
        author: (m.author && (m.author.global_name || m.author.username)) || '',
        avatar: m.author && m.author.avatar ? `https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=64` : null,
        caption: (m.content || '').replace(/<[@#&!:a-z0-9_]+>/gi, '').trim().slice(0, 280),
        pinnedAt: m.pinned_at || m.timestamp,
      });
      if (pins.length >= 8) break;
    }
  } catch (err) {
    return json({ featured: null, pins: [], error: String(err.message || err) }, 60);
  }

  // "featured" is the newest pin (the build of the week); "pins" is all of them, newest first
  memo = { at: Date.now(), body: { featured: pins[0] || null, pins } };
  return json(memo.body, 120);
}
