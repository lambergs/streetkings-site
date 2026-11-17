# StreetKings website (free hosting on Cloudflare Workers)

Static site + three small server functions:
- `/api/gallery`  shows the latest images from your Discord #gallery channel
- `/api/contact`  sends the contact form to your Discord channel through the webhook
- `/api/status`   live player count from the FiveM server list

The webhook and bot token live in Cloudflare settings, never in these files, so nobody can steal them from the page.

Folder layout: `public/` is the site, `functions/api/` the three handlers, `worker.js` routes `/api/*` to them, `wrangler.jsonc` tells Cloudflare how to build it.

## 1. Put the files on GitHub (free, no git needed)
1. github.com > your `streetkings-site` repository.
2. Upload everything in this folder (public, functions, worker.js, wrangler.jsonc, README.md) > Commit.
   If an older upload has `index.html` or `assets` at the top level, delete those (the site now lives in `public/`).

## 2. Cloudflare (Workers)
The repository is connected to the Worker `streetkings-site`; every commit redeploys it by itself.
The Worker name in `wrangler.jsonc` must stay `streetkings-site`.

## 3. Worker > Settings > Variables and Secrets
| Name | Type | Value |
|---|---|---|
| `DISCORD_WEBHOOK` | Secret | a NEW webhook URL for your staff/contact channel |
| `DISCORD_BOT_TOKEN` | Secret | bot token (step 4) |
| `GALLERY_CHANNEL_ID` | Text | ID of #gallery |
| `CFX_CODE` | Text | the code from your cfx.re/join/xxxxxx link |

Any one left empty just switches that part off; the rest of the site still works. After saving, open the newest deployment or push any commit so the Worker picks them up.

## 4. Gallery bot (Discord can only be read by a bot, webhooks can only post)
1. discord.com/developers > your Streetkings app > Bot > Reset Token > copy it into `DISCORD_BOT_TOKEN`.
2. Same page: turn on **Message Content Intent** (needed to see image attachments).
3. OAuth2 > URL Generator: scope `bot`, permissions **View Channels** + **Read Message History** > open the link > add to your server.
4. Discord > Settings > Advanced > Developer Mode on > right-click #gallery > Copy Channel ID > `GALLERY_CHANNEL_ID`.

Every image ever posted in #gallery shows on the site, newest first. The next 100 posts load by themselves as visitors scroll down. New posts appear within 10 minutes, and a deleted post leaves the site on the next refresh.

## 5. Your own pictures
- `public/assets/hero.jpg` big background photo behind the hero (1920x1080 or wider). Optional.
- `public/assets/wordmark.png` white STREET KINGS logo on a transparent background, shown instead of the crown logo. Optional.
- Links: top of `public/assets/app.js` (`discord`, `connect`).

## 6. The 3D showroom (hero)
- `public/assets/hero3d.js` draws it with Three.js (loaded from cdn.jsdelivr.net, version pinned in `index.html`). Without WebGL the hero shows `assets/hero.webp`.
- Screens show, in order: posts pinned in #gallery (newest pin = Build of the week), then recent in-game screenshots (no GIFs, no small or odd-shaped pictures). Pin up to 8 posts to choose what leads the page.
- Gallery: 15 newest, "Load more" adds 10. Change `galleryFirst` / `galleryStep` at the top of `public/assets/app.js`.
- `/api/community` reads real member counts from the Discord invite (no extra setting needed).
- After changing `style.css`, `app.js` or `hero3d.js`, raise the `?v=5` number in `index.html` and in the `import('./hero3d.js?v=5')` line of `app.js`.
