/** @file Log workout page and set tracking. */
/* ═══════════════════════════════════════════════════════════════
   LOG WORKOUT PAGE
═══════════════════════════════════════════════════════════════ */
function getCompletedSessionForSlot(week, day) {
  return state.sessions.find(s => s.week === week && s.day === day && s.completed);
}

function getLastCompletedSessionForDay(day) {
  const matches = state.sessions.filter(s => s.completed && s.day === day);
  matches.sort((a, b) => {
    if (b.week !== a.week) return b.week - a.week;
    const da = Date.parse(a.completedAt || a.date) || 0;
    const db = Date.parse(b.completedAt || b.date) || 0;
    return db - da;
  });
  return matches[0] || null;
}

function getLastSetsForExercise(exerciseName, day) {
  const session = getLastCompletedSessionForDay(day);
  if (!session) return null;
  const sets = session.sets
    .filter(s => s.exercise === exerciseName && (s.weight > 0 || s.reps > 0))
    .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
  return sets.length ? sets : null;
}

function formatLastTimeSummary(sets) {
  return sets.map(s => {
    const w = displayWeight(s.weight);
    const rpe = s.rpe ? ` @${s.rpe}` : '';
    return `${w}${weightUnitLabel()}×${s.reps}${rpe}`;
  }).join(' · ');
}

function findExerciseCard(exName) {
  return [...document.querySelectorAll('#workoutContent .exercise-card')].find(
    card => card.querySelector('.exercise-name')?.textContent === exName
  );
}

function fillExerciseSets(exName, priorSets) {
  const card = findExerciseCard(exName);
  if (!card || !priorSets?.length) return;
  const rows = card.querySelectorAll('tbody tr.set-row');
  priorSets.forEach((set, i) => {
    if (i >= rows.length) return;
    const sid = rows[i].id;
    const wEl = document.getElementById(sid + '-w');
    const rEl = document.getElementById(sid + '-r');
    const rpeEl = document.getElementById(sid + '-rpe');
    if (wEl) wEl.value = displayWeight(set.weight);
    if (rEl) rEl.value = set.reps;
    if (rpeEl && set.rpe) rpeEl.value = set.rpe;
  });
}

function syncDomSetsToState() {
  document.querySelectorAll('#workoutContent tr.set-row').forEach(row => {
    const sid = row.id;
    const exName = row.closest('.exercise-card')?.querySelector('.exercise-name')?.textContent;
    if (!exName || !sid) return;
    const wEl = document.getElementById(sid + '-w');
    const rEl = document.getElementById(sid + '-r');
    const w = parseFloat(wEl?.value);
    const r = parseInt(rEl?.value, 10);
    if ((Number.isFinite(w) && w > 0) || (Number.isFinite(r) && r > 0)) {
      saveSetToState(sid, exName);
    }
  });
}

function applyInProgressSets(session) {
  const byEx = {};
  session.sets.forEach(s => {
    if (!byEx[s.exercise]) byEx[s.exercise] = [];
    byEx[s.exercise].push(s);
  });
  Object.entries(byEx).forEach(([ex, sets]) => {
    sets.sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
    fillExerciseSets(ex, sets);
    sets.forEach(s => {
      if (!s.sid) return;
      const row = document.getElementById(s.sid);
      const btn = document.getElementById(s.sid + '-done');
      if (row && btn && (s.weight > 0 || s.reps > 0)) {
        btn.classList.add('checked');
        row.classList.add('done');
      }
    });
  });
}

function updateLogRepeatUi() {
  const repeatBtn = document.getElementById('repeatLastBtn');
  const hint = document.getElementById('logRepeatHint');
  const last = getLastCompletedSessionForDay(state.currentDay);
  const completed = getCompletedSessionForSlot(state.currentWeek, state.currentDay);
  if (repeatBtn) {
    const show = last && !completed;
    repeatBtn.style.display = show ? 'inline-flex' : 'none';
    if (show) {
      repeatBtn.title = `Copy sets from Week ${last.week} (${last.date})`;
    }
  }
  if (hint) {
    if (last && !completed) {
      hint.classList.remove('hidden');
      hint.textContent = `Last ${PROGRAM[state.currentDay]?.label || state.currentDay}: Week ${last.week} · ${last.date} — tap Repeat last to pre-fill.`;
    } else {
      hint.classList.add('hidden');
      hint.textContent = '';
    }
  }
}

