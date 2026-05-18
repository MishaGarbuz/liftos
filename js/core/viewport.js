/** @file Mobile PWA viewport sizing. */
/* ═══════════════════════════════════════════════════════════════
   MOBILE VIEWPORT (iOS PWA bottom gap)
═══════════════════════════════════════════════════════════════ */
function isIosPwa() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  return ios && standalone;
}

function detectPwaEnv() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('pwa-standalone');
  if (isIosPwa()) document.documentElement.classList.add('ios-pwa');
}

function measureSafeBottom() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)';
  document.body.appendChild(probe);
  const fromEnv = parseFloat(getComputedStyle(probe).paddingBottom) || 0;
  probe.remove();
  if (isIosPwa()) return Math.max(fromEnv, 34);
  return fromEnv;
}

function syncMobileViewport() {
  const h = Math.round(window.visualViewport?.height ?? window.innerHeight);
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${measureSafeBottom()}px`);
  const nav = document.getElementById('bottomNav');
  if (nav && window.matchMedia('(max-width: 768px)').matches) {
    document.documentElement.style.setProperty('--bottom-nav-total', `${nav.offsetHeight}px`);
  }
  const logActions = document.getElementById('logSessionActions');
  if (logActions && !logActions.classList.contains('is-hidden')) {
    document.documentElement.style.setProperty('--log-actions-h', `${logActions.offsetHeight}px`);
  }
}

function bindMobileViewport() {
  detectPwaEnv();
  syncMobileViewport();
  window.addEventListener('resize', syncMobileViewport, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(syncMobileViewport, 100), { passive: true });
  window.visualViewport?.addEventListener('resize', syncMobileViewport, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncMobileViewport();
  });
}
