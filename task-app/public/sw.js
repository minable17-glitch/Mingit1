// 업무 챙김 서비스 워커: 시간 알림(웹 푸시)을 받아 보여 주고, 누르면 그 업무를 엶.
// (오프라인 캐시는 하지 않음 — 항상 최신 화면을 불러옴)
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(self.registration.showNotification(data.title || '🔔 업무 챙김', {
    body: data.body || '',
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    requireInteraction: true,
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    data: { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const win = wins.find((w) => w.url.startsWith(self.location.origin));
    if (win) {
      win.postMessage({ type: 'open-url', url });
      return win.focus();
    }
    return self.clients.openWindow(url);
  })());
});
