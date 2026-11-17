// StreetKings Roleplay site. Edit the links here.
const SITE = {
  discord: 'https://discord.gg/puXrPjHDu2',
  connect: 'https://cfx.re/join/bdx4xpl', // your cfx.re join link
  galleryFirst: 15, // pictures shown at first
  galleryStep: 10,  // pictures each "Load more" adds
  heroImage: 'assets/hero.webp', // the hero photo when 3D is unavailable
  car: true, // the scroll story with the 3D Civic Type R (desktop and tablet; phones show the photo showroom)
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const getJSON = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// ── links, year ──────────────────────────────────────────────
$$('[data-link]').forEach((a) => {
  const url = SITE[a.dataset.link];
  if (url) a.href = url; else a.removeAttribute('target');
});
$('#year').textContent = new Date().getFullYear();

const joinCode = (SITE.connect.match(/cfx\.re\/join\/([a-z0-9]+)/i) || [])[1];
if (joinCode) {
  $('#srvCmd').textContent = `connect cfx.re/join/${joinCode}`;
  $('#srvConnectRow').hidden = false;
  $('#srvCopy').addEventListener('click', async (e) => {
    try { await navigator.clipboard.writeText($('#srvCmd').textContent); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Select it'; }
    setTimeout(() => { e.target.textContent = 'Copy'; }, 1800);
  });
}

// ── preloader ────────────────────────────────────────────────
let loadedOnce = false;
function markLoaded() {
  if (loadedOnce) return;
  loadedOnce = true;
  document.documentElement.classList.add('loaded');
}
addEventListener('load', () => setTimeout(markLoaded, 250));
setTimeout(markLoaded, 2600); // never hold the page for a slow image

// ── nav ──────────────────────────────────────────────────────
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

const burger = $('#burger');
const links = $('#links');
function setMenu(open) {
  links.classList.toggle('open', open);
  burger.setAttribute('aria-expanded', String(open));
  document.body.style.overflow = open ? 'hidden' : '';
}
burger.addEventListener('click', () => setMenu(!links.classList.contains('open')));
links.addEventListener('click', (e) => { if (e.target.tagName === 'A') setMenu(false); });

// highlight the section in view
const navLinks = new Map($$('#links a').map((a) => [a.getAttribute('href').slice(1), a]));
const spy = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    navLinks.forEach((a) => a.classList.remove('active'));
    const a = navLinks.get(en.target.id);
    if (a) a.classList.add('active');
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((_, id) => { const el = document.getElementById(id); if (el) spy.observe(el); });

// ── reveal on scroll ─────────────────────────────────────────
const revealer = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); revealer.unobserve(en.target); } });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
function watchReveals(root = document) { $$('.reveal:not(.in)', root).forEach((el) => revealer.observe(el)); }
watchReveals();

