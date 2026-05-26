const CACHE = 'meds-tracker-v1';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  // не чіпаємо сторонні запити (Telegram API, Google Apps Script)
  if (new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    // network-first: щоб підхопити оновлення, з офлайн-фолбеком на кеш
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match('./index.html')))
    );
    return;
  }

  // cache-first для решти ресурсів того ж походження
  e.respondWith(
    caches.match(req).then((cached) =>
      cached ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
    )
  );
});

// Best-effort фонове нагадування (час визначає браузер)
self.addEventListener('periodicsync', (e) => {
  if (e.tag === 'meds-reminder') e.waitUntil(showReminder());
});

async function showReminder() {
  // якщо вкладка відкрита — нагадування покаже сама сторінка
  const wins = await self.clients.matchAll({ type: 'window' });
  if (wins.some((c) => c.visibilityState === 'visible')) return;
  await self.registration.showNotification('💊 Трекер ліків', {
    body: 'Не забудь відмітити прийом ліків і показники здоровʼя.',
    tag: 'meds-reminder',
    icon: './icon.svg',
    badge: './icon.svg'
  });
}

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((cs) => {
      for (const c of cs) if ('focus' in c) return c.focus();
      if (self.clients.openWindow) return self.clients.openWindow('./');
    })
  );
});
