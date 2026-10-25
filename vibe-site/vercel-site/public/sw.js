// Network first for pages and site data (always the newest edit), cache only as an offline fallback.
// Pictures are cached after the first view. The admin API is never touched.
const C = 'vc-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(C).then((c) => c.addAll(['/', '/favicon.svg', '/icon-192.png'])).catch(() => {})); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== C).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
function keep(req, res) { if (res.ok) { const copy = res.clone(); caches.open(C).then((c) => c.put(req, copy)); } return res; }
self.addEventListener('fetch', (e) => {
  const req = e.request; if (req.method !== 'GET') return;
  const u = new URL(req.url); if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate' || u.pathname.endsWith('.json') || u.pathname.endsWith('.webmanifest')) {
    e.respondWith(fetch(req).then((res) => keep(req, res)).catch(() => caches.match(req, { ignoreSearch: true }).then((m) => m || caches.match('/'))));
    return;
  }
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(u.pathname)) {
    e.respondWith(caches.match(req).then((m) => m || fetch(req).then((res) => keep(req, res))));
  }
});
