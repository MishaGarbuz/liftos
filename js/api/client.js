/** @file API client, Cognito session, prefs, import/export. */
/* ═══════════════════════════════════════════════════════════════
   API — auto-configured via config.json
═══════════════════════════════════════════════════════════════ */
async function loadAppConfig() {
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    API_BASE = 'http://localhost:3001';
  } else {
    try {
      const cfg = await fetch('/config.json', { cache: 'no-store' }).then(r => r.json());
      API_BASE = (cfg.apiUrl || FALLBACK_API_URL).replace(/\/$/, '');
      cognitoConfig = cfg.cognito || null;
      window.cognitoConfig = cognitoConfig;
    } catch {
      API_BASE = FALLBACK_API_URL;
      window.cognitoConfig = null;
    }
  }
  return { apiUrl: API_BASE, cognito: cognitoConfig };
}

function saveAuthTokens(tokens) {
  const payload = {
    idToken: tokens.IdToken,
    accessToken: tokens.AccessToken,
    refreshToken: tokens.RefreshToken,
    expiresAt: Date.now() + (tokens.ExpiresIn || 3600) * 1000,
  };
  sessionStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
  return payload;
}

function loadAuthTokens() {
  try {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function getIdToken() {
  const t = loadAuthTokens();
  if (!t?.idToken) return null;
  if (t.expiresAt && t.expiresAt < Date.now() + 30000) return null;
  return t.idToken;
}

let pendingAuthChallenge = null;

async function cognitoInitiateAuth(email, password) {
  if (!cognitoConfig?.clientId || !cognitoConfig?.region) {
    throw new Error('Auth not configured. Redeploy backend and refresh config.json.');
  }
  const data = await cognitoIdpRequest(
    'AWSCognitoIdentityProviderService.InitiateAuth',
    {
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: cognitoConfig.clientId,
      AuthParameters: { USERNAME: email.trim(), PASSWORD: password },
    },
  );
  if (data.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
    pendingAuthChallenge = { email: email.trim(), session: data.Session };
    return { challenge: 'NEW_PASSWORD_REQUIRED' };
  }
  if (data.__type || !data.AuthenticationResult) {
    throw new Error(data.message || 'Sign in failed');
  }
  pendingAuthChallenge = null;
  return { tokens: data.AuthenticationResult };
}

async function cognitoCompleteNewPassword(newPassword) {
  if (!pendingAuthChallenge?.session) {
    throw new Error('Start sign-in again, then set your new password.');
  }
  const pwErr = validateCognitoPassword(newPassword);
  if (pwErr) throw new Error(pwErr);
  const data = await cognitoIdpRequest(
    'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
    {
      ChallengeName: 'NEW_PASSWORD_REQUIRED',
      ClientId: cognitoConfig.clientId,
      Session: pendingAuthChallenge.session,
      ChallengeResponses: {
        USERNAME: pendingAuthChallenge.email,
        NEW_PASSWORD: newPassword,
      },
    },
  );
  if (data.__type || !data.AuthenticationResult) {
    throw new Error(data.message || 'Could not set new password');
  }
  pendingAuthChallenge = null;
  return data.AuthenticationResult;
}

function showNewPasswordChallenge() {
  document.getElementById('newPasswordFields')?.classList.remove('hidden');
  document.getElementById('loginBtn').textContent = 'Set password & sign in';
  const hint = document.getElementById('passwordHint');
  if (hint) hint.textContent = PASSWORD_HINT;
  document.getElementById('loginError').textContent =
    'First sign-in: set a permanent password below.';
}

function hideNewPasswordChallenge() {
  document.getElementById('newPasswordFields')?.classList.add('hidden');
  document.getElementById('loginNewPassword').value = '';
  document.getElementById('loginNewPasswordConfirm').value = '';
  document.getElementById('loginBtn').textContent = 'Sign in';
}

async function cognitoRefreshToken() {
  const stored = loadAuthTokens();
  if (!stored?.refreshToken || !cognitoConfig) return null;
  const res = await fetch(`https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    },
    body: JSON.stringify({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: cognitoConfig.clientId,
      AuthParameters: { REFRESH_TOKEN: stored.refreshToken },
    }),
  });
  const data = await res.json();
  if (data.AuthenticationResult) {
    saveAuthTokens({ ...data.AuthenticationResult, RefreshToken: stored.refreshToken });
    return data.AuthenticationResult.IdToken;
  }
  return null;
}

async function ensureIdToken() {
  let token = getIdToken();
  if (token) return token;
  token = await cognitoRefreshToken();
  return token;
}

function showAuthGate() {
  document.getElementById('authGate')?.classList.remove('hidden');
  document.getElementById('appShell')?.classList.add('app-locked');
  document.body.classList.add('auth-locked');
}

function hideAuthGate() {
  document.getElementById('authGate')?.classList.add('hidden');
  document.getElementById('appShell')?.classList.remove('app-locked');
  document.body.classList.remove('auth-locked');
  syncMobileViewport();
}

function signOut() {
  sessionStorage.removeItem(AUTH_STORAGE_KEY);
  pendingAuthChallenge = null;
  apiOnline = false;
  showAuthGate();
  hideNewPasswordChallenge();
  document.getElementById('loginError').textContent = '';
}

async function apiCall(method, path, body = null, timeoutMs = 12000) {
  if (!API_BASE) throw new Error('API not configured');
  const token = await ensureIdToken();
  if (!token) { signOut(); throw new Error('Not signed in'); }
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...opts, signal: controller.signal });
    if (res.status === 401) { signOut(); throw new Error('Session expired — sign in again'); }
    if (!res.ok) throw new Error(`API ${res.status}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

function persistLocalState() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
      currentWeek: state.currentWeek,
      currentDay: state.currentDay,
      sessions: state.sessions,
      prefs: state.prefs,
    }));
  } catch (e) { console.warn('localStorage save failed', e); }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.sessions) state.sessions = data.sessions;
    if (data.currentWeek) state.currentWeek = data.currentWeek;
    if (data.currentDay) state.currentDay = data.currentDay;
    if (data.prefs) state.prefs = { ...state.prefs, ...data.prefs };
  } catch (e) { console.warn('localStorage load failed', e); }
}