// ── 3D tilt on cards (mouse only) ────────────────────────────
if (!reduced && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $$('[data-tilt]').forEach((el) => {
    const max = el.classList.contains('about-art') ? 5 : 7;
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      el.style.setProperty('--ry', `${(x - 0.5) * max * 2}deg`);
      el.style.setProperty('--rx', `${(0.5 - y) * max * 2}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
    el.addEventListener('pointerleave', () => { el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg'); });
  });
}

// ── roleplay lanes ───────────────────────────────────────────
const lanes = $$('.lane');
const pickLane = (lane) => lanes.forEach((l) => l.classList.toggle('on', l === lane));
lanes.forEach((l) => {
  l.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') pickLane(l); });
  l.addEventListener('click', () => pickLane(l));
  l.addEventListener('focus', () => pickLane(l));
});

// ── live numbers ─────────────────────────────────────────────
function countTo(el, value) {
  const target = Math.max(0, Math.round(value));
  if (reduced || !('IntersectionObserver' in window)) { el.textContent = target.toLocaleString('en-US'); return; }
  const from = Number(el.dataset.shown || 0);
  el.dataset.shown = target;
  const start = performance.now(), dur = 1100;
  const tick = (now) => {
    const k = Math.min((now - start) / dur, 1);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (target - from) * eased).toLocaleString('en-US');
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
// a stat tile only appears once its real value is known
function setStat(name, value) {
  const tile = $(`.stat[data-stat="${name}"]`);
  if (!tile || typeof value !== 'number' || !Number.isFinite(value)) return;
  tile.hidden = false;
  $('#numbers').hidden = false;
  countTo($('b', tile), value);
  watchReveals($('#numbers'));
}

// ── server status: asked straight from the FiveM server list, /api/status as the backup ──
function showStatus(s) {
  const text = s.online ? `${s.players} / ${s.max} in the city` : 'City is offline';
  for (const [chip, label] of [[$('#status'), $('#statusText')], [$('#navStatus'), $('#navStatus b')]]) {
    chip.hidden = false;
    chip.classList.toggle('on', s.online);
    chip.classList.toggle('off', !s.online);
    label.textContent = text;
  }
  const chip = $('#srvChip');
  chip.classList.toggle('on', s.online);
  chip.classList.toggle('off', !s.online);
  $('#srvState').textContent = s.online ? 'Online' : 'Offline';
  if (s.online && s.max > 0) {
    $('#srvMeter').hidden = false;
    $('#srvPlayers').textContent = `${s.players} / ${s.max}`;
    $('#srvFill').style.width = `${Math.min(100, (s.players / s.max) * 100)}%`;
    setStat('players', s.players);
    setStat('slots', s.max);
  } else {
    $('#srvMeter').hidden = true;
  }
}
async function loadStatus() {
  if (joinCode) {
    try {
      const r = await fetch(`https://frontend.cfx-services.net/api/servers/single/${joinCode}`);
      if (r.ok) {
        const d = (await r.json()).Data || {};
        const seen = d.lastSeen ? Date.parse(d.lastSeen) : Date.now();
        const online = !Number.isFinite(seen) || Date.now() - seen < 10 * 60 * 1000;
        return showStatus({ online, players: online ? (d.clients ?? (d.players || []).length) : 0, max: d.sv_maxclients ?? d.svMaxclients ?? 0 });
      }
    } catch { /* fall back to /api/status */ }
  }
  const s = await getJSON('/api/status');
  if (s && !s.error) showStatus(s); else $('#srvState').textContent = 'Unknown';
}
loadStatus();
setInterval(loadStatus, 60000);

// ── Discord community counts (functions/api/community.js) ────
getJSON('/api/community').then((c) => {
  if (!c || c.error) return;
  setStat('members', c.members);
  setStat('online', c.online);
  if (c.name) $('#dcName').textContent = c.name;
  if (typeof c.members === 'number') {
    $('#dcCounts').textContent = `${c.members.toLocaleString('en-US')} members` + (typeof c.online === 'number' ? `, ${c.online.toLocaleString('en-US')} online now` : '');
  }
  if (c.icon) { const i = $('#dcIcon'); i.src = c.icon; i.hidden = false; }
});

// ── lightbox ─────────────────────────────────────────────────
const lb = $('#lightbox');
let lbList = [];
let lbAt = 0;
function showLightbox() {
  const img = lbList[lbAt];
  if (!img) return;
  $('#lbImg').src = img.url;
  $('#lbImg').alt = img.caption || `Picture by ${img.author || 'a player'}`;
  $('#lbCap').textContent = [img.caption, img.author && `by ${img.author}`].filter(Boolean).join('  ·  ');
  $('#lbPos').textContent = lbList.length > 1 ? `${lbAt + 1} / ${lbList.length}` : '';
  $('#lbPrev').hidden = $('#lbNext').hidden = lbList.length < 2;
}
function openLightbox(list, at = 0) {
  lbList = list; lbAt = at;
  lb.hidden = false;
  document.body.style.overflow = 'hidden';
  showLightbox();
}
function closeLightbox() {
  lb.hidden = true;
  document.body.style.overflow = '';
  $('#lbImg').src = '';
}
const stepLightbox = (d) => { lbAt = (lbAt + d + lbList.length) % lbList.length; showLightbox(); };
$('#lbClose').addEventListener('click', closeLightbox);
$('#lbPrev').addEventListener('click', () => stepLightbox(-1));
$('#lbNext').addEventListener('click', () => stepLightbox(1));
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.tagName === 'FIGURE') closeLightbox(); });
addEventListener('keydown', (e) => {
  if (lb.hidden) return;
  if (e.key === 'Escape') closeLightbox();
  if (e.key === 'ArrowLeft') stepLightbox(-1);
  if (e.key === 'ArrowRight') stepLightbox(1);
});
let touchX = null;
lb.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
lb.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50 && lbList.length > 1) stepLightbox(dx < 0 ? 1 : -1);
}, { passive: true });

