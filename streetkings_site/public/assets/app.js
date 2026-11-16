// StreetKings site. Edit the links here.
const SITE = {
  discord: 'https://discord.gg/puXrPjHDu2',
  connect: 'https://cfx.re/join/bdx4xpl',
};

const $ = (s) => document.querySelector(s);

// links
document.querySelectorAll('[data-link]').forEach((a) => {
  const url = SITE[a.dataset.link];
  if (url) { a.href = url; } else { a.href = '#join'; a.removeAttribute('target'); }
});
$('#year').textContent = new Date().getFullYear();

// nav
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('solid', window.scrollY > 40);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();
const burger = $('#burger');
const links = $('#links');
burger.addEventListener('click', () => {
  const open = links.classList.toggle('open');
  burger.setAttribute('aria-expanded', String(open));
});
links.addEventListener('click', (e) => { if (e.target.tagName === 'A') links.classList.remove('open'); });

// hero: use assets/hero.jpg and assets/wordmark.png when they exist, the crown logo otherwise
const heroImg = new Image();
heroImg.onload = () => { const bg = $('#heroBg'); bg.style.backgroundImage = 'url(assets/hero.jpg)'; bg.classList.add('photo'); };
heroImg.src = 'assets/hero.jpg';
const wordmark = $('#wordmark');
const useLogo = () => { wordmark.remove(); $('#heroLogo').classList.remove('hidden'); };
if (wordmark.complete && wordmark.naturalWidth === 0) useLogo(); else wordmark.addEventListener('error', useLogo);

// live server status: asked straight from the FiveM server list (it allows browsers), /api/status as the backup
function showStatus(s) {
  const el = $('#status');
  el.classList.remove('hidden', 'on', 'off');
  el.classList.add(s.online ? 'on' : 'off');
  $('#statusText').textContent = s.online ? `${s.players} / ${s.max} in the city` : 'City is offline';
}
async function loadStatus() {
  const code = (SITE.connect.match(/cfx\.re\/join\/([a-z0-9]+)/i) || [])[1];
  if (code) {
    try {
      const r = await fetch(`https://frontend.cfx-services.net/api/servers/single/${code}`);
      if (r.ok) {
        const d = (await r.json()).Data || {};
        const seen = d.lastSeen ? Date.parse(d.lastSeen) : Date.now();
        const online = !Number.isFinite(seen) || Date.now() - seen < 10 * 60 * 1000;
        return showStatus({ online, players: online ? (d.clients ?? (d.players || []).length) : 0, max: d.sv_maxclients ?? d.svMaxclients ?? 0 });
      }
    } catch { /* fall back to /api/status */ }
  }
  try {
    const s = await fetch('/api/status').then((r) => (r.ok ? r.json() : null));
    if (s && !s.error) showStatus(s);
  } catch { /* leave the pill hidden */ }
}
loadStatus();
setInterval(loadStatus, 60000);

// gallery (functions/api/gallery.js reads the Discord #gallery channel): every post, newest first,
// the next page loads by itself as you scroll down (or with the button)
const grid = $('#galleryGrid');
const moreBtn = $('#galleryMore');
let cursor = null;
let loading = false;
let shown = 0;
grid.innerHTML = '<div class="shot skeleton"></div>'.repeat(6);

async function loadGallery() {
  if (loading) return;
  loading = true;
  moreBtn.disabled = true;
  let data;
  try {
    const r = await fetch('/api/gallery' + (cursor ? `?before=${cursor}` : ''));
    data = r.ok ? await r.json() : { images: [] };
  } catch { data = { images: [] }; }
  if (!shown) grid.innerHTML = '';
  addShots(data.images || []);
  cursor = data.next || null;
  // a page of text-only posts has no images: keep going until something shows or the history ends
  loading = false;
  if (cursor && !(data.images || []).length) return loadGallery();
  moreBtn.disabled = false;
  moreBtn.classList.toggle('hidden', !cursor);
  if (!shown) $('#galleryEmpty').classList.remove('hidden');
}

if ('IntersectionObserver' in window) {
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && cursor && !loading) loadGallery();
  }, { rootMargin: '600px' }).observe(moreBtn);
}
moreBtn.addEventListener('click', () => { if (cursor) loadGallery(); });
loadGallery();