function repeatLastWorkout() {
  const last = getLastCompletedSessionForDay(state.currentDay);
  if (!last) {
    alert('No previous session for this day yet.');
    return;
  }
  if (!confirm(`Copy sets from Week ${last.week} (${last.date})? This replaces any in-progress log for this slot.`)) {
    return;
  }
  state.sessions = state.sessions.filter(
    s => !(s.week === state.currentWeek && s.day === state.currentDay && !s.completed)
  );
  activeApiSessionId = null;
  renderLogPage();
  requestAnimationFrame(() => {
    const byEx = {};
    last.sets
      .filter(s => s.weight > 0 || s.reps > 0)
      .forEach(s => {
        if (!byEx[s.exercise]) byEx[s.exercise] = [];
        byEx[s.exercise].push(s);
      });
    Object.entries(byEx).forEach(([ex, sets]) => {
      sets.sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
      fillExerciseSets(ex, sets);
    });
    syncDomSetsToState();
    showSaveToast('Last workout copied — adjust weights and go');
  });
}

function viewHistoricWorkout(week, day) {
  const session = getCompletedSessionForSlot(week, day);
  if (!session) return;
  const idx = state.sessions.indexOf(session);
  if (idx < 0) return;
  const nav = document.querySelector('.nav-item[data-page="history"]');
  showPage('history', nav);
  requestAnimationFrame(() => openSessionModal(idx, false));
}

function renderLogCompletedBanner(session) {
  const day = PROGRAM[session.day];
  const doneSets = session.sets.filter(x => x.weight > 0 || x.reps > 0);
  const bestE1rm = doneSets.length ? Math.max(...doneSets.map(x => x.e1rm || 0)) : 0;
  const label = day?.label || session.day;
  const banner = document.getElementById('logCompletedBanner');
  if (!banner) return;
  banner.classList.remove('hidden');
  banner.innerHTML = `
    <h3>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Workout completed
    </h3>
    <p><strong>${label}</strong> · Week ${session.week} · ${session.date}<br>
    ${doneSets.length} sets logged${bestE1rm > 0 ? ` · Best E1RM <strong>${bestE1rm}kg</strong>` : ''}.</p>
    <div class="log-completed-actions">
      <button type="button" class="btn btn-primary" onclick="viewHistoricWorkout(${session.week},'${session.day}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        View workout in history
      </button>
    </div>`;
}

function hideLogCompletedBanner() {
  const banner = document.getElementById('logCompletedBanner');
  if (banner) {
    banner.classList.add('hidden');
    banner.innerHTML = '';
  }
}

