const CACHE = 'chemcontrol-v25';
const STATIC = [
  '/Jirayu/',
  '/Jirayu/index.html',
  '/Jirayu/manifest.json',
  '/Jirayu/icon.png',
  '/Jirayu/icon.svg',
];

// ติดตั้ง: cache ไฟล์ static ทั้งหมด
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC))
  );
  self.skipWaiting();
});

// เปิดใช้งาน: ลบ cache เก่า
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - index.html / navigation (ตัวแอพ) → Network-first → เข้าแอพตอนมีเน็ตได้ตัวล่าสุดเสมอ, offline ใช้ cache
// - manifest / icon (static ไม่ค่อยเปลี่ยน) → Cache-first
// - Google Fonts → Cache-first
// - GAS (script.google.com) → Network-only (dynamic data)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // GAS requests — network only (ไม่ cache เพราะ dynamic data)
  if (url.hostname.includes('script.google.com')) {
    e.respondWith(fetch(e.request).catch(() => new Response(
      JSON.stringify({ error: 'offline' }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // ตัวแอพ (index.html / navigation) — NETWORK-FIRST: ได้เวอร์ชันล่าสุดทุกครั้งที่เข้าแอพ
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

  // Google Fonts — cache-first
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

  // Static assets อื่น (manifest, icon) — cache-first, fallback network
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