function mapApiSession(s, sets) {
  const dayKey = (s.dayKey || '').toLowerCase();
  const day = DAY_KEY_REV[dayKey] || (s.day && s.day.length === 3 ? s.day : 'Mon');
  return {
    sessionId: s.sessionId,
    date: s.date || new Date().toLocaleDateString('en-AU'),
    week: parseInt(s.week, 10) || 1,
    day,
    sets: (sets || []).map((set, i) => ({
      exercise: set.exercise,
      weight: parseFloat(set.weightKg) || 0,
      reps: parseInt(set.reps, 10) || 0,
      rpe: parseFloat(set.rpe) || 7,
      e1rm: parseFloat(set.e1rm) || 0,
      setNumber: parseInt(set.setNumber, 10) || i + 1
    })),
    completed: s.status === 'completed',
    completedAt: s.updatedAt || s.createdAt
  };
}

async function hydrateFromApi() {
  const data = await apiCall('GET', '/sessions');
  const sessions = data.sessions || [];
  state.sessions = [];
  for (const s of sessions) {
    const sid = s.sessionId;
    if (!sid) continue;
    let sets = [];
    try {
      const setsRes = await apiCall('GET', `/sessions/${sid}/sets`);
      sets = setsRes.sets || [];
    } catch (e) { console.warn('sets load failed', sid, e); }
    state.sessions.push(mapApiSession(s, sets));
  }
  const maxWeek = state.sessions.reduce((m, s) => Math.max(m, s.week || 1), 1);
  if (maxWeek > state.currentWeek) state.currentWeek = maxWeek;
  persistLocalState();
}

