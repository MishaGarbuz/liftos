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
      window.appConfig = cfg;
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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(`https://cognito-idp.${cognitoConfig.region}.amazonaws.com/`, {
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
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
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

function getLocalStorageKey() {
  const sub = typeof getIdTokenSub === 'function' ? getIdTokenSub() : null;
  return sub ? `${LOCAL_STORAGE_KEY}_${sub}` : LOCAL_STORAGE_KEY;
}

function persistLocalState() {
  try {
    localStorage.setItem(getLocalStorageKey(), JSON.stringify({
      currentWeek: state.currentWeek,
      currentDay: state.currentDay,
      sessions: state.sessions,
      coachSuggestions: state.coachSuggestions,
      prefs: state.prefs,
    }));
  } catch (e) { console.warn('localStorage save failed', e); }
}

function loadLocalState() {
  try {
    const raw = localStorage.getItem(getLocalStorageKey());
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.sessions) {
      state.sessions = data.sessions;
      if (typeof inferSessionSetMetadata === 'function') {
        state.sessions.forEach((s) => inferSessionSetMetadata(s));
      }
      if (typeof sortSessionSetsByWorkoutOrder === 'function') {
        state.sessions.forEach((s) => sortSessionSetsByWorkoutOrder(s));
      }
    }
    if (data.coachSuggestions && typeof data.coachSuggestions === 'object') {
      state.coachSuggestions = data.coachSuggestions;
    }
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
      exerciseId: set.exerciseId,
      plannedExerciseName: set.plannedExerciseName,
      plannedExerciseId: set.plannedExerciseId,
      slotId: set.slotId,
      loadScheme: set.loadScheme,
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
  const sessions = (data.sessions || []).filter((s) => s.sessionId);
  const hydrated = await Promise.all(
    sessions.map(async (s) => {
      try {
        const setsRes = await apiCall('GET', `/sessions/${encodeURIComponent(s.sessionId)}/sets`);
        return mapApiSession(s, setsRes.sets || []);
      } catch (e) {
        console.warn('sets load failed', s.sessionId, e);
        return mapApiSession(s, []);
      }
    }),
  );
  state.sessions = hydrated;
  if (typeof inferSessionSetMetadata === 'function') {
    state.sessions.forEach((s) => inferSessionSetMetadata(s));
  }
  if (typeof sortSessionSetsByWorkoutOrder === 'function') {
    state.sessions.forEach((s) => sortSessionSetsByWorkoutOrder(s));
  }
  if (typeof applyNextIncompleteLogSlot === 'function') {
    applyNextIncompleteLogSlot();
  } else {
    const maxWeek = state.sessions.reduce((m, s) => Math.max(m, s.week || 1), 1);
    if (maxWeek > state.currentWeek) state.currentWeek = maxWeek;
  }
  persistLocalState();
}

function coachWeekKey(week) {
  return String(parseInt(week, 10) || 1);
}

/** Cache coach suggestions locally so Log + Plan resolve from the same source. */
function cacheCoachSuggestions(doc) {
  if (!doc?.targetWeek) return doc;
  state.coachSuggestions[coachWeekKey(doc.targetWeek)] = doc;
  persistLocalState();
  return doc;
}

function buildCoachWeekContext(week) {
  const bundle = typeof getActiveProgramBundle === 'function' ? getActiveProgramBundle() : null;
  return {
    targetWeek: week,
    phaseLabel: bundle?.phaseLabel ? bundle.phaseLabel(week) : '',
  };
}

function buildCoachAthleteProfileSummary() {
  const bundle = typeof getActiveProgramBundle === 'function' ? getActiveProgramBundle() : null;
  return {
    displayName: bundle?.displayName || 'Athlete',
    programId: bundle?.id || null,
  };
}

async function fetchStoredCoachSuggestions(week) {
  const data = await apiCall('GET', `/coach/suggestions?week=${encodeURIComponent(week)}`);
  return cacheCoachSuggestions(data?.suggestions || data);
}

async function generateCoachSuggestions(week, refresh = false) {
  const bundle = typeof buildCoachProgramSummary === 'function' ? buildCoachProgramSummary() : null;
  if (!bundle?.days) throw new Error('Program summary unavailable');
  const data = await apiCall('POST', '/coach/program', {
    message: refresh ? `Regenerate week ${week} progression suggestions.` : `Generate week ${week} progression suggestions.`,
    task: 'progression_suggestions',
    targetWeek: week,
    refresh,
    activeProgramSummary: bundle,
    weekContext: buildCoachWeekContext(week),
    athleteProfileSummary: buildCoachAthleteProfileSummary(),
  }, 20000);
  return cacheCoachSuggestions(data?.suggestions || data);
}

async function ensureCoachSuggestionsForWeek(week, refresh = false) {
  const wk = parseInt(week, 10) || 1;
  if (wk <= 1) return null;
  if (!refresh) {
    const cached = state.coachSuggestions?.[coachWeekKey(wk)];
    if (cached?.slots) return cached;
  }
  if (!apiOnline) return state.coachSuggestions?.[coachWeekKey(wk)] || null;
  try {
    if (!refresh) {
      try {
        return await fetchStoredCoachSuggestions(wk);
      } catch (e) {
        if (!String(e?.message || '').includes('API 404')) throw e;
      }
    }
    return await generateCoachSuggestions(wk, refresh);
  } catch (e) {
    console.warn('coach suggestions unavailable', e);
    return state.coachSuggestions?.[coachWeekKey(wk)] || null;
  }
}

async function saveCoachSuggestionOverride(week, slotId, override) {
  // Overrides are persisted separately so future coach runs can preserve athlete edits.
  const data = await apiCall('PUT', '/coach/suggestions', {
    week,
    slotId,
    override,
  }, 20000);
  return cacheCoachSuggestions(data?.suggestions || data);
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
    exerciseId: setData.exerciseId,
    plannedExerciseName: setData.plannedExerciseName,
    plannedExerciseId: setData.plannedExerciseId,
    slotId: setData.slotId,
    loadScheme: setData.loadScheme,
    setNumber: setData.setNumber || 1,
    weightKg: setData.weight,
    reps: setData.reps,
    rpe: setData.rpe,
    completed: true,
    week: state.currentWeek,
  });
};