function renderLogPage() {
  activeApiSessionId = null;
  const inProgress = state.sessions.find(s => s.week === state.currentWeek && s.day === state.currentDay && !s.completed);
  if (inProgress?.sessionId) activeApiSessionId = inProgress.sessionId;
  // Week tabs
  const wt = document.getElementById('logWeekTabs');
  wt.innerHTML = '';
  for(let w=1;w<=12;w++){
    const isDeload = [6,12].includes(w);
    const btn = document.createElement('button');
    btn.className = 'week-tab'+(w===state.currentWeek?' active':'')+(isDeload?' deload':'');
    btn.textContent = 'W'+w;
    btn.onclick = ()=>{ state.currentWeek=w; renderLogPage(); };
    wt.appendChild(btn);
  }
  // Day tabs
  const dt = document.getElementById('dayTabs');
  dt.innerHTML = '';
  DAYS.forEach(d=>{
    const btn = document.createElement('button');
    const done = getCompletedSessionForSlot(state.currentWeek, d);
    btn.className = 'day-tab'+(d===state.currentDay?' active':'')+(done?' completed':'');
    btn.textContent = {Mon:'Mon',Tue:'Tue',Thu:'Thu',Fri:'Fri'}[d];
    btn.title = done ? 'Completed — view in history' : '';
    btn.onclick = ()=>{ state.currentDay=d; renderLogPage(); };
    dt.appendChild(btn);
  });

  const completed = getCompletedSessionForSlot(state.currentWeek, state.currentDay);
  const actions = document.getElementById('logSessionActions');
  const wc = document.getElementById('workoutContent');
  wc.innerHTML = '';

  if (completed) {
    renderLogCompletedBanner(completed);
    document.getElementById('deloadBanner').style.display = 'none';
    if (actions) actions.classList.add('is-hidden');
    const hint = document.getElementById('logRepeatHint');
    if (hint) { hint.classList.add('hidden'); hint.textContent = ''; }
    const repeatBtn = document.getElementById('repeatLastBtn');
    if (repeatBtn) repeatBtn.style.display = 'none';
    wc.innerHTML = '<p class="log-completed-hint">This session is finished. Use the button above to review your logged sets, or switch to another day to log a new workout.</p>';
    return;
  }

  hideLogCompletedBanner();
  if (actions) actions.classList.remove('is-hidden');
  document.getElementById('deloadBanner').style.display = [6,12].includes(state.currentWeek)?'flex':'none';

  const day = PROGRAM[state.currentDay];
  // Warmup
  const wu = document.createElement('div');
  wu.className = 'warmup-section';
  wu.innerHTML = `
    <div class="warmup-header" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none'">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
      <span class="warmup-header-title">Warm-Up Protocol</span>
      <span class="badge badge-warning" style="margin-left:auto;font-size:10px">5–8 min</span>
    </div>
    <div class="warmup-body">
      ${day.warmup.map((w,i)=>`
        <div class="warmup-item" id="wu-${state.currentDay}-${i}">
          <input type="checkbox" class="warmup-check" onchange="toggleWarmupItem(this,'wu-${state.currentDay}-${i}')">
          <span class="warmup-text">${w}</span>
        </div>
      `).join('')}
    </div>`;
  wc.appendChild(wu);

  // Exercise blocks
  day.blocks.forEach((block, bi) => {
    if(block.type === 'superset' || block.type === 'core') {
      const wrapper = document.createElement('div');
      wrapper.className = 'superset-block';
      const tag = block.type === 'core' ? 'Core Block' : block.label;
      const tagClass = block.type === 'core' ? 'badge-accent' : 'badge-purple';
      const tagStyle = block.type === 'core' ? 'background:var(--accent-dim);color:var(--accent)' : '';
      wrapper.innerHTML = `
        <div class="superset-label">
          <span class="superset-tag" style="${tagStyle}">${tag}</span>
          ${block.type==='superset'?'<span class="superset-hint">Perform exercises back-to-back with minimal rest between</span>':''}
        </div>`;
      block.exercises.forEach((ex, ei) => {
        wrapper.appendChild(buildExerciseCard(ex, bi, ei, true));
      });
      wc.appendChild(wrapper);
    } else {
      // standalone
      block.exercises.forEach((ex, ei) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'standalone-block';
        wrapper.appendChild(buildExerciseCard(ex, bi, ei, false));
        wc.appendChild(wrapper);
      });
    }
  });

  updateLogRepeatUi();
  const inProgressSets = getInProgressSession();
  if (inProgressSets?.sets?.length) {
    requestAnimationFrame(() => applyInProgressSets(inProgressSets));
  }
}