async function ensureApiSession() {
  if (!apiOnline) return null;
  if (activeApiSessionId) return activeApiSessionId;
  const existing = getInProgressSession();
  if (existing?.sessionId) {
    activeApiSessionId = existing.sessionId;
    return activeApiSessionId;
  }
  const sid = crypto.randomUUID();
  const day = PROGRAM[state.currentDay];
  await apiCall('POST', '/sessions', {
    sessionId: sid,
    week: state.currentWeek,
    day: day?.label || state.currentDay,
    dayKey: DAY_KEY_MAP[state.currentDay] || 'mon',
    date: new Date().toISOString().slice(0, 10),
    status: 'in_progress',
    totalSets: 0,
    completedSets: 0
  });
  activeApiSessionId = sid;
  const local = getInProgressSession();
  if (local) local.sessionId = sid;
  else {
    state.sessions.push({
      sessionId: sid,
      date: new Date().toLocaleDateString('en-AU'),
      week: state.currentWeek,
      day: state.currentDay,
      sets: [],
      completed: false
    });
  }
  return sid;
}

window._syncSetOp = async function (setData) {
  const sid = await ensureApiSession();
  await apiCall('POST', `/sessions/${sid}/sets`, {
    exercise: setData.exercise,
    setNumber: setData.setNumber || 1,
    weightKg: setData.weight,
    reps: setData.reps,
    rpe: setData.rpe,
    completed: true,
    week: state.currentWeek,
  });
};

window._syncSessionOp = async function (session, completed) {
  const sid = session.sessionId || await ensureApiSession();
  session.sessionId = sid;
  const doneSets = session.sets.filter(x => x.weight > 0 || x.reps > 0);
  await apiCall('POST', '/sessions', {
    sessionId: sid,
    week: session.week,
    day: PROGRAM[session.day]?.label || session.day,
    dayKey: DAY_KEY_MAP[session.day] || 'mon',
    date: new Date().toISOString().slice(0, 10),
    status: completed ? 'completed' : 'in_progress',
    totalSets: doneSets.length,
    completedSets: doneSets.length,
  });
};

async function syncSetToApi(setData) {
  if (!setData.weight || !setData.reps) return;
  if (!apiOnline) {
    enqueueSync({ type: 'set', payload: setData });
    setSyncStatus('local', 'Local only');
    return;
  }
  try {
    setSyncStatus('syncing', 'Saving…');
    await window._syncSetOp(setData);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('set sync failed', e);
    enqueueSync({ type: 'set', payload: setData });
    apiOnline = false;
    setSyncStatus('local', 'Local only');
  }
}

async function syncSessionToApi(session, completed) {
  if (!apiOnline) {
    enqueueSync({ type: 'session', payload: session, completed });
    setSyncStatus('local', 'Local only');
    return;
  }
  try {
    setSyncStatus('syncing', 'Saving…');
    await window._syncSessionOp(session, completed);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('session sync failed', e);
    enqueueSync({ type: 'session', payload: session, completed });
    apiOnline = false;
    setSyncStatus('local', 'Local only');
  }
}

async function initApi() {
  loadSyncQueue();
  setSyncStatus('syncing', 'Connecting…');
  try {
    await apiCall('GET', '/summary');
    apiOnline = true;
    await hydrateFromApi();
    await flushSyncQueue();
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('API unavailable, using local cache', e);
    apiOnline = false;
    loadLocalState();
    const msg = (e?.message || '').toLowerCase();
    if (msg.includes('not signed in') || msg.includes('session expired')) {
      setSyncStatus('offline', 'Sign in required');
    } else if (msg.includes('401')) {
      setSyncStatus('offline', 'Auth failed');
    } else {
      setSyncStatus('local', 'Local only');
    }
  }
  apiReady = true;
}

