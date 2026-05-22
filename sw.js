const CACHE = 'liftos-shell-v30';
let restTimerTimeout = null;
let timerEndAt = 0;
let timerNotifyPayload = null;

function clearRestTimerSchedule() {
  if (restTimerTimeout) {
    clearTimeout(restTimerTimeout);
    restTimerTimeout = null;
  }
  timerEndAt = 0;
  timerNotifyPayload = null;
}

function showRestTimerNotification() {
  const payload = timerNotifyPayload;
  if (!payload) return;
  self.registration.showNotification(payload.title || 'Rest over — GO!', {
    body: payload.body || 'Start your next set',
    tag: 'liftos-rest',
    renotify: true,
  });
  clearRestTimerSchedule();
}

/** iOS throttles long SW timers — re-arm in chunks until endAt. */
function armRestTimerNotification() {
  if (restTimerTimeout) clearTimeout(restTimerTimeout);
  if (!timerEndAt || !timerNotifyPayload) return;
  const delay = timerEndAt - Date.now();
  if (delay <= 0) {
    showRestTimerNotification();
    return;
  }
  const chunkMs = Math.min(delay, 15000);
  restTimerTimeout = setTimeout(() => {
    restTimerTimeout = null;
    if (Date.now() >= timerEndAt) showRestTimerNotification();
    else armRestTimerNotification();
  }, chunkMs);
}

self.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'TIMER_CANCEL') {
    clearRestTimerSchedule();
    return;
  }
  if (data.type === 'TIMER_START') {
    clearRestTimerSchedule();
    timerEndAt = data.endAt || 0;
    timerNotifyPayload = {
      title: data.title || 'Rest over — GO!',
      body: data.body || 'Start your next set',
    };
    if (timerEndAt - Date.now() <= 0) return;
    armRestTimerNotification();
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