function buildExerciseCard(ex, bi, ei, inSuper) {
  const deload = [6,12].includes(state.currentWeek);
  const baseW = ex.weight;
  const targetW = deload ? Math.round(baseW*0.6*2)/2 : baseW;
  const card = document.createElement('div');
  card.className = 'exercise-card'+(inSuper?' in-superset':'');
  card.id = `ex-${state.currentDay}-${bi}-${ei}`;

  const lastSets = getLastSetsForExercise(ex.name, state.currentDay);
  const lastHint = lastSets
    ? `<div class="last-time-hint"><strong>Last time:</strong> ${formatLastTimeSummary(lastSets)}</div>`
    : '';

  let setsHtml = '';
  for(let s=0;s<ex.sets;s++){
    const sid = `set-${state.currentDay}-${bi}-${ei}-${s}`;
    setsHtml += `
      <tr class="set-row" id="${sid}">
        <td class="set-num">${s+1}</td>
        <td><input type="number" class="set-input" id="${sid}-w" placeholder="${targetW}" min="0" step="0.5" style="width:68px"></td>
        <td><input type="number" class="set-input" id="${sid}-r" placeholder="${ex.repsTarget.split('–')[0]}" min="0" style="width:56px"></td>
        <td><input type="number" class="set-input" id="${sid}-rpe" placeholder="${ex.rpe}" min="1" max="10" step="0.5" style="width:52px"></td>
        <td><span class="badge badge-muted" style="font-size:10px">${ex.rest}s</span></td>
        <td>
          <button class="set-done-btn" id="${sid}-done" onclick="markSetDone('${sid}','${ex.name}',${ex.rest})" aria-label="Mark done">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
        </td>
      </tr>`;
  }

  card.innerHTML = `
    <div class="exercise-header">
      <div>
        <div class="exercise-name">${ex.name}</div>
        <div class="exercise-meta">
          <span class="badge badge-muted">${ex.sets}×${ex.repsTarget}</span>
          <span class="badge badge-muted">Tempo ${ex.tempo}</span>
          <span class="badge badge-accent">RPE ${ex.rpe}</span>
          <span class="badge badge-muted">Rest ${ex.rest}s</span>
        </div>
        <div class="exercise-notes">${ex.notes}</div>
        ${lastHint}
        <div style="font-size:11px;color:var(--text-faint);margin-top:4px">Alt: ${ex.alt}</div>
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="sets-table">
        <thead><tr>
          <th style="width:32px">Set</th>
          <th>Weight (kg)</th>
          <th>Reps</th>
          <th>RPE</th>
          <th>Rest</th>
          <th>Done</th>
        </tr></thead>
        <tbody>${setsHtml}</tbody>
      </table>
    </div>
    <button class="add-set-btn" onclick="addSet(this,'${JSON.stringify(ex).replace(/'/g,"\\'")}',${bi},${ei})">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Add set
    </button>`;
  return card;
}

function toggleWarmupItem(cb, itemId) {
  const item = document.getElementById(itemId);
  if(cb.checked) item.classList.add('done');
  else item.classList.remove('done');
}

function addSet(btn, exJson, bi, ei) {
  try {
    const ex = JSON.parse(exJson);
    const tbody = btn.previousElementSibling.querySelector('tbody');
    const setNum = tbody.rows.length + 1;
    const sid = `set-${state.currentDay}-${bi}-${ei}-${setNum-1}`;
    const deload = [6,12].includes(state.currentWeek);
    const targetW = deload ? Math.round(ex.weight*0.6*2)/2 : ex.weight;
    const tr = document.createElement('tr');
    tr.className = 'set-row';
    tr.id = sid;
    tr.innerHTML = `
      <td class="set-num">${setNum}</td>
      <td><input type="number" class="set-input" id="${sid}-w" placeholder="${targetW}" min="0" step="0.5" style="width:68px"></td>
      <td><input type="number" class="set-input" id="${sid}-r" placeholder="${ex.repsTarget.split('–')[0]}" min="0" style="width:56px"></td>
      <td><input type="number" class="set-input" id="${sid}-rpe" placeholder="${ex.rpe}" min="1" max="10" step="0.5" style="width:52px"></td>
      <td><span class="badge badge-muted" style="font-size:10px">${ex.rest}s</span></td>
      <td>
        <button class="set-done-btn" id="${sid}-done" onclick="markSetDone('${sid}','${ex.name}',${ex.rest})" aria-label="Mark done">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </td>`;
    tbody.appendChild(tr);
  } catch(e) { console.error(e); }
}

function markSetDone(sid, exName, restSec) {
  const row = document.getElementById(sid);
  const btn = document.getElementById(sid+'-done');
  const isDone = btn.classList.contains('checked');
  const rest = getExerciseRest(exName, restSec);
  if(!isDone) {
    btn.classList.add('checked');
    row.classList.add('done');
    startTimer(exName, rest);
    saveSetToState(sid, exName);
  } else {
    btn.classList.remove('checked');
    row.classList.remove('done');
  }
}

