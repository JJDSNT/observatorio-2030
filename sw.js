const CACHE = 'observatorio-2030-v4';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.webmanifest',
  './favicon.ico',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './data/timeline.json',
  './data/topics.json',
  './data/events.json',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  const isFreshContent = url.pathname.includes('/data/')
    || url.pathname.endsWith('/app.js')
    || url.pathname.endsWith('/style.css');

  if (isFreshContent) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(async response => {
        const copy = response.clone();
        const cache = await caches.open(CACHE);
        await cache.put(event.request, copy);
        return response;
      }).catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
      const copy = response.clone();
      const cache = await caches.open(CACHE);
      await cache.put(event.request, copy);
      return response;
    })),
  );
});

self.addEventListener('push', event => {
  let data = {
    title: 'Observatório 2030',
    body: 'Há um novo marco no Observatório 2030.',
    url: './#marcos',
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch (_) {
    // Keep the safe default message when a provider sends an empty payload.
  }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon || './assets/icons/icon-192.png',
    badge: data.badge || './assets/icons/icon-192.png',
    data: { url: data.url || './#marcos' },
    tag: data.tag || 'observatorio-2030-marco',
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const target = new URL(event.notification.data?.url || './#marcos', self.location.href).href;
    const existing = windows.find(windowClient => windowClient.url.startsWith(self.location.origin));
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return self.clients.openWindow(target);
  }));
});
