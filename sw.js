const CACHE = 'liftos-shell-v22';
let restTimerTimeout = null;

self.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'TIMER_CANCEL') {
    if (restTimerTimeout) clearTimeout(restTimerTimeout);
    restTimerTimeout = null;
    return;
  }
  if (data.type === 'TIMER_START') {
    if (restTimerTimeout) clearTimeout(restTimerTimeout);
    const delay = Math.max(0, (data.endAt || 0) - Date.now());
    if (delay <= 0) return;
    restTimerTimeout = setTimeout(() => {
      restTimerTimeout = null;
      self.registration.showNotification(data.title || 'Rest over — GO!', {
        body: data.body || 'Start your next set',
        tag: 'liftos-rest',
        renotify: true,
      });
    }, delay);
  }
});
const SHELL = ['/', '/index.html', '/config.json', '/manifest.json', '/icons/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api') || url.hostname.includes('amazonaws.com')) return;

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && SHELL.some((p) => url.pathname === p || url.pathname.endsWith(p))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/index.html'))),
  );
});
