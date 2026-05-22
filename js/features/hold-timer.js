/**
 * @file Timed holds (plank, hollow hold, etc.) — countdown, alert, auto-complete set, then rest.
 */
function setTimerHeading(text) {
  const el = document.getElementById('timerHeading');
  if (el) el.textContent = text;
}

function fireHoldTimerAlert(exName) {
  const title = 'Hold complete';
  const body = exName ? `${exName} — mark set done` : 'Set complete';
  if (state.prefs?.timerNotify === false) return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      new Notification(title, { body, tag: 'auxos-hold', renotify: true });
    } catch { /* ignore */ }
  }
}

function scheduleHoldTimerAlerts(exName) {
  cancelRestTimerAlerts();
  if (state.prefs?.timerNotify === false || !timerState.active || !timerState.endAt) return;
  const delay = Math.max(0, timerState.endAt - Date.now());
  if (delay <= 0) return;

  timerPageTimeout = setTimeout(() => fireHoldTimerAlert(exName), delay);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: 'TIMER_START',
        endAt: timerState.endAt,
        title: 'Hold complete',
        body: exName ? `${exName} — done` : 'Hold finished',
      });
    }).catch(() => {});
  }
}

function finishHoldTimer() {
  const sid = timerState.holdSid;
  const exName = timerState.exercise;
  const elapsed = timerState.duration;
  clearInterval(timerState.interval);
  timerState.interval = null;
  cancelRestTimerAlerts();
  document.getElementById('timerDisplay').className = 'timer-display done';
  document.getElementById('timerBar').className = 'timer-bar done';
  document.getElementById('timerBar').style.width = '100%';
  document.getElementById('timerDisplay').textContent = 'Done!';
  if (state.prefs?.timerVibrate !== false && navigator.vibrate) navigator.vibrate([200, 100, 200]);
  fireHoldTimerAlert(exName);
  timerState.active = false;
  timerState.mode = 'rest';
  timerState.holdSid = null;
  setTimeout(() => {
    document.getElementById('timerOverlay').classList.remove('active');
    const nextEl = document.getElementById('timerNextExercise');
    if (nextEl) nextEl.classList.add('hidden');
    setTimerHeading('Rest Timer');
    if (sid && typeof completeTimedSet === 'function') completeTimedSet(sid, elapsed);
  }, 600);
}

/**
 * @param {string} sid — set row id
 * @param {string} exName — display exercise name
 * @param {number} durationSec — hold length
 */
function startHoldTimer(sid, exName, durationSec) {
  if (timerState.active) closeTimer();
  if (timerState.interval) clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  const duration = Math.max(1, Math.min(600, parseInt(durationSec, 10) || 30));
  const endAt = Date.now() + duration * 1000;
  timerState = {
    active: true,
    mode: 'hold',
    duration,
    exercise: exName,
    endAt,
    interval: null,
    afterRestSid: null,
    holdSid: sid,
    nextLabel: null,
    notifyBody: '',
  };
  setTimerHeading('Hold Timer');
  document.getElementById('timerExercise').textContent = exName || '—';
  const nextEl = document.getElementById('timerNextExercise');
  if (nextEl) {
    nextEl.textContent = '';
    nextEl.classList.add('hidden');
  }
  document.getElementById('timerOverlay').classList.add('active');
  updateTimerDisplay();
  timerState.interval = setInterval(tickTimer, 250);

  const row = document.getElementById(sid);
  row?.classList.add('set-row--hold-active');
  const startBtn = document.getElementById(`${sid}-hold-start`);
  if (startBtn) {
    startBtn.disabled = true;
    startBtn.textContent = 'Running…';
  }

  const canNotify = state.prefs?.timerNotify !== false;
  if (canNotify && Notification.permission === 'granted') {
    scheduleHoldTimerAlerts(exName);
  } else if (canNotify) {
    ensureTimerNotifyPermission().then((ok) => {
      if (ok && timerState.active && timerState.mode === 'hold') scheduleHoldTimerAlerts(exName);
    });
  }
}

function cancelHoldTimerUi(sid) {
  const row = document.getElementById(sid);
  row?.classList.remove('set-row--hold-active');
  const startBtn = document.getElementById(`${sid}-hold-start`);
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
  }
}