function parseSetNumber(sid) {
  const parts = sid.split('-');
  const n = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(n) ? n + 1 : 1;
}

function getInProgressSession() {
  return state.sessions.find(s => s.week === state.currentWeek && s.day === state.currentDay && !s.completed);
}

function saveSetToState(sid, exName) {
  const w = parseFloat(document.getElementById(sid+'-w')?.value || document.getElementById(sid+'-w')?.placeholder || 0);
  const r = parseInt(document.getElementById(sid+'-r')?.value || document.getElementById(sid+'-r')?.placeholder || 0, 10);
  const rpe = parseFloat(document.getElementById(sid+'-rpe')?.value || document.getElementById(sid+'-rpe')?.placeholder || 7);
  const e1rm = w > 0 && r > 0 ? Math.round(w * (1 + r / 30) * 10) / 10 : 0;
  const setNumber = parseSetNumber(sid);
  const setData = { exercise: exName, weight: w, reps: r, rpe, e1rm, sid, setNumber };
  let existing = getInProgressSession();
  if (!existing) {
    existing = {
      sessionId: activeApiSessionId || null,
      date: new Date().toLocaleDateString('en-AU'),
      week: state.currentWeek,
      day: state.currentDay,
      sets: [],
      completed: false
    };
    state.sessions.push(existing);
  }
  const idx = existing.sets.findIndex(s => s.sid === sid);
  if (idx >= 0) existing.sets[idx] = setData;
  else existing.sets.push(setData);
  persistLocalState();
  syncSetToApi(setData);
}

function getHistoricalBestE1rm(exercise, excludeSessionId) {
  let best = 0;
  state.sessions.filter(s => s.completed && s.sessionId !== excludeSessionId).forEach(s => {
    s.sets.forEach(set => {
      if (set.exercise === exercise && (set.e1rm || 0) > best) best = set.e1rm;
    });
  });
  return best;
}

function buildSessionStats(session, doneSets) {
  const totalVolume = doneSets.reduce((a, x) => a + (x.weight || 0) * (x.reps || 0), 0);
  const bestE1rm = doneSets.length ? Math.max(...doneSets.map(s => s.e1rm || 0)) : 0;
  const topSet = doneSets.find(s => s.e1rm === bestE1rm);
  const byExercise = {};
  doneSets.forEach(set => {
    if (!byExercise[set.exercise]) byExercise[set.exercise] = { volume: 0, bestE1rm: 0, sets: 0 };
    byExercise[set.exercise].volume += (set.weight || 0) * (set.reps || 0);
    byExercise[set.exercise].sets += 1;
    if ((set.e1rm || 0) > byExercise[set.exercise].bestE1rm) byExercise[set.exercise].bestE1rm = set.e1rm;
  });
  const prs = [];
  Object.entries(byExercise).forEach(([name, data]) => {
    const prev = getHistoricalBestE1rm(name, session.sessionId);
    if (data.bestE1rm > 0 && data.bestE1rm > prev) {
      prs.push({ exercise: name, e1rm: data.bestE1rm, prev: prev || null });
    }
  });
  return { totalVolume, bestE1rm, topSet, byExercise, prs, totalSets: doneSets.length };
}