function weightUnitLabel() { return state.prefs?.units === 'lb' ? 'lb' : 'kg'; }
function weightColumnLabel() { return `Weight (${weightUnitLabel()})`; }
function displayWeight(kg) {
  if (!kg && kg !== 0) return '—';
  if (state.prefs?.units === 'lb') return (kg * 2.20462).toFixed(1);
  return kg;
}
function formatWeightWithUnit(kg) {
  if (!kg && kg !== 0) return '—';
  const w = displayWeight(kg);
  return w === '—' ? w : `${w}${weightUnitLabel()}`;
}
function formatSessionVolume(doneSets) {
  const total = doneSets.reduce((a, x) => {
    const w = x.weight || 0;
    const r = x.reps || 0;
    const displayW = state.prefs?.units === 'lb' ? w * 2.20462 : w;
    return a + displayW * r;
  }, 0);
  return `${Math.round(total).toLocaleString()} ${weightUnitLabel()}`;
}
function toKg(displayVal) {
  const v = parseFloat(displayVal);
  if (!Number.isFinite(v)) return 0;
  return state.prefs?.units === 'lb' ? Math.round((v / 2.20462) * 10) / 10 : v;
}
function toDisplayUnit(kg) {
  if (kg == null || !Number.isFinite(kg)) return null;
  return state.prefs?.units === 'lb' ? Math.round(kg * 2.20462 * 10) / 10 : kg;
}

function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) state.prefs = { ...state.prefs, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  const us = document.getElementById('unitSelect');
  if (us) us.value = state.prefs.units || 'kg';
  const tv = document.getElementById('timerVibrate');
  if (tv) tv.checked = state.prefs.timerVibrate !== false;
  const tn = document.getElementById('timerNotify');
  if (tn) tn.checked = state.prefs.timerNotify !== false;
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch { /* ignore */ }
}

function setWeightUnit(u) {
  state.prefs.units = u;
  savePrefs();
  renderLogPage();
  renderHistory();
  renderDashboard();
  renderProgressPage();
}

function setTimerVibrate(on) {
  state.prefs.timerVibrate = on;
  savePrefs();
}

function setTimerNotify(on) {
  state.prefs.timerNotify = on;
  savePrefs();
  if (on) ensureTimerNotifyPermission();
  else cancelRestTimerAlerts();
}

function getExerciseRest(exName, defaultRest) {
  try {
    const prefs = JSON.parse(localStorage.getItem(REST_PREFS_KEY) || '{}');
    return prefs[exName] ?? defaultRest;
  } catch { return defaultRest; }
}

function saveExerciseRest(exName, seconds) {
  try {
    const prefs = JSON.parse(localStorage.getItem(REST_PREFS_KEY) || '{}');
    prefs[exName] = seconds;
    localStorage.setItem(REST_PREFS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = data.sessions || [];
      if (!incoming.length) { alert('No sessions found in file.'); return; }
      if (!confirm(`Import ${incoming.length} session(s)? This merges with your existing workouts.`)) return;
      const ids = new Set(state.sessions.map(s => s.sessionId).filter(Boolean));
      incoming.forEach(s => {
        if (s.sessionId && ids.has(s.sessionId)) {
          const idx = state.sessions.findIndex(x => x.sessionId === s.sessionId);
          if (idx >= 0) state.sessions[idx] = s;
        } else {
          state.sessions.push(s);
        }
      });
      if (data.currentWeek) state.currentWeek = data.currentWeek;
      persistLocalState();
      if (apiOnline) {
        for (const s of state.sessions) {
          if (s.completed) await syncSessionToApi(s, true);
        }
        await flushSyncQueue();
      }
      renderDashboard();
      renderHistory();
      renderLogPage();
      showSaveToast('Import complete');
    } catch (e) {
      alert('Invalid JSON file: ' + e.message);
    }
  };
  input.click();
}

let resetCodeSent = false;

function showLoginPanel() {
  document.getElementById('loginPanel')?.classList.remove('hidden');
  document.getElementById('resetPanel')?.classList.add('hidden');
  document.getElementById('loginEmail')?.closest('form')?.querySelector('#loginBtn')?.classList.remove('hidden');
}

