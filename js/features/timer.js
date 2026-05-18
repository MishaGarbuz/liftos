/** @file Rest timer overlay and notifications. */
/* ═══════════════════════════════════════════════════════════════
   REST TIMER
═══════════════════════════════════════════════════════════════ */
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
  if (state.prefs?.timerNotify === false || timerState.remaining <= 0) return;
  const ms = timerState.remaining * 1000;
  timerPageTimeout = setTimeout(fireRestTimerAlert, ms);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.active?.postMessage({
        type: 'TIMER_START',
        endAt: Date.now() + ms,
        title: 'Rest over — GO!',
        body: timerState.exercise
          ? `${timerState.exercise}: start your next set`
          : 'Start your next set',
      });
    }).catch(() => {});
  }
}

function startTimer(exName, duration) {
  if(timerState.interval) clearInterval(timerState.interval);
  cancelRestTimerAlerts();
  timerState = { active:true, duration, remaining:duration, exercise:exName, interval:null };
  document.getElementById('timerOverlay').classList.add('active');
  document.getElementById('timerExercise').textContent = exName;
  updateTimerDisplay();
  timerState.interval = setInterval(tickTimer, 1000);
  if (state.prefs?.timerNotify !== false) {
    ensureTimerNotifyPermission().then((ok) => {
      if (ok) scheduleRestTimerAlerts();
    });
  }
}

function tickTimer() {
  timerState.remaining--;
  updateTimerDisplay();
  if(timerState.remaining <= 0) {
    clearInterval(timerState.interval);
    cancelRestTimerAlerts();
    document.getElementById('timerDisplay').className = 'timer-display done';
    document.getElementById('timerBar').className = 'timer-bar done';
    document.getElementById('timerBar').style.width = '100%';
    document.getElementById('timerDisplay').textContent = 'GO!';
    if (state.prefs?.timerVibrate !== false && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    fireRestTimerAlert();
    if (timerState.exercise) saveExerciseRest(timerState.exercise, timerState.duration);
    setTimeout(closeTimer, 2500);
  }
}

function updateTimerDisplay() {
  const r = timerState.remaining;
  const m = Math.floor(r/60);
  const s = r%60;
  const pct = (r/timerState.duration)*100;
  const display = document.getElementById('timerDisplay');
  const bar = document.getElementById('timerBar');
  display.textContent = `${m}:${String(s).padStart(2,'0')}`;
  bar.style.width = pct+'%';
  if(r <= 10) {
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
  document.getElementById('timerOverlay').classList.remove('active');
}

function addTimerTime(s) { timerState.remaining = Math.min(timerState.remaining+s, 300); updateTimerDisplay(); }
function resetTimer() { timerState.remaining = timerState.duration; updateTimerDisplay(); if(!timerState.interval||timerState.remaining<=0){ timerState.interval = setInterval(tickTimer,1000); } }
function skipTimer() { closeTimer(); }

