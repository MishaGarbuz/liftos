/** @file Rest timer overlay and notifications. */
/* ═══════════════════════════════════════════════════════════════
   REST TIMER
═══════════════════════════════════════════════════════════════ */
function getTimerRemainingSec() {
  if (!timerState.active || !timerState.endAt) return 0;
  return Math.max(0, Math.ceil((timerState.endAt - Date.now()) / 1000));
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
  const body = timerState.exercise
    ? `${timerState.exercise}: start your next set`
    : 'Start your next set';
  if (state.prefs?.timerNotify === false) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'liftos-rest', renotify: true });
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
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: 'TIMER_START',
        endAt: timerState.endAt,
        title: 'Rest over — GO!',
        body: timerState.exercise
          ? `${timerState.exercise}: start your next set`
          : 'Start your next set',
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

function startTimer(exName, duration) {
  if (timerState.interval) clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  const endAt = Date.now() + duration * 1000;
  timerState = { active: true, duration, exercise: exName, endAt, interval: null };
  document.getElementById('timerOverlay').classList.add('active');
  document.getElementById('timerExercise').textContent = exName;
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
  clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  timerState.active = false;
  timerState.interval = null;
  document.getElementById('timerOverlay').classList.remove('active');
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
