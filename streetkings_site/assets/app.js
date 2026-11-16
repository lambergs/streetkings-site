// StreetKings site. Edit the links here.
const SITE = {
  discord: 'https://discord.gg/puXrPjHDu2',
  connect: '', // your cfx.re join link, e.g. https://cfx.re/join/abc123 (empty = button scrolls to "How to join")
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

// live server status (functions/api/status.js)
fetch('/api/status').then((r) => (r.ok ? r.json() : null)).then((s) => {
  if (!s || s.error) return;
  const el = $('#status');
  el.classList.remove('hidden');
  el.classList.add(s.online ? 'on' : 'off');
  $('#statusText').textContent = s.online ? `${s.players} / ${s.max} in the city` : 'City is offline';
}).catch(() => {});

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