// ── gallery: the newest 15, "Load more" adds 10 ──────────────
const grid = $('#galleryGrid');
const moreBtn = $('#galleryMore');
const pool = [];      // every picture fetched so far, newest first
let shown = 0;        // how many of the pool are on the page
let cursor = null;    // where the next API page starts (null = no more)
let fetching = false;
let firstPage = null; // resolved with the first page, shared with the 3D showroom

grid.innerHTML = '<div class="shot skeleton big"></div>' + '<div class="shot skeleton"></div>'.repeat(5);

async function fetchPage() {
  const data = (await getJSON('/api/gallery' + (cursor ? `?before=${cursor}` : ''))) || { images: [] };
  const images = Array.isArray(data.images) ? data.images : [];
  pool.push(...images);
  cursor = data.next || null;
  return images;
}

function addShot(img, index) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'shot' + (index === 0 ? ' big' : '');
  const el = document.createElement('img');
  el.loading = 'lazy';
  el.decoding = 'async';
  el.alt = img.caption || `Picture by ${img.author || 'a player'}`;
  el.src = index === 0 ? bigger(img, 1280) : (img.thumb || img.url);
  el.addEventListener('error', () => { b.hidden = true; });
  const cap = document.createElement('span');
  cap.textContent = img.author ? `by ${img.author}` : '';
  b.append(el, cap);
  b.addEventListener('click', () => openLightbox(pool.slice(0, shown), index));
  grid.appendChild(b);
}

// a larger Discord thumbnail than the 640 px one the API hands out
function bigger(img, width) {
  const t = img.thumb || '';
  if (!/[?&]width=\d+/.test(t) || !img.width || !img.height) return t || img.url;
  const w = Math.min(width, img.width);
  return t.replace(/([?&])width=\d+/, `$1width=${w}`).replace(/([?&])height=\d+/, `$1height=${Math.round((w * img.height) / img.width)}`);
}

async function reveal(count) {
  if (fetching) return;
  fetching = true;
  moreBtn.disabled = true;
  // top the pool up from the API until it can cover the request or runs out
  while (pool.length < shown + count && (cursor || shown === 0 && pool.length === 0 && firstPage === null)) {
    const before = pool.length;
    const got = await fetchPage();
    if (firstPage === null) firstPage = got;
    if (pool.length === before && !cursor) break;
  }
  if (firstPage === null) firstPage = [];
  if (shown === 0) grid.innerHTML = '';
  const upto = Math.min(shown + count, pool.length);
  for (let i = shown; i < upto; i++) addShot(pool[i], i);
  shown = upto;
  fetching = false;
  moreBtn.disabled = false;
  moreBtn.hidden = !(shown < pool.length || cursor);
  $('#galleryEmpty').hidden = shown > 0;
  $('#galleryCount').textContent = shown ? `Showing the latest ${shown}` : '';
}
moreBtn.addEventListener('click', () => reveal(SITE.galleryStep));
const galleryReady = reveal(SITE.galleryFirst);

