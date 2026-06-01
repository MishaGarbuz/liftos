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

function isFormField(el) {
  return el?.matches?.('input, textarea, select');
}

function syncMobileViewport() {
  const innerH = window.innerHeight;
  const vv = window.visualViewport;
  const visualH = vv?.height ?? innerH;
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

// Cached keyboard metrics so repeated focuses reuse a stable, accurate layout
// instead of recomputing from a mid-animation viewport (which causes jumps).
let lastKeyboardInset = 0;   // last measured keyboard height (px)
let lastLogScrollHeight = 0; // last applied --log-scroll-height (px)
let lastVvHeight = 0;        // last visualViewport height we reacted to (px)

/**
 * Set --log-scroll-height only when it changes meaningfully.
 * Guards against layout thrash during scroll-induced viewport resizes
 * (the "glitch while scrolling with the keyboard up").
 */
function setLogScrollHeight(px) {
  if (Math.abs(px - lastLogScrollHeight) < 2) return;
  lastLogScrollHeight = px;
  document.documentElement.style.setProperty('--log-scroll-height', `${px}px`);
}

function updateKeyboardInset() {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty('--keyboard-inset', '0px');
    return;
  }
  const inset = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
  if (inset > 0) lastKeyboardInset = inset; // remember for the next focus
  document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
}

/** Compute the scroll slice above the keyboard for a given keyboard inset. */
function computeLogScrollHeight(keyboardInset) {
  const scroller = document.querySelector('#page-log.active .log-page-scroll');
  if (!scroller) return 0;
  const scRect = scroller.getBoundingClientRect();
  const actions = document.getElementById('logSessionActions');
  const actionsH =
    actions && !actions.classList.contains('is-hidden')
      ? actions.getBoundingClientRect().height
      : 0;
  const available = Math.floor(window.innerHeight - keyboardInset - scRect.top - actionsH - 8);
  return Math.max(160, available);
}

/**
 * Pre-constrain the log scroller the instant a field is focused — BEFORE the
 * browser paints — using the last measured keyboard height (or a typical
 * estimate on the very first focus). This is what prevents the screen jump:
 * without it, the `keyboard-open` CSS leaves the scroller at `height:auto`
 * (full content height) until the async recompute runs ~60ms later.
 */
function preconstrainLogScroll() {
  if (!isMobileLayout()) return;
  const estInset = lastKeyboardInset > 0
    ? lastKeyboardInset
    : Math.round(window.innerHeight * 0.45); // typical mobile keyboard fraction
  document.documentElement.style.setProperty('--keyboard-inset', `${estInset}px`);
  const h = computeLogScrollHeight(estInset);
  if (h) setLogScrollHeight(h);
}

/** Shrink log scroll area to the slice above the keyboard (layout viewport stays full height on iOS). */
function syncLogKeyboardLayout() {
  const scroller = document.querySelector('#page-log.active .log-page-scroll');
  const keyboardOpen = document.documentElement.classList.contains('keyboard-open');
  if (!scroller || !keyboardOpen || !isMobileLayout()) {
    document.documentElement.style.removeProperty('--log-scroll-height');
    lastLogScrollHeight = 0;
    return;
  }
  const vv = window.visualViewport;
  if (!vv) return;
  updateKeyboardInset();
  const vvBottom = vv.offsetTop + vv.height;
  const scRect = scroller.getBoundingClientRect();
  const actions = document.getElementById('logSessionActions');
  const actionsH =
    actions && !actions.classList.contains('is-hidden')
      ? actions.getBoundingClientRect().height
      : 0;
  const available = Math.floor(vvBottom - scRect.top - actionsH - 8);
  setLogScrollHeight(Math.max(160, available));
}

let logScrollRaf = 0;
let logKbLayoutTimer = 0;

function isFieldVisibleInScroller(el, scroller, pad) {
  const fieldRect = el.getBoundingClientRect();
  const scRect = scroller.getBoundingClientRect();
  return fieldRect.top >= scRect.top + pad && fieldRect.bottom <= scRect.bottom - pad;
}

function scrollLogFieldIntoView(el, scroller) {
  if (!el || !scroller) return;
  syncLogKeyboardLayout();
  const pad = 12;
  if (isFieldVisibleInScroller(el, scroller, pad)) return;

  cancelAnimationFrame(logScrollRaf);
  logScrollRaf = requestAnimationFrame(() => {
    const fieldRect = el.getBoundingClientRect();
    const scRect = scroller.getBoundingClientRect();
    if (fieldRect.bottom > scRect.bottom - pad) {
      scroller.scrollTop += fieldRect.bottom - (scRect.bottom - pad);
    } else if (fieldRect.top < scRect.top + pad) {
      scroller.scrollTop -= scRect.top + pad - fieldRect.top;
    }
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

function focusLogField(el) {
  if (!el) return;
  try {
    el.focus({ preventScroll: true });
  } catch {
    el.focus();
  }
  scrollFieldIntoView(el);
}

function scheduleLogKeyboardLayout() {
  clearTimeout(logKbLayoutTimer);
  logKbLayoutTimer = setTimeout(() => {
    if (!document.documentElement.classList.contains('keyboard-open')) return;
    syncLogKeyboardLayout();
    updateKeyboardInset();
  }, 60);
}

function bindKeyboardViewportFix() {
  const onFocusIn = (e) => {
    const t = e.target;
    if (!isFormField(t)) return;
    const wasOpen = document.documentElement.classList.contains('keyboard-open');
    document.documentElement.classList.add('keyboard-open');
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    // Synchronously constrain the log scroller before the browser paints so the
    // keyboard-open layout never flashes the full-height (auto) state → no jump.
    if (!wasOpen) preconstrainLogScroll();
    else updateKeyboardInset();
    scheduleLogKeyboardLayout();
    requestAnimationFrame(() => scrollFieldIntoView(t));
  };
  const onFocusOut = (e) => {
    const next = e.relatedTarget;
    if (isFormField(next) && next.closest('.log-page-scroll')) {
      scheduleLogKeyboardLayout();
      return;
    }
    setTimeout(() => {
      const active = document.activeElement;
      if (isFormField(active)) return;
      document.documentElement.classList.remove('keyboard-open');
      document.documentElement.style.setProperty('--keyboard-inset', '0px');
      document.documentElement.style.removeProperty('--log-scroll-height');
      lastLogScrollHeight = 0;
      syncMobileViewport();
    }, 150);
  };
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
}

function bindMobileViewport() {
  detectPwaEnv();
  lastVvHeight = window.visualViewport?.height || 0;
  syncMobileViewport();
  bindKeyboardViewportFix();
  window.addEventListener('resize', syncMobileViewport, { passive: true });
  window.addEventListener('orientationchange', () => setTimeout(syncMobileViewport, 100), { passive: true });
  // Single visualViewport resize handler: keeps keyboard + general viewport
  // logic coordinated so they read/update lastVvHeight exactly once per event.
  window.visualViewport?.addEventListener('resize', () => {
    const vv = window.visualViewport;
    const heightChanged = !vv || Math.abs(vv.height - lastVvHeight) >= 2;
    if (vv) lastVvHeight = vv.height;
    if (document.documentElement.classList.contains('keyboard-open')) {
      // Scroll rubber-banding changes offsetTop, not height — ignore it to
      // avoid the layout glitch while scrolling with the keyboard up.
      if (!heightChanged) return;
      scheduleLogKeyboardLayout();
    }
    syncMobileViewport();
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) syncMobileViewport();
  });
}
