const CACHE = 'auxos-shell-v18';
let restTimerTimeout = null;
let timerEndAt = 0;
let timerGoPayload = null;   // { title, body } shown when rest ends
let timerNextLabel = '';     // "Next: …" line shown live during rest
let restProgressShown = false; // first live banner alerts; later updates are silent
let restDoneFired = false;     // guard: the rest-over notification fires exactly once

const REST_TAG = 'auxos-rest';

function clearRestTimerSchedule() {
  if (restTimerTimeout) {
    clearTimeout(restTimerTimeout);
    restTimerTimeout = null;
  }
  timerEndAt = 0;
  timerGoPayload = null;
  timerNextLabel = '';
  restProgressShown = false;
  restDoneFired = false;
}

/** True when an Auxos window is open and visible — the in-app overlay covers it. */
async function hasVisibleClient() {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    return clients.some((c) => c.visibilityState === 'visible' || c.focused);
  } catch {
    return false;
  }
}

async function closeRestNotifications() {
  try {
    const ns = await self.registration.getNotifications({ tag: REST_TAG });
    ns.forEach((n) => n.close());
  } catch { /* ignore */ }
}

function formatRemaining(totalSec) {
  const s = Math.max(0, totalSec);
  if (s < 60) return `${s}s left`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')} left`;
}

/** Live "resting" notification with remaining time + next exercise (backgrounded only). */
async function showRestProgress() {
  if (!timerEndAt) return;
  if (await hasVisibleClient()) return; // app is open — overlay handles it
  const remaining = Math.round((timerEndAt - Date.now()) / 1000);
  if (remaining <= 0) return;
  const firstShow = !restProgressShown;
  restProgressShown = true;
  self.registration.showNotification(`⏱ Rest — ${formatRemaining(remaining)}`, {
    body: timerNextLabel || 'Next set coming up',
    tag: REST_TAG,
    renotify: false,
    silent: !firstShow, // first banner drops down; later updates are quiet
  });
}

async function showRestDone() {
  if (restDoneFired) return; // fire exactly once
  restDoneFired = true;
  if (restTimerTimeout) {
    clearTimeout(restTimerTimeout);
    restTimerTimeout = null;
  }
  const payload = timerGoPayload || { title: 'Rest over — GO!', body: 'Start your next set' };
  const visible = await hasVisibleClient();
  clearRestTimerSchedule();
  if (visible) {
    // App is visible — the in-app overlay handles it; clear any live banner.
    closeRestNotifications();
    return;
  }
  self.registration.showNotification(payload.title || 'Rest over — GO!', {
    body: payload.body || 'Start your next set',
    tag: REST_TAG,
    renotify: true,
    vibrate: [200, 100, 200],
  });
}

/**
 * Re-arm in short chunks: iOS throttles long SW timers, and each tick also
 * refreshes the live rest notification (coarse countdown).
 */
function armRestTimer() {
  if (restTimerTimeout) clearTimeout(restTimerTimeout);
  if (!timerEndAt || !timerGoPayload || restDoneFired) return;
  const delay = timerEndAt - Date.now();
  if (delay <= 0) {
    showRestDone();
    return;
  }
  showRestProgress();
  const chunkMs = Math.min(delay, 10000);
  restTimerTimeout = setTimeout(() => {
    restTimerTimeout = null;
    if (!timerEndAt || restDoneFired) return; // cancelled or already fired
    if (Date.now() >= timerEndAt) showRestDone();
    else armRestTimer();
  }, chunkMs);
}

/** Rest timer push — payload set from js/features/timer.js scheduleRestTimerAlerts(). */
self.addEventListener('message', (e) => {
  const data = e.data;
  if (!data || typeof data !== 'object') return;
  if (data.type === 'TIMER_CANCEL') {
    clearRestTimerSchedule();
    closeRestNotifications();
    return;
  }
  if (data.type === 'TIMER_BG') {
    // Page went to the background mid-rest — show the live banner immediately.
    if (timerEndAt && Date.now() < timerEndAt) showRestProgress();
    return;
  }
  if (data.type === 'TIMER_START') {
    clearRestTimerSchedule();
    timerEndAt = data.endAt || 0;
    timerGoPayload = {
      title: data.goTitle || data.title || 'Rest over — GO!',
      body: data.goBody || data.body || 'Start your next set',
    };
    timerNextLabel = data.nextLabel || '';
    if (timerEndAt - Date.now() <= 0) return;
    armRestTimer();
  }
});

/** Tapping any rest notification focuses (or opens) the app. */
self.addEventListener('notificationclick', (e) => {
  if (e.notification?.tag !== REST_TAG) return;
  e.notification.close();
  e.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find((c) => 'focus' in c);
    if (existing) return existing.focus();
    return self.clients.openWindow('/');
  })());
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

  const isNavigation = e.request.mode === 'navigate';

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && SHELL.some((p) => url.pathname === p || url.pathname.endsWith(p))) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        // Only fall back to the app shell for navigations. NEVER return index.html
        // for a failed script/style/asset request — doing so makes the browser parse
        // HTML as JS ("Unexpected token '<'") and breaks the entire app on any
        // transient network blip.
        if (isNavigation) {
          const shell = await caches.match('/index.html');
          if (shell) return shell;
        }
        return Response.error();
      }),
  );
});
