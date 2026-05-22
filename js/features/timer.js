/**
 * @file Rest timer overlay, iOS-safe SW notifications, and post-rest focus handoff.
 *
 * Entry: startTimer() from log.js after a set is marked done.
 * Context (next exercise copy): built in log.js → getRestTimerContext().
 * Push when app backgrounded: scheduleRestTimerAlerts() → sw.js TIMER_START handler.
 */
/* ═══════════════════════════════════════════════════════════════
   REST TIMER
═══════════════════════════════════════════════════════════════ */
function getTimerRemainingSec() {
  if (!timerState.active || !timerState.endAt) return 0;
  return Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
}

function getRestNotifyBody() {
  if (timerState.notifyBody) return timerState.notifyBody;
  return timerState.exercise
    ? `${timerState.exercise}: start your next set`
    : 'Start your next set';
}

function updateTimerOverlayCopy() {
  const titleEl = document.getElementById('timerExercise');
  const nextEl = document.getElementById('timerNextExercise');
  if (titleEl) titleEl.textContent = timerState.exercise || '—';
  if (nextEl) {
    const label = timerState.nextLabel || '';
    nextEl.textContent = label;
    nextEl.classList.toggle('hidden', !label);
  }
}

async function ensureTimerNotifyPermission() {
  if (!('Notification' in window) || state.prefs?.timerNotify === false) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  try {
    const r = await Notification.requestPermission();
    return r === 'granted';
  } catch {
    return false;
  }
}

function cancelRestTimerAlerts() {
  if (timerPageTimeout) {
    clearTimeout(timerPageTimeout);
    timerPageTimeout = null;
  }
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({ type: 'TIMER_CANCEL' });
    }).catch(() => {});
  }
}

function fireRestTimerAlert() {
  const title = 'Rest over — GO!';
  const body = getRestNotifyBody();
  if (state.prefs?.timerNotify === false) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'auxos-rest', renotify: true });
    } catch { /* ignore */ }
  }
}

function scheduleRestTimerAlerts() {
  cancelRestTimerAlerts();
  if (state.prefs?.timerNotify === false || !timerState.active || !timerState.endAt) return;
  const delay = Math.max(0, timerState.endAt - Date.now());
  if (delay <= 0) return;

  timerPageTimeout = setTimeout(fireRestTimerAlert, delay);

  if ('serviceWorker' in navigator) {
    const body = getRestNotifyBody();
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: 'TIMER_START',
        endAt: timerState.endAt,
        title: 'Rest over — GO!',
        body,
      });
    }).catch(() => {});
  }
}

function syncActiveTimer() {
  if (!timerState.active) return;
  const remaining = getTimerRemainingSec();
  if (remaining <= 0) {
    finishTimer();
    return;
  }
  updateTimerDisplay();
  scheduleRestTimerAlerts();
}

/** After superset rest, focus the next row (log.js highlightSupersetNextRow). */
function applyAfterRestHighlight() {
  const sid = timerState.afterRestSid;
  timerState.afterRestSid = null;
  if (sid && typeof highlightSupersetNextRow === 'function') highlightSupersetNextRow(sid);
}

/**
 * @param {string} exName — exercise just worked (overlay title)
 * @param {number} duration — rest seconds
 * @param {string|null} afterRestSid — set row id to focus when timer ends (superset)
 * @param {{ exercise?: string, nextLabel?: string|null, notifyBody?: string }} [context] — from log.js getRestTimerContext()
 */
function startTimer(exName, duration, afterRestSid, context) {
  if (timerState.interval) clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  const endAt = Date.now() + duration * 1000;
  const ctx = context || {};
  timerState = {
    active: true,
    duration,
    exercise: ctx.exercise || exName,
    endAt,
    interval: null,
    afterRestSid: afterRestSid || null,
    nextLabel: ctx.nextLabel || null,
    notifyBody: ctx.notifyBody || '',
  };
  document.getElementById('timerOverlay').classList.add('active');
  updateTimerOverlayCopy();
  updateTimerDisplay();
  timerState.interval = setInterval(tickTimer, 250);

  const canNotify = state.prefs?.timerNotify !== false;
  if (canNotify && Notification.permission === 'granted') {
    scheduleRestTimerAlerts();
  } else if (canNotify) {
    ensureTimerNotifyPermission().then((ok) => {
      if (ok && timerState.active) scheduleRestTimerAlerts();
    });
  }
}

function finishTimer() {
  applyAfterRestHighlight();
  clearInterval(timerState.interval);
  timerState.interval = null;
  cancelRestTimerAlerts();
  document.getElementById('timerDisplay').className = 'timer-display done';
  document.getElementById('timerBar').className = 'timer-bar done';
  document.getElementById('timerBar').style.width = '100%';
  document.getElementById('timerDisplay').textContent = 'GO!';
  if (state.prefs?.timerVibrate !== false && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  fireRestTimerAlert();
  if (timerState.exercise) saveExerciseRest(timerState.exercise, timerState.duration);
  timerState.active = false;
  setTimeout(closeTimer, 2500);
}

function tickTimer() {
  const remaining = getTimerRemainingSec();
  if (remaining <= 0) {
    finishTimer();
    return;
  }
  updateTimerDisplay();
}

function updateTimerDisplay() {
  const r = getTimerRemainingSec();
  const m = Math.floor(r / 60);
  const s = r % 60;
  const pct = timerState.duration > 0 ? (r / timerState.duration) * 100 : 0;
  const display = document.getElementById('timerDisplay');
  const bar = document.getElementById('timerBar');
  display.textContent = `${m}:${String(s).padStart(2, '0')}`;
  bar.style.width = pct + '%';
  if (r <= 10) {
    display.className = 'timer-display warning';
    bar.className = 'timer-bar warning';
  } else {
    display.className = 'timer-display';
    bar.className = 'timer-bar';
  }
}

function closeTimer() {
  applyAfterRestHighlight();
  clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  timerState.active = false;
  timerState.interval = null;
  timerState.afterRestSid = null;
  timerState.nextLabel = null;
  timerState.notifyBody = '';
  document.getElementById('timerOverlay').classList.remove('active');
  const nextEl = document.getElementById('timerNextExercise');
  if (nextEl) nextEl.classList.add('hidden');
}

function addTimerTime(s) {
  if (!timerState.active) return;
  timerState.endAt = Math.min(timerState.endAt + s * 1000, Date.now() + 300 * 1000);
  updateTimerDisplay();
  scheduleRestTimerAlerts();
}

function resetTimer() {
  if (!timerState.active) return;
  timerState.endAt = Date.now() + timerState.duration * 1000;
  updateTimerDisplay();
  if (!timerState.interval) timerState.interval = setInterval(tickTimer, 250);
  scheduleRestTimerAlerts();
}

function skipTimer() {
  closeTimer();
}

function bindRestTimerSync() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') syncActiveTimer();
  });
  window.addEventListener('pageshow', () => syncActiveTimer());
}

bindRestTimerSync();