function showCompleteSummary(session, doneSets) {
  const stats = buildSessionStats(session, doneSets);
  const dayLabel = PROGRAM[session.day]?.label || session.day;
  document.getElementById('completeSummarySubtitle').textContent =
    `${session.date} · Week ${session.week} · ${dayLabel}`;
  document.getElementById('completeKpiRow').innerHTML = `
    <div class="complete-kpi">
      <div class="complete-kpi-val">${stats.totalSets}</div>
      <div class="complete-kpi-lbl">Sets logged</div>
    </div>
    <div class="complete-kpi">
      <div class="complete-kpi-val">${Math.round(stats.totalVolume).toLocaleString()}kg</div>
      <div class="complete-kpi-lbl">Total volume</div>
    </div>
    <div class="complete-kpi">
      <div class="complete-kpi-val">${stats.bestE1rm > 0 ? stats.bestE1rm + 'kg' : '—'}</div>
      <div class="complete-kpi-lbl">Best E1RM${stats.topSet ? ' · ' + stats.topSet.exercise.split(' ')[0] : ''}</div>
    </div>`;
  const prSection = document.getElementById('completePrSection');
  const prList = document.getElementById('completePrList');
  if (stats.prs.length) {
    prSection.style.display = 'block';
    prList.innerHTML = stats.prs.map(p => `
      <div class="complete-pr-item is-pr">
        <span>${p.exercise}</span>
        <span><span class="complete-pr-badge">PR</span> ${p.e1rm}kg${p.prev ? ` <span style="color:var(--text-faint);font-weight:400">(was ${p.prev}kg)</span>` : ''}</span>
      </div>`).join('');
  } else {
    prSection.style.display = 'none';
  }
  const liftList = document.getElementById('completeLiftList');
  liftList.innerHTML = Object.entries(stats.byExercise)
    .sort((a, b) => b[1].volume - a[1].volume)
    .map(([name, d]) => `
      <div class="complete-pr-item">
        <span>${name}</span>
        <span style="font-variant-numeric:tabular-nums">${Math.round(d.volume)}kg vol · ${d.bestE1rm}kg E1RM</span>
      </div>`).join('');
  document.getElementById('completeSummary').classList.add('open');
  document.getElementById('completeSummary').setAttribute('aria-hidden', 'false');
}

function dismissCompleteSummary() {
  document.getElementById('completeSummary').classList.remove('open');
  document.getElementById('completeSummary').setAttribute('aria-hidden', 'true');
  showPage('dashboard', document.querySelector('.nav-item[data-page="dashboard"]'));
  renderDashboard();
  renderHistory();
  renderLogPage();
}

async function completeSession() {
  const session = getInProgressSession();
  if (!session) { alert('Log at least one set first!'); return; }
  const doneSets = session.sets.filter(x => x.weight > 0 || x.reps > 0);
  if (!doneSets.length) { alert('Log at least one set with weight and reps first!'); return; }
  session.completed = true;
  session.completedAt = new Date().toISOString();
  await syncSessionToApi(session, true);
  activeApiSessionId = null;
  persistLocalState();
  showCompleteSummary(session, doneSets);
}

async function deleteSession(idx) {
  const s = state.sessions[idx];
  if (!s) return;
  if (!confirm(`Delete this workout (${s.date}, Week ${s.week} ${s.day})? This cannot be undone.`)) return;
  try {
    if (apiOnline && s.sessionId) {
      setSyncStatus('syncing', 'Deleting…');
      await apiCall('DELETE', `/sessions/${encodeURIComponent(s.sessionId)}`);
    }
    state.sessions.splice(idx, 1);
    persistLocalState();
    closeSessionModal();
    renderHistory();
    renderDashboard();
    renderProgressPage();
    renderLogPage();
    setSyncStatus(apiOnline ? 'connected' : 'offline', apiOnline ? 'Synced' : 'Offline');
  } catch (e) {
    alert('Could not delete: ' + e.message);
    setSyncStatus('offline', 'Offline');
  }
}

function clearSession() {
  if (!confirm('Clear this session?')) return;
  state.sessions = state.sessions.filter(s => !(s.week === state.currentWeek && s.day === state.currentDay && !s.completed));
  activeApiSessionId = null;
  persistLocalState();
  renderLogPage();
}

async function saveSessionProgress() {
  const existing = getInProgressSession();
  if (existing) {
    existing.savedAt = new Date().toISOString();
    await syncSessionToApi(existing, false);
  }
  persistLocalState();
  showSaveToast(apiOnline ? 'Progress saved to cloud ✓' : 'Progress saved locally ✓');
}

function showSaveToast(msg) {
  const t = document.getElementById('saveToast');
  t.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>${msg}`;
  t.style.display = 'block';
  t.style.animation = 'slideUp 200ms ease';
  setTimeout(()=>{ t.style.display='none'; }, 2500);
}

