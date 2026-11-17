// GET /api/gallery[?before=<messageId>] -> every image posted in the Discord #gallery channel, newest first, one page at a time.
// Each page reads 100 messages; "next" is the cursor for the page after it (null at the very first post).
// Needs two Cloudflare Pages environment variables:
//   DISCORD_BOT_TOKEN   (secret)  bot of your Discord app, invited with View Channel + Read Message History, Message Content Intent on
//   GALLERY_CHANNEL_ID            right-click the #gallery channel > Copy Channel ID (Developer Mode on)
// Webhooks can only post, never read, which is why this uses a bot.

const IMAGE_RE = /\.(png|jpe?g|webp|gif)(\?|$)/i;

function json(body, maxAge) {
  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}, s-maxage=${maxAge}`,
    },
  });
}

function sized(url, width, height) {
  if (!url) return url;
  const w = width ? Math.min(640, width) : 640; // never ask Discord to enlarge a small picture
  const h = width && height ? Math.round((w * height) / width) : null;
  const base = url.replace(/[?&]+$/, '');
  return base + (base.includes('?') ? '&' : '?') + `width=${w}` + (h ? `&height=${h}` : '');
}

// workers.dev has no shared edge cache, so pages are also kept in this Worker's memory for 2 minutes:
// a busy hour costs Discord a few dozen calls instead of one per visitor
const MEMORY_MS = 2 * 60 * 1000;
const memory = new Map(); // cursor -> { at, body }

export async function onRequestGet({ env, request, waitUntil }) {
  const before = new URL(request.url).searchParams.get('before');
  if (before && !/^\d{15,22}$/.test(before)) return json({ images: [], next: null }, 60);

  const mem = memory.get(before || '');
  if (mem && Date.now() - mem.at < MEMORY_MS) return json(mem.body, 120);

  const cache = caches.default;
  const key = new Request(new URL(`/api/gallery${before ? `?before=${before}` : ''}`, request.url).toString(), { method: 'GET' });
  const hit = await cache.match(key).catch(() => null);
  if (hit) return hit;

  if (!env.DISCORD_BOT_TOKEN || !env.GALLERY_CHANNEL_ID) {
    return json({ images: [], next: null, error: 'not_configured' }, 60);
  }

  const api = `https://discord.com/api/v10/channels/${env.GALLERY_CHANNEL_ID}/messages?limit=100${before ? `&before=${before}` : ''}`;
  const r = await fetch(api, {
    headers: { Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'User-Agent': 'StreetKingsSite (https://discord.gg, 1.1)' },
  });
  if (!r.ok) return json({ images: [], next: null, error: `discord_${r.status}` }, 60);

  const messages = await r.json();
  const images = [];
  for (const m of messages) {
    const author = (m.author && (m.author.global_name || m.author.username)) || '';
    const caption = (m.content || '').replace(/<[@#&!:a-z0-9_]+>/gi, '').trim().slice(0, 140);

    for (const a of m.attachments || []) {
      const isImage = (a.content_type || '').startsWith('image/') || IMAGE_RE.test(a.filename || '');
      if (!isImage) continue;
      images.push({ url: a.url, thumb: sized(a.proxy_url, a.width, a.height), width: a.width, height: a.height, author, caption, at: m.timestamp });
    }
    for (const e of m.embeds || []) {
      const img = e.image || e.thumbnail;
      if (img && img.url) {
        images.push({ url: img.url, thumb: sized(img.proxy_url, img.width, img.height) || img.url, width: img.width, height: img.height, author, caption, at: m.timestamp });
      }
    }
  }

  // a full page means there may be older posts; the last message id is where the next page starts
  const next = messages.length === 100 ? messages[messages.length - 1].id : null;

  // Discord image links are signed and expire after about a day; 10 minutes of cache keeps them fresh.
  if (memory.size > 200) memory.clear();
  memory.set(before || '', { at: Date.now(), body: { images, next } });
  const res = json({ images, next }, 600);
  waitUntil(cache.put(key, res.clone()).catch(() => {}));
  return res;
}
