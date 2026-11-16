const CACHE = 'chemcontrol-v43';
const STATIC = [
  '/Jirayu/',
  '/Jirayu/index.html',
  '/Jirayu/manifest.json',
  '/Jirayu/icon.png',
  '/Jirayu/icon.svg',
];

// à¸•à¸´à¸”à¸•à¸±à¹‰à¸‡: cache à¹„à¸Ÿà¸¥à¹Œ static à¸—à¸±à¹‰à¸‡à¸«à¸¡à¸”
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// à¹€à¸›à¸´à¸”à¹ƒà¸Šà¹‰à¸‡à¸²à¸™: à¸¥à¸š cache à¹€à¸à¹ˆà¸²
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - index.html / navigation (à¸•à¸±à¸§à¹à¸­à¸ž) â†’ Network-first â†’ à¹€à¸‚à¹‰à¸²à¹à¸­à¸žà¸•à¸­à¸™à¸¡à¸µà¹€à¸™à¹‡à¸•à¹„à¸”à¹‰à¸•à¸±à¸§à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¹€à¸ªà¸¡à¸­, offline à¹ƒà¸Šà¹‰ cache
// - manifest / icon (static à¹„à¸¡à¹ˆà¸„à¹ˆà¸­à¸¢à¹€à¸›à¸¥à¸µà¹ˆà¸¢à¸™) â†’ Cache-first
// - Google Fonts â†’ Cache-first
// - GAS (script.google.com) â†’ Network-only (dynamic data)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GAS requests â€” network only (à¹„à¸¡à¹ˆ cache à¹€à¸žà¸£à¸²à¸° dynamic data)
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ error: 'offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // à¸•à¸±à¸§à¹à¸­à¸ž (index.html / navigation) â€” NETWORK-FIRST: à¹„à¸”à¹‰à¹€à¸§à¸­à¸£à¹Œà¸Šà¸±à¸™à¸¥à¹ˆà¸²à¸ªà¸¸à¸”à¸—à¸¸à¸à¸„à¸£à¸±à¹‰à¸‡à¸—à¸µà¹ˆà¹€à¸‚à¹‰à¸²à¹à¸­à¸ž
  const isHTML = e.request.mode === 'navigate'
    || url.pathname === '/Jirayu/'
    || url.pathname.endsWith('/index.html');
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() =>
        caches.match(e.request).then(hit => hit || caches.match('/Jirayu/index.html'))
      )
    );
    return;
  }

  // Google Fonts â€” cache-first
  if (url.hostname.includes('fonts.google') || url.hostname.includes('fonts.gstatic')) {
    e.respondWith(
      caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => new Response('', { status: 503 })))
    );
    return;
  }

  // Static assets à¸­à¸·à¹ˆà¸™ (manifest, icon) â€” cache-first, fallback network
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match('/Jirayu/index.html'));
    })
  );
});
