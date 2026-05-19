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
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    scheduleChartResize(state.dashE1rmChart);
    scheduleChartResize(state.dashVolumeChart);
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

function offsetWithin(el, container) {
  const elRect = el.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return elRect.top - containerRect.top + container.scrollTop;
}

/** Shrink log scroll area to the slice above the keyboard (layout viewport stays full height on iOS). */
function syncLogKeyboardLayout() {
  const scroller = document.querySelector('#page-log.active .log-page-scroll');
  const keyboardOpen = document.documentElement.classList.contains('keyboard-open');
  if (!scroller || !keyboardOpen || !isMobileLayout()) {
    document.documentElement.style.removeProperty('--log-scroll-height');
    return;
  }
  const vv = window.visualViewport;
  if (!vv) return;
  updateKeyboardInset();
  const scRect = scroller.getBoundingClientRect();
  const actions = document.getElementById('logSessionActions');
  const actionsH =
    actions && !actions.classList.contains('is-hidden')
      ? actions.getBoundingClientRect().height
      : 0;
  const vvBottom = vv.offsetTop + vv.height;
  const available = Math.floor(vvBottom - scRect.top - actionsH - 8);
  document.documentElement.style.setProperty('--log-scroll-height', `${Math.max(160, available)}px`);
}

let logScrollRaf = 0;

function scrollLogFieldIntoView(el, scroller) {
  syncLogKeyboardLayout();
  cancelAnimationFrame(logScrollRaf);
  logScrollRaf = requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const row = el.closest('tr.set-row') || el;
      const rowTop = offsetWithin(row, scroller);
      const rowH = row.getBoundingClientRect().height;
      const viewH = scroller.clientHeight;
      const pad = 16;
      const maxScroll = Math.max(0, scroller.scrollHeight - viewH);
      let target = rowTop + rowH + pad - viewH;
      target = Math.max(0, Math.min(target, maxScroll));
      scroller.scrollTop = target;
    });
  });
}

function scrollFieldIntoView(el) {
  if (!el || !isMobileLayout()) return;
  const logScroller = el.closest('.log-page-scroll');
  if (logScroller) {
    scrollLogFieldIntoView(el, logScroller);
    return;
  }
  const scroller = el.closest('.modal-body');
  requestAnimationFrame(() => {
    if (!scroller) {
      el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      return;
    }
    const row = el.closest('tr.set-row') || el;
    const scRect = scroller.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    const pad = 12;
    if (rowRect.bottom > scRect.bottom - pad) {
      scroller.scrollTop += rowRect.bottom - scRect.bottom + pad;
    } else if (rowRect.top < scRect.top + pad) {
      scroller.scrollTop -= scRect.top + pad - rowRect.top;
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
    if (t.closest('.log-page-scroll')) {
      setTimeout(() => {
        if (document.activeElement === t) scrollFieldIntoView(t);
      }, 280);
    }
  };
  const onFocusOut = () => {
    setTimeout(() => {
      const active = document.activeElement;
      if (active?.matches?.('input, textarea, select')) return;
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
      document.documentElement.style.removeProperty('--log-scroll-height');
      syncMobileViewport();
    }, 120);
  };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  window.visualViewport?.addEventListener('resize', () => {
    if (!document.documentElement.classList.contains('keyboard-open')) return;
    syncLogKeyboardLayout();
    const active = document.activeElement;
    if (active?.matches?.('input, textarea, select') && active.closest('.log-page-scroll')) {
      scrollLogFieldIntoView(active, active.closest('.log-page-scroll'));
    }
  }, { passive: true });
  window.visualViewport?.addEventListener('scroll', () => {
    if (document.documentElement.classList.contains('keyboard-open')) syncLogKeyboardLayout();
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