function addShots(images) {
  images.forEach((img) => {
    shown++;
    const fig = document.createElement('figure');
    fig.className = 'shot';
    const el = document.createElement('img');
    el.loading = 'lazy';
    el.alt = img.caption || `Shot by ${img.author || 'a player'}`;
    el.src = img.thumb || img.url;
    if (img.width && img.height) { el.width = img.width; el.height = img.height; }
    el.addEventListener('error', () => fig.remove());
    const cap = document.createElement('figcaption');
    cap.textContent = img.author ? `by ${img.author}` : '';
    fig.append(el, cap);
    fig.addEventListener('click', () => openLightbox(img));
    grid.appendChild(fig);
  });
}

// build of the week (functions/api/featured.js): the newest pinned post in #gallery
fetch('/api/featured').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((data) => {
  const f = data && data.featured;
  if (!f) return;
  const img = $('#featImg');
  img.src = f.image || f.url;
  img.alt = f.caption || `Build by ${f.author || 'a player'}`;
  img.addEventListener('error', () => $('#featured').classList.add('hidden'));
  $('#featAuthor').textContent = f.author || 'StreetKings';
  if (f.avatar) { const av = $('#featAvatar'); av.src = f.avatar; av.classList.remove('hidden'); }
  $('#featCaption').textContent = f.caption || '';
  const card = $('#featured');
  card.classList.remove('hidden');
  card.addEventListener('click', () => openLightbox({ url: f.url, caption: f.caption, author: f.author }));
});

// drag strip leaderboard (sent by eastla_dragstrip to functions/api/leaderboard.js)
const LENGTHS = { 660: '1/8 mile', 1320: '1/4 mile', 2640: '1/2 mile' };
const lenLabel = (ft) => LENGTHS[ft] || `${ft} ft`;
let board = null;
let boardTab = 0;

function speed(ms) {
  if (typeof ms !== 'number') return '-';
  return board.units === 'mph' ? `${(ms * 2.236936).toFixed(1)} mph` : `${(ms * 3.6).toFixed(1)} km/h`;
}

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
  const strip = board.strips[boardTab] || board.strips[0];
  strip.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (i < 3) tr.className = `p${i + 1}`;
    const cells = [
      ['', null, `<span class="rank">${i + 1}</span>`],
      ['', r.name],
      ['car', r.car],
      ['t', `${r.et.toFixed(3)} s`],
      ['hide-sm', speed(r.trap)],
      ['hide-sm', typeof r.rt === 'number' ? r.rt.toFixed(3) : '-'],
      ['hide-sm', r.day || ''],
    ];
    cells.forEach(([cls, text, html]) => {
      const td = document.createElement('td');
      if (cls) td.className = cls;
      if (html) td.innerHTML = html; else td.textContent = text;
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

function renderRatings() {
  const list = $('#lbElo');
  list.innerHTML = '';
  if (!board.ratings.length) return;
  board.ratings.slice(0, 10).forEach((r) => {
    const li = document.createElement('li');
    const name = document.createElement('b');
    name.textContent = r.name;
    const elo = document.createElement('span');
    elo.textContent = r.elo;
    li.append(name, elo);
    list.appendChild(li);
  });
  $('#lbEloCard').classList.remove('hidden');
}

fetch('/api/leaderboard').then((r) => (r.ok ? r.json() : null)).catch(() => null).then((data) => {
  board = { units: 'kph', strips: [], ratings: [], ...(data || {}) };
  if (!Array.isArray(board.strips)) board.strips = [];
  if (!Array.isArray(board.ratings)) board.ratings = [];
  renderBoard();
  renderRatings();
  if (board.updatedAt) {
    $('#lbUpdated').textContent = `Updated ${new Date(board.updatedAt * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
  }
});

const lb = $('#lightbox');
function openLightbox(img) {
  $('#lbImg').src = img.url;
  $('#lbCap').textContent = [img.caption, img.author && `by ${img.author}`].filter(Boolean).join('  |  ');
  lb.classList.remove('hidden');
}
const closeLightbox = () => { lb.classList.add('hidden'); $('#lbImg').src = ''; };
$('#lbClose').addEventListener('click', closeLightbox);
lb.addEventListener('click', (e) => { if (e.target === lb) closeLightbox(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });

// contact form -> functions/api/contact.js -> Discord webhook (the webhook URL never reaches the browser)
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
  try {
    const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const res = await r.json().catch(() => ({}));
    if (r.ok && res.ok) {
      msg.className = 'form-msg ok';
      msg.textContent = 'Sent. Staff will reach out to you on Discord.';
      form.reset();
    } else {
      msg.className = 'form-msg err';
      msg.textContent = res.error || 'Could not send right now. Try again in a minute or message us on Discord.';
    }
  } catch {
    msg.className = 'form-msg err';
    msg.textContent = 'Could not send right now. Try again in a minute or message us on Discord.';
  }
  btn.disabled = false;
});
