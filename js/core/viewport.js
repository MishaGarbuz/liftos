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

function isMobileLayout() {
  return window.matchMedia('(max-width: 768px)').matches;
}

function syncMobileViewport() {
  const innerH = window.innerHeight;
  const vv = window.visualViewport;
  const visualH = vv?.height ?? innerH;
  // iOS shrinks visualViewport when the keyboard opens — don't collapse the fixed shell
  const keyboardOpen = document.documentElement.classList.contains('keyboard-open');
  const keyboardLikely = vv && visualH < innerH * 0.82;
  const h = keyboardOpen || keyboardLikely ? innerH : Math.round(visualH);
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  document.documentElement.style.setProperty('--vh', `${h * 0.01}px`);
  document.documentElement.style.setProperty('--safe-bottom', `${measureSafeBottom()}px`);
  const nav = document.getElementById('bottomNav');
  if (nav && isMobileLayout()) {
    document.documentElement.style.setProperty('--bottom-nav-total', `${nav.offsetHeight}px`);
  }
  const logActions = document.getElementById('logSessionActions');
  if (logActions && !logActions.classList.contains('is-hidden')) {
    document.documentElement.style.setProperty('--log-actions-h', `${logActions.offsetHeight}px`);
  }
}

function updateKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty('--keyboard-inset', '0px');
    return;
  }
  const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.documentElement.style.setProperty('--keyboard-inset', `${Math.round(inset)}px`);
}

function scrollFieldIntoView(el) {
  if (!el || !isMobileLayout()) return;
  const scroller =
    el.closest('.log-page-scroll') ||
    el.closest('.modal-body') ||
    document.querySelector('#page-log.active .log-page-scroll');
  requestAnimationFrame(() => {
    updateKeyboardInset();
    if (!scroller) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      return;
    }
    const row = el.closest('tr.set-row') || el;
    const scRect = scroller.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const vv = window.visualViewport;
    const vvTop = vv?.offsetTop ?? 0;
    const vvHeight = vv?.height ?? window.innerHeight;
    const onLog = !!el.closest('#page-log');
    const actionsEl = onLog ? document.getElementById('logSessionActions') : null;
    const actionsVisible = actionsEl && !actionsEl.classList.contains('is-hidden');
    const chromeBelow =
      (actionsVisible ? actionsEl.offsetHeight : 0) +
      (onLog && document.documentElement.classList.contains('keyboard-open') ? 0 : (document.getElementById('bottomNav')?.offsetHeight || 0));
    const visibleTop = scRect.top + 8;
    const visibleBottom = Math.min(scRect.bottom, vvTop + vvHeight - chromeBelow - 12);

    if (rowRect.bottom > visibleBottom) {
      scroller.scrollTop += rowRect.bottom - visibleBottom;
    } else if (rowRect.top < visibleTop) {
      scroller.scrollTop -= visibleTop - rowRect.top;
    }
  });
}

function bindKeyboardViewportFix() {
  const onFocusIn = (e) => {
    const t = e.target;
    if (!t?.matches?.('input, textarea, select')) return;
    document.documentElement.classList.add('keyboard-open');
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    updateKeyboardInset();
    requestAnimationFrame(() => scrollFieldIntoView(t));
  };
  const onFocusOut = () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active?.matches?.('input, textarea, select')) return;
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
      syncMobileViewport();
    }, 120);
  };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  window.visualViewport?.addEventListener('resize', () => {
    if (document.documentElement.classList.contains('keyboard-open')) {
      updateKeyboardInset();
      const active = document.activeElement;
      if (active?.matches?.('input, textarea, select')) scrollFieldIntoView(active);
    }
  }, { passive: true });
  window.visualViewport?.addEventListener('scroll', () => {
    if (document.documentElement.classList.contains('keyboard-open')) updateKeyboardInset();
  }, { passive: true });
}

function bindMobileViewport() {
  detectPwaEnv();
  syncMobileViewport();
  bindKeyboardViewportFix();
  window.addEventListener('resize', syncMobileViewport, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(syncMobileViewport, 100), { passive: true });
  window.visualViewport?.addEventListener('resize', syncMobileViewport, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncMobileViewport();
  });
}