// ── build of the week: pinned posts in #gallery ──────────────
let pins = [];
function showFeatured(i) {
  const f = pins[i];
  if (!f) return;
  const img = $('#featImg');
  img.src = f.image || f.url;
  img.alt = f.caption || `Build by ${f.author || 'a player'}`;
  $('#featAuthor').textContent = f.author || 'StreetKings';
  const av = $('#featAvatar');
  if (f.avatar) { av.src = f.avatar; av.hidden = false; } else av.hidden = true;
  $('#featCaption').textContent = f.caption || '';
  $('#featCaption').hidden = !f.caption;
  $('#featOpen').onclick = () => openLightbox(pins, i);
  $$('#featMore button').forEach((b, n) => b.classList.toggle('on', n === i));
}
const featuredReady = getJSON('/api/featured').then((data) => {
  pins = (data && Array.isArray(data.pins) && data.pins.length ? data.pins : (data && data.featured ? [data.featured] : [])).slice(0, 8);
  if (!pins.length) return;
  $('#featured').hidden = false;
  const more = $('#featMore');
  if (pins.length > 1) {
    pins.forEach((p, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Featured build ${i + 1}`);
      const im = document.createElement('img');
      im.src = p.thumb || p.image || p.url; im.alt = ''; im.loading = 'lazy';
      b.appendChild(im);
      b.addEventListener('click', () => showFeatured(i));
      more.appendChild(b);
    });
  }
  showFeatured(0);
  watchReveals($('#featured'));
  // the small card in the hero
  $('#heroCardImg').src = pins[0].thumb || pins[0].image || pins[0].url;
  $('#heroCardBy').textContent = pins[0].author ? `by ${pins[0].author}` : 'See the build';
  $('#heroCard').hidden = false;
});

// ── drag strip leaderboard ───────────────────────────────────
const LENGTHS = { 660: '1/8 mile', 1320: '1/4 mile', 2640: '1/2 mile' };
const lenLabel = (ft) => LENGTHS[ft] || `${ft} ft`;
let board = null;
let boardTab = 0;
const speed = (ms) => (typeof ms !== 'number' ? '-' : board.units === 'mph' ? `${(ms * 2.236936).toFixed(1)} mph` : `${(ms * 3.6).toFixed(1)} km/h`);

function renderBoard() {
  const tabs = $('#lbTabs');
  const body = $('#lbBody');
  tabs.innerHTML = '';
  body.innerHTML = '';
  if (!board.strips.length) {
    body.innerHTML = '<tr><td colspan="7" class="muted center">No ranked runs yet. Be the first on the board.</td></tr>';
    return;
  }
  board.strips.forEach((s, i) => {
    const b = document.createElement('button');
    b.className = 'lb-tab' + (i === boardTab ? ' on' : '');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = `${s.label} · ${lenLabel(s.lengthFt)}`;
    b.addEventListener('click', () => { boardTab = i; renderBoard(); });
    tabs.appendChild(b);
  });
  (board.strips[boardTab] || board.strips[0]).rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i < 3) tr.className = `p${i + 1}`;
    [['', null, i + 1], ['', r.name], ['car', r.car], ['t', `${r.et.toFixed(3)} s`], ['hide-sm', speed(r.trap)],
      ['hide-sm', typeof r.rt === 'number' ? r.rt.toFixed(3) : '-'], ['hide-sm', r.day || '']].forEach(([cls, text, rank]) => {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      if (rank) { const s = document.createElement('span'); s.className = 'rank'; s.textContent = rank; td.appendChild(s); } else td.textContent = text;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}
getJSON('/api/leaderboard').then((data) => {
  board = { units: 'kph', strips: [], ratings: [], ...(data || {}) };
  if (!Array.isArray(board.strips)) board.strips = [];
  if (!Array.isArray(board.ratings)) board.ratings = [];
  renderBoard();
  const list = $('#lbElo');
  board.ratings.slice(0, 10).forEach((r) => {
    const li = document.createElement('li');
    const name = document.createElement('b'); name.textContent = r.name;
    const elo = document.createElement('span'); elo.textContent = r.elo;
    li.append(name, elo);
    list.appendChild(li);
  });
  $('#lbEloCard').hidden = !board.ratings.length;
  if (board.updatedAt) $('#lbUpdated').textContent = `Updated ${new Date(board.updatedAt * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
});

// ── contact form -> /api/contact -> Discord webhook ──────────
const form = $('#contactForm');
const msg = $('#formMsg');
const opened = Date.now();
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  if (!data.name.trim() || !data.discord.trim() || data.message.trim().length < 10) {
    msg.className = 'form-msg err';
    msg.textContent = 'Fill in your name, Discord username and a message of at least 10 characters.';
    return;
  }
  data.elapsed = Date.now() - opened;
  const btn = $('#sendBtn');
  btn.disabled = true;
  msg.className = 'form-msg';
  msg.textContent = 'Sending...';
  const fail = 'Could not send right now. Try again in a minute or message us on Discord.';
  try {
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const res = await r.json().catch(() => ({}));
    if (r.ok && res.ok) {
      msg.className = 'form-msg ok';
      msg.textContent = 'Sent. Staff will reach out to you on Discord.';
      form.reset();
    } else {
      msg.className = 'form-msg err';
      msg.textContent = res.error || fail;
    }
  } catch {
    msg.className = 'form-msg err';
    msg.textContent = fail;
  }
  btn.disabled = false;
});

// ── 3D showroom (assets/hero3d.js). The hero works without it. ──
// Pictures, in order: your own hero shot, staff-pinned builds, then recent in-game screenshots (no GIFs, no small or odd-shaped images).
function showroomImages() {
  const list = [];
  const seen = new Set();
  const add = (img, pinned) => { if (img && img.url && !seen.has(img.url)) { seen.add(img.url); list.push({ ...img, pinned }); } };
  pins.forEach((p) => add(p, true));
  (firstPage || []).filter((i) => i.width >= 1200 && i.width / i.height >= 1.6 && i.width / i.height <= 2.2 && !/\.gif(\?|#|$)/i.test(i.url)).forEach((i) => add(i, false));
  // with too few pictures from Discord, the site's own hero shot fills in
  if (list.length < 5) list.unshift({ url: SITE.heroImage, thumb: SITE.heroImage, local: true, caption: 'Shot in the city', author: '' });
  return list.slice(0, 14).map((i) => ({ ...i, texture: i.local ? i.url : bigger(i, 1024) }));
}
function webglOK() {
  try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch { return false; }
}
async function startShowroom() {
  const canvas = $('#stage');
  if (!webglOK()) return;
  await Promise.race([Promise.allSettled([galleryReady, featuredReady]), new Promise((r) => setTimeout(r, 3500))]);
  try {
    const { createShowroom } = await import('./hero3d.js?v=8');
    const images = showroomImages();
    const stage = await createShowroom({
      canvas, images, reduced,
      wordmark: 'assets/wordmark.webp',
      car: false, // the 3D car lives in the scroll story; the showroom is the lighter fallback
      onOpen: (i) => openLightbox(images, i),
      onFront: (i) => {
        const img = images[i] || {};
        $('#ctrlKicker').textContent = img.pinned ? 'Build of the week' : img.local ? 'StreetKings' : 'From the gallery';
        $('#ctrlTitle').textContent = img.author ? `by ${img.author}` : (img.caption || '');
      },
    });
    if (!stage) return;
    $('#hero').classList.add('has-3d');
    $('#heroCtrl').hidden = false;
    $('#ctrlPrev').addEventListener('click', () => stage.turn(-1));
    $('#ctrlNext').addEventListener('click', () => stage.turn(1));
    window.__showroom = stage;
  } catch (err) {
    console.warn('3D showroom unavailable, showing the photo instead.', err);
  }
}

// ── scroll story (assets/story3d.js): the car in a studio, the camera travelling round it as the page scrolls ──
// Desktop and tablet with WebGL. Phones, and anything that fails here, fall back to the showroom above.
async function startStory() {
  const hero = $('#hero');
  const canvas = $('#stage');
  const { createStory } = await import('./story3d.js?v=8');
  const chapters = $$('.chapter');
  const stage = await createStory({
    canvas, reduced,
    onChapter: (i, total) => {
      hero.dataset.ch = i;
      chapters.forEach((c) => c.classList.toggle('on', Number(c.dataset.ch) === i));
      $('#storyNow').textContent = String(i + 1).padStart(2, '0');
      $('#storyAll').textContent = String(total).padStart(2, '0');
      if (i !== 4) stage && stage.resetTurn();
    },
  });
  if (!stage) throw new Error('no WebGL renderer');
  hero.classList.add('story-on', 'has-3d');
  hero.dataset.ch = hero.dataset.ch || 0;
  $('#storyMeter').hidden = false;
  $$('#swatches button').forEach((b) => b.addEventListener('click', () => {
    stage.setPaint(b.dataset.paint);
    $$('#swatches button').forEach((x) => x.classList.toggle('on', x === b));
  }));
  window.__story = stage;
}
if (SITE.car && webglOK() && matchMedia('(min-width: 761px)').matches) {
  startStory().catch((err) => { console.warn('Scroll story unavailable, using the showroom.', err); startShowroom(); });
} else {
  startShowroom();
}
