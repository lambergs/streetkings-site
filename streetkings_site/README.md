# StreetKings website (free hosting on Cloudflare Pages)

Static site + three small server functions:
- `/api/gallery`  shows the latest images from your Discord #gallery channel
- `/api/contact`  sends the contact form to your Discord channel through the webhook
- `/api/status`   live player count from the FiveM server list

The webhook and bot token live in Cloudflare settings, never in these files, so nobody can steal them from the page.

## 1. Put the files on GitHub (free, no git needed)
1. github.com > New repository > name it `streetkings-site` > Create.
2. "uploading an existing file" > drag in everything inside this folder (index.html, assets, functions, README.md) > Commit.

## 2. Host it on Cloudflare Pages (free)
1. dash.cloudflare.com > Workers & Pages > Create > Pages > Connect to Git > pick `streetkings-site`.
2. Framework preset: None. Build command: empty. Output directory: `/`. Save and Deploy.
3. You get `streetkings-site.pages.dev`. A custom domain can be added later under Custom domains.

## 3. Settings > Variables and Secrets (Production), then redeploy
| Name | Type | Value |
|---|---|---|
| `DISCORD_WEBHOOK` | Secret | a NEW webhook URL for your staff/contact channel |
| `DISCORD_BOT_TOKEN` | Secret | bot token (step 4) |
| `GALLERY_CHANNEL_ID` | Text | ID of #gallery |
| `CFX_CODE` | Text | the code from your cfx.re/join/xxxxxx link |

Any one left empty just switches that part off; the rest of the site still works.

## 4. Gallery bot (Discord can only be read by a bot, webhooks can only post)
1. discord.com/developers > your Streetkings app > Bot > Reset Token > copy it into `DISCORD_BOT_TOKEN`.
2. Same page: turn on **Message Content Intent** (needed to see image attachments).
3. OAuth2 > URL Generator: scope `bot`, permissions **View Channels** + **Read Message History** > open the link > add to your server.
4. Discord > Settings > Advanced > Developer Mode on > right-click #gallery > Copy Channel ID > `GALLERY_CHANNEL_ID`.

Every image ever posted in #gallery shows on the site, newest first. The next 100 posts load by themselves as visitors scroll down. New posts appear within 10 minutes, and a deleted post leaves the site on the next refresh.

## 5. Your own pictures
- `assets/hero.jpg` big background photo behind the hero (1920x1080 or wider). Optional.
- `assets/wordmark.png` white STREET KINGS logo on a transparent background, shown instead of the crown logo. Optional.
- Links: top of `assets/app.js` (`discord`, `connect`).