window._syncDeleteSetOp = async function (payload) {
  const sessionId = payload.sessionId || (await ensureApiSession());
  if (!sessionId || !payload.exercise) return;
  const q = new URLSearchParams({
    exercise: payload.exercise,
    setNumber: String(payload.setNumber || 1),
  });
  await apiCall('DELETE', `/sessions/${encodeURIComponent(sessionId)}/sets?${q.toString()}`);
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

async function syncSetDeleteToApi(setData, session) {
  if (!setData?.exercise) return;
  const payload = {
    exercise: setData.exercise,
    setNumber: setData.setNumber || 1,
    sessionId: session?.sessionId || activeApiSessionId,
    sid: setData.sid,
  };
  if (typeof dropQueuedSetSync === 'function') dropQueuedSetSync(setData.sid);
  if (!apiOnline) {
    enqueueSync({ type: 'deleteSet', payload });
    setSyncStatus('local', 'Local only');
    return;
  }
  try {
    setSyncStatus('syncing', 'Saving…');
    await window._syncDeleteSetOp(payload);
    if (session?.sessionId) await syncSessionToApi(session, false);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('set delete sync failed', e);
    enqueueSync({ type: 'deleteSet', payload });
    apiOnline = false;
    setSyncStatus('local', 'Local only');
  }
}

async function deleteCloudSession(sessionId, setSids = []) {
  if (!sessionId) return;
  if (typeof dropQueuedSessionOps === 'function') dropQueuedSessionOps(sessionId, setSids);
  if (!apiOnline) {
    enqueueSync({ type: 'deleteSession', sessionId });
    return;
  }
  try {
    setSyncStatus('syncing', 'Clearing…');
    await apiCall('DELETE', `/sessions/${encodeURIComponent(sessionId)}`);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('session delete failed', e);
    enqueueSync({ type: 'deleteSession', sessionId });
    apiOnline = false;
    setSyncStatus('local', 'Local only');
  }
}

async function syncSetToApi(setData) {
  if (!setData.reps) return;
  const payload = { ...setData, sessionId: setData.sessionId || activeApiSessionId || getInProgressSession()?.sessionId };
  if (!apiOnline) {
    enqueueSync({ type: 'set', payload });
    setSyncStatus('local', 'Local only');
    return;
  }
  try {
    setSyncStatus('syncing', 'Saving…');
    await window._syncSetOp(payload);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('set sync failed', e);
    enqueueSync({ type: 'set', payload });
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

/** Push session metadata + all logged sets; renames delete old DynamoDB set keys. */
async function syncSessionSetsToApi(session, originalSnapshot, completed) {
  if (!session?.sessionId) {
    await syncSessionToApi(session, completed);
    return;
  }
  await syncSessionToApi(session, completed);
  const snapshot = originalSnapshot || [];

  async function deleteSnap(snap) {
    if (!(snap.weight > 0 || snap.reps > 0)) return;
    const payload = {
      exercise: snap.exercise,
      setNumber: snap.setNumber,
      sessionId: session.sessionId,
    };
    if (!apiOnline) {
      enqueueSync({ type: 'deleteSet', payload });
      return;
    }
    try {
      await window._syncDeleteSetOp(payload);
    } catch (e) {
      console.warn('set delete sync failed', snap.exercise, e);
      enqueueSync({ type: 'deleteSet', payload });
      apiOnline = false;
      setSyncStatus('local', 'Local only');
    }
  }

  async function upsertSet(set, setNumber, snap) {
    const oldExercise = snap?.exercise;
    if (!apiOnline) {
      enqueueSync({
        type: 'set',
        payload: {
          ...set,
          setNumber,
          sessionId: session.sessionId,
          week: session.week,
        },
      });
      if (oldExercise && oldExercise !== set.exercise) {
        enqueueSync({
          type: 'deleteSet',
          payload: {
            exercise: oldExercise,
            setNumber: snap.setNumber || setNumber,
            sessionId: session.sessionId,
          },
        });
      }
      return;
    }
    try {
      if (oldExercise && oldExercise !== set.exercise) {
        await window._syncDeleteSetOp({
          exercise: oldExercise,
          setNumber: snap.setNumber || setNumber,
          sessionId: session.sessionId,
        });
      }
      await window._syncSetOp({
        exercise: set.exercise,
        exerciseId: set.exerciseId,
        plannedExerciseName: set.plannedExerciseName,
        plannedExerciseId: set.plannedExerciseId,
        slotId: set.slotId,
        loadScheme: set.loadScheme,
        setNumber,
        weight: set.weight,
        reps: set.reps,
        rpe: set.rpe,
        sessionId: session.sessionId,
        week: session.week,
      });
    } catch (e) {
      console.warn('set sync failed', set.exercise, e);
      enqueueSync({
        type: 'set',
        payload: {
          ...set,
          setNumber,
          sessionId: session.sessionId,
          week: session.week,
        },
      });
      apiOnline = false;
      setSyncStatus('local', 'Local only');
    }
  }

  const matchedSnap = new Set();
  await Promise.all(
    (session.sets || []).map((set, origIdx) => {
      if (!(set.weight > 0 || set.reps > 0)) return null;
      const snap = snapshot.find((s) => s._origIdx === origIdx);
      if (snap) matchedSnap.add(snap._origIdx);
      const setNumber = set.setNumber || snap?.setNumber || origIdx + 1;
      set.setNumber = setNumber;
      return upsertSet(set, setNumber, snap);
    }).filter(Boolean),
  );

  for (const snap of snapshot) {
    if (matchedSnap.has(snap._origIdx)) continue;
    const stillThere = session.sets[snap._origIdx];
    if (stillThere && stillThere.exercise === snap.exercise && (stillThere.weight > 0 || stillThere.reps > 0)) {
      continue;
    }
    await deleteSnap(snap);
  }
}

global.syncSessionSetsToApi = syncSessionSetsToApi;

function normalizeCloudPrefs(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    theme: ['auto', 'dark', 'light'].includes(raw.theme) ? raw.theme : 'auto',
    palette: raw.palette === 'forge' ? 'forge' : 'ember',
    units: raw.units === 'lb' ? 'lb' : 'kg',
    timerVibrate: raw.timerVibrate !== false,
    timerNotify: raw.timerNotify !== false,
  };
}

function prefsPayload() {
  return normalizeCloudPrefs(state.prefs) || {
    theme: 'auto',
    palette: 'ember',
    units: 'kg',
    timerVibrate: true,
    timerNotify: true,
  };
}

let prefsCloudSyncTimer = null;

async function syncPrefsToCloud() {
  if (!apiOnline || !getIdToken()) return;
  try {
    await apiCall('PUT', '/preferences', { prefs: prefsPayload() });
  } catch (e) {
    console.warn('prefs cloud sync failed', e);
  }
}

function schedulePrefsCloudSync() {
  clearTimeout(prefsCloudSyncTimer);
  prefsCloudSyncTimer = setTimeout(syncPrefsToCloud, 350);
}

async function loadCloudPrefs() {
  if (!getIdToken()) return;
  try {
    const data = await apiCall('GET', '/preferences');
    const cloud = normalizeCloudPrefs(data?.prefs);
    if (!cloud) return;
    state.prefs = { ...state.prefs, ...cloud };
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch { /* ignore */ }
    if (typeof applyAppearanceFromPrefs === 'function') applyAppearanceFromPrefs();
    if (typeof syncSettingsUi === 'function') syncSettingsUi();
    const us = document.getElementById('unitSelect');
    if (us) us.value = state.prefs.units || 'kg';
    const tv = document.getElementById('timerVibrate');
    if (tv) tv.checked = state.prefs.timerVibrate !== false;
    const tn = document.getElementById('timerNotify');
    if (tn) tn.checked = state.prefs.timerNotify !== false;
  } catch (e) {
    console.warn('prefs cloud load failed', e);
  }
}

function resolveSyncErrorStatus(err) {
  const msg = (err?.message || '').toLowerCase();
  if (msg.includes('not signed in') || msg.includes('session expired')) {
    return { mode: 'offline', label: 'Sign in required' };
  }
  if (msg.includes('401') || msg.includes('auth')) {
    return { mode: 'offline', label: 'Auth failed' };
  }
  if (msg.includes('abort') || msg.includes('timeout')) {
    return { mode: 'local', label: 'Connection timed out' };
  }
  return { mode: 'local', label: 'Local only' };
}

async function initApi() {
  loadSyncQueue();
  setSyncStatus('syncing', 'Connecting…');
  try {
    const work = (async () => {
      await apiCall('GET', '/summary');
      apiOnline = true;
      await loadCloudPrefs();
      await hydrateFromApi();
      await flushSyncQueue();
    })();
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Cloud sync timeout')), 30000);
    });
    await Promise.race([work, timeout]);
    setSyncStatus('connected', 'Synced');
  } catch (e) {
    console.warn('API unavailable, using local cache', e);
    apiOnline = false;
    loadLocalState();
    const st = resolveSyncErrorStatus(e);
    setSyncStatus(st.mode, st.label);
  } finally {
    apiReady = true;
  }
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
  if (typeof applyThemeFromPrefs === 'function') applyThemeFromPrefs();
  if (typeof syncSettingsUi === 'function') syncSettingsUi();
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(state.prefs)); } catch { /* ignore */ }
  schedulePrefsCloudSync();
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
      if (data.prefs) {
        const merged = normalizeCloudPrefs(data.prefs);
        if (merged) {
          state.prefs = { ...state.prefs, ...merged };
          savePrefs();
          if (typeof applyAppearanceFromPrefs === 'function') applyAppearanceFromPrefs();
          if (typeof syncSettingsUi === 'function') syncSettingsUi();
        }
      }
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

