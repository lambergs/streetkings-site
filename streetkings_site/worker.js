// Cloudflare Worker entry: /api/* runs the handlers in functions/api, everything else is the static site in public/.
import { onRequestGet as gallery } from './functions/api/gallery.js';
import { onRequestGet as featured } from './functions/api/featured.js';
import { onRequestGet as status } from './functions/api/status.js';
import { onRequestPost as contact } from './functions/api/contact.js';
import { onRequestGet as boardGet, onRequestPost as boardPost } from './functions/api/leaderboard.js';

const ROUTES = {
  'GET /api/gallery': gallery,
  'GET /api/featured': featured,
  'GET /api/status': status,
  'POST /api/contact': contact,
  'GET /api/leaderboard': boardGet,
  'POST /api/leaderboard': boardPost,
};

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith('/api/')) {
      const handler = ROUTES[`${request.method} ${pathname.replace(/\/+$/, '')}`];
      if (!handler) return new Response('Not found', { status: 404 });
      try {
        return await handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
      } catch (err) {
        console.error(err);
        return new Response(JSON.stringify({ ok: false, error: 'Server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