function showResetPanel() {
  const email = document.getElementById('loginEmail')?.value || '';
  document.getElementById('resetEmail').value = email;
  document.getElementById('loginPanel')?.classList.add('hidden');
  document.getElementById('resetPanel')?.classList.remove('hidden');
  resetCodeSent = false;
  document.getElementById('resetCodeFields')?.classList.add('hidden');
  document.getElementById('resetBtn').textContent = 'Send reset code';
  const rh = document.getElementById('resetPasswordHint');
  if (rh) rh.textContent = PASSWORD_HINT;
}

async function handleResetPassword() {
  const errEl = document.getElementById('loginError');
  const email = document.getElementById('resetEmail').value.trim();
  errEl.textContent = '';
  if (!email) { errEl.textContent = 'Enter your email.'; return; }
  const btn = document.getElementById('resetBtn');
  btn.disabled = true;
  try {
    if (!resetCodeSent) {
      await cognitoForgotPassword(email);
      resetCodeSent = true;
      document.getElementById('resetCodeFields')?.classList.remove('hidden');
      btn.textContent = 'Reset password';
      errEl.textContent = 'Check your email for the verification code.';
      errEl.style.color = 'var(--success)';
    } else {
      const code = document.getElementById('resetCode').value;
      const np = document.getElementById('resetNewPassword').value;
      const npc = document.getElementById('resetNewPasswordConfirm').value;
      if (np !== npc) throw new Error('Passwords do not match.');
      await cognitoConfirmForgotPassword(email, code, np);
      errEl.style.color = '';
      alert('Password updated. Sign in with your new password.');
      showLoginPanel();
    }
  } catch (e) {
    errEl.style.color = '';
    errEl.textContent = e.message || 'Reset failed';
  } finally {
    btn.disabled = false;
  }
}

async function bootApp() {
  const dayMap = { 1: 'Mon', 2: 'Tue', 4: 'Thu', 5: 'Fri' };
  const todayNum = new Date().getDay();
  if (dayMap[todayNum]) state.currentDay = dayMap[todayNum];
  loadPrefs();
  loadLocalState();
  renderDashboard();
  renderSchedule();
  renderPlanPage();
  renderProgressPage();
  renderHistory();
  await initApi();
  renderDashboard();
  renderHistory();
  requestAnimationFrame(() => {
    syncMobileViewport();
    requestAnimationFrame(syncMobileViewport);
  });
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');
  const inChallenge = !!pendingAuthChallenge;
  errEl.textContent = inChallenge ? errEl.textContent : '';
  btn.disabled = true;
  btn.textContent = inChallenge ? 'Setting password…' : 'Signing in…';
  try {
    if (inChallenge) {
      const np = document.getElementById('loginNewPassword').value;
      const npc = document.getElementById('loginNewPasswordConfirm').value;
      const pwErr = validateCognitoPassword(np);
      if (pwErr) throw new Error(pwErr);
      if (np !== npc) throw new Error('New passwords do not match.');
      const tokens = await cognitoCompleteNewPassword(np);
      saveAuthTokens(tokens);
      hideNewPasswordChallenge();
      hideAuthGate();
      await bootApp();
      return;
    }
    const result = await cognitoInitiateAuth(email, password);
    if (result.challenge === 'NEW_PASSWORD_REQUIRED') {
      showNewPasswordChallenge();
      return;
    }
    saveAuthTokens(result.tokens);
    hideAuthGate();
    await bootApp();
  } catch (err) {
    errEl.textContent = err.message || 'Sign in failed';
  } finally {
    btn.disabled = false;
    if (!pendingAuthChallenge) btn.textContent = 'Sign in';
    else btn.textContent = 'Set password & sign in';
  }
}

function exportData() {
  const data={exportedAt:new Date().toISOString(),currentWeek:state.currentWeek,sessions:state.sessions,prefs:state.prefs};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='liftos-data-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}