function safeRenderProgramViews() {
  try {
    if (typeof refreshAllProgramViews === 'function') {
      refreshAllProgramViews();
    } else {
      renderDashboard();
      renderSchedule();
      renderPlanPage();
      renderProgressPage();
    }
    renderHistory();
  } catch (e) {
    console.error('UI render failed', e);
  }
}

async function bootApp() {
  setSyncStatus('syncing', 'Connecting…');
  const email = typeof getIdTokenEmail === 'function' ? getIdTokenEmail() : null;
  try {
    if (typeof tryEnablePreviewFromUrl === 'function') tryEnablePreviewFromUrl(email);
    loadPrefs();
    loadLocalState();
    await initApi();
    if (typeof resolveProgramForUser === 'function') {
      await resolveProgramForUser(email);
    } else if (typeof applyProgramForSession === 'function') {
      applyProgramForSession(email);
    }
    if (typeof applyNextIncompleteLogSlot === 'function') {
      applyNextIncompleteLogSlot();
    } else if (typeof defaultGymDayForToday === 'function') {
      state.currentDay = defaultGymDayForToday();
    } else {
      state.currentDay = (typeof DAYS !== 'undefined' && DAYS[0]) || 'Mon';
    }
    if (typeof ensureCoachSuggestionsForWeek === 'function') {
      await ensureCoachSuggestionsForWeek(state.currentWeek);
    }
    safeRenderProgramViews();
  } catch (e) {
    console.error('bootApp failed', e);
    if (!apiReady) {
      try { await initApi(); } catch { /* initApi sets status */ }
    }
    try { safeRenderProgramViews(); } catch { /* ignore */ }
  }
  if (!apiReady) {
    apiReady = true;
    setSyncStatus(apiOnline ? 'connected' : 'local', apiOnline ? 'Synced' : 'Local only');
  }
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
  a.download='auxos-data-'+new Date().toISOString().slice(0,10)+'.json';
  a.click();
}
