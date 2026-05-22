/** @file Log workout page and set tracking. */
/* ═══════════════════════════════════════════════════════════════
   LOG WORKOUT PAGE
═══════════════════════════════════════════════════════════════ */

let swapSheetSlotId = null;
let swapSheetPlannedEx = null;
let swapSheetSelectedId = null;
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
    const w = formatWeightWithUnit(s.weight);
    const rpe = s.rpe ? ` @${s.rpe}` : '';
    return `${w}×${s.reps}${rpe}`;
  }).join(' · ');
}

function isRepsPerSide(repsTarget) {
  if (!repsTarget) return false;
  const t = String(repsTarget).toLowerCase();
  return /\beach\b/.test(t) || /\bper\s*side\b/.test(t) || /\be\/s\b/.test(t);
}

function repsColumnLabel(ex) {
  return isRepsPerSide(ex.repsTarget) ? 'REPS E/S' : 'REPS';
}

function repsPlaceholder(repsTarget) {
  if (!repsTarget) return '';
  const cleaned = String(repsTarget)
    .replace(/\s*(each\s*side|each|per\s*side|e\/s|e\.s\.)\s*$/i, '')
    .trim();
  const range = cleaned.match(/^(\d+)\s*[–-]\s*(\d+)/);
  if (range) return range[1];
  const leading = cleaned.match(/^(\d+)/);
  if (leading) return leading[1];
  return cleaned.split(/\s/)[0] || '';
}

function formatRepsTargetBadge(repsTarget) {
  if (!repsTarget) return '';
  if (!isRepsPerSide(repsTarget)) return repsTarget;
  const base = String(repsTarget)
    .replace(/\s*(each\s*side|each|per\s*side|e\/s|e\.s\.)\s*$/i, '')
    .trim();
  return `${base} E/S`;
}

/** Plate calculator only applies to barbell-style loading (not DB, cable, or stack machines). */
function exerciseUsesPlates(ex) {
  const name = (ex?.name || '').toLowerCase();
  const alt = (ex?.alt || '').toLowerCase();
  const combined = `${name} ${alt}`;
  if (/\b(dumbbell|dumbbells|\bdb\b|d\.b\.|cable|kettlebell|\bkb\b)\b/.test(combined)) return false;
  if (/\b(pull-up|pullup|chin-up|push-up|dip|nordic|glute-ham|bodyweight|body weight)\b/.test(combined)) {
    return false;
  }
  if (/\bmachine\b/.test(name) && !/\bbarbell\b/.test(name)) return false;
  if (/\b(barbell|ez bar|trap bar)\b/.test(combined)) return true;
  if (/\bbar\b/.test(name) && !/\b(machine|dumbbell|\bdb\b|cable)\b/.test(name)) return true;
  return false;
}

function getExerciseCard(sidOrSlotId) {
  if (!sidOrSlotId) return null;
  if (sidOrSlotId.startsWith('set-')) {
    return document.getElementById(sidOrSlotId)?.closest('.exercise-card');
  }
  return document.querySelector(`.exercise-card[data-slot-id="${sidOrSlotId}"]`);
}

function getCardExerciseContext(card) {
  if (!card) return null;
  return {
    slotId: card.dataset.slotId,
    exerciseName: card.dataset.exerciseName,
    exerciseId: card.dataset.exerciseId,
    plannedExerciseName: card.dataset.plannedExerciseName,
    plannedExerciseId: card.dataset.plannedExerciseId,
    rest: parseInt(card.dataset.rest, 10) || 60,
  };
}

function isCardSwapped(card) {
  if (!card) return false;
  return card.dataset.exerciseId !== card.dataset.plannedExerciseId;
}

function formatSwapLastHint(name) {
  const sets = getLastSetsForExercise(name, state.currentDay);
  if (!sets) return 'No prior log for this day';
  return `Last: ${formatLastTimeSummary(sets)}`;
}

function updateCardLastTimeHint(card, exerciseName) {
  const el = card.querySelector('.last-time-hint');
  if (!el) return;
  const sets = getLastSetsForExercise(exerciseName, state.currentDay);
  if (!sets) {
    el.remove();
    return;
  }
  el.innerHTML = `<strong>Last time:</strong> ${formatLastTimeSummary(sets)}`;
}

function updateCardSwappedBanner(card) {
  const existing = card.querySelector('.exercise-swapped-from');
  if (!isCardSwapped(card)) {
    existing?.remove();
    card.classList.remove('is-swapped');
    return;
  }
  const text = `Swapped from ${card.dataset.plannedExerciseName}`;
  if (existing) {
    existing.textContent = text;
  } else {
    const banner = document.createElement('div');
    banner.className = 'exercise-swapped-from';
    banner.textContent = text;
    const row = card.querySelector('.exercise-name-row');
    row?.insertAdjacentElement('afterend', banner);
  }
  card.classList.add('is-swapped');
}

function refreshSetRowPlateButtons(card, exTemplate) {
  const pseudoEx = {
    name: card.dataset.exerciseName,
    alt: exTemplate?.alt || '',
  };
  const usesPlates = exerciseUsesPlates(pseudoEx);
  card.querySelectorAll('tr.set-row').forEach((row) => {
    const sid = row.id;
    const cell = row.querySelector('.set-weight-cell .set-weight-wrap, .set-weight-cell > div');
    if (!cell) return;
    const input = document.getElementById(`${sid}-w`);
    const plateBtn = row.querySelector('.set-plate-btn');
    if (usesPlates && !plateBtn) {
      cell.classList.remove('set-weight-wrap--full');
      cell.classList.add('set-weight-wrap');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'set-plate-btn';
      btn.setAttribute('onclick', `openPlatesFromWeight('${sid}')`);
      btn.title = 'Plates Calculator';
      btn.setAttribute('aria-label', 'Plates Calculator');
      btn.textContent = '⊕';
      cell.appendChild(btn);
    } else if (!usesPlates && plateBtn) {
      plateBtn.remove();
      cell.classList.remove('set-weight-wrap');
      cell.classList.add('set-weight-wrap', 'set-weight-wrap--full');
    }
    if (input && !usesPlates) {
      const wrap = input.closest('.set-weight-wrap');
      wrap?.classList.add('set-weight-wrap--full');
    }
  });
}

function applySwapToCard(card, swap, persist) {
  if (!card || !swap) return;
  card.dataset.exerciseName = swap.exerciseName;
  card.dataset.exerciseId = swap.exerciseId;
  const nameEl = card.querySelector('.exercise-name');
  if (nameEl) nameEl.textContent = swap.exerciseName;
  updateCardSwappedBanner(card);
  updateCardLastTimeHint(card, swap.exerciseName);
  const exTemplate = card._plannedExTemplate;
  if (exTemplate) refreshSetRowPlateButtons(card, exTemplate);
  if (persist) persistExerciseSwap(card.dataset.slotId, swap);
}

function persistExerciseSwap(slotId, swap) {
  let session = getInProgressSession();
  if (!session) {
    session = {
      sessionId: activeApiSessionId || null,
      date: new Date().toLocaleDateString('en-AU'),
      week: state.currentWeek,
      day: state.currentDay,
      sets: [],
      exerciseSwaps: {},
      completed: false,
    };
    state.sessions.push(session);
  }
  if (!session.exerciseSwaps) session.exerciseSwaps = {};
  const plannedId = swap.plannedExerciseId;
  if (swap.exerciseId === plannedId) {
    delete session.exerciseSwaps[slotId];
  } else {
    session.exerciseSwaps[slotId] = {
      plannedExerciseName: swap.plannedExerciseName,
      plannedExerciseId: swap.plannedExerciseId,
      exerciseName: swap.exerciseName,
      exerciseId: swap.exerciseId,
    };
  }
  session.sets.forEach((set) => {
    if (set.slotId === slotId || sidMatchesSlot(set.sid, slotId)) {
      set.exercise = swap.exerciseName;
      set.exerciseId = swap.exerciseId;
      set.plannedExerciseId = swap.plannedExerciseId;
      set.plannedExerciseName = swap.plannedExerciseName;
      set.slotId = slotId;
    }
  });
  persistLocalState();
}

function applyExerciseSwaps(session) {
  if (!session?.exerciseSwaps) return;
  Object.entries(session.exerciseSwaps).forEach(([slotId, swap]) => {
    const card = getExerciseCard(slotId);
    if (card) applySwapToCard(card, swap, false);
  });
}

function openExerciseSwapSheet(slotId) {
  const card = getExerciseCard(slotId);
  if (!card || !card._plannedExTemplate) return;
  if (getSuggestedExercises(card._plannedExTemplate).length <= 1) return;
  swapSheetSlotId = slotId;
  swapSheetPlannedEx = card._plannedExTemplate;
  swapSheetSelectedId = card.dataset.exerciseId;
  document.getElementById('exerciseSwapSubtitle').textContent =
    `Planned: ${card.dataset.plannedExerciseName}`;
  renderExerciseSwapOptions();
  document.getElementById('exerciseSwapModal')?.classList.add('open');
}

function closeExerciseSwapModal() {
  document.getElementById('exerciseSwapModal')?.classList.remove('open');
  swapSheetSlotId = null;
  swapSheetPlannedEx = null;
  swapSheetSelectedId = null;
}

function renderExerciseSwapOptions() {
  const list = document.getElementById('exerciseSwapList');
  if (!list || !swapSheetPlannedEx) return;
  const options = getSuggestedExercises(swapSheetPlannedEx);
  list.innerHTML = `
    <p class="exercise-swap-section-label">Suggested for this slot</p>
    ${options
      .map((opt) => {
        const selected = opt.id === swapSheetSelectedId;
        return `<button type="button" class="exercise-swap-option${selected ? ' is-selected' : ''}"
          data-exercise-id="${opt.id}"
          onclick="selectExerciseSwapOption('${opt.id}')">
          <div class="exercise-swap-option-name">${opt.name}</div>
          <div class="exercise-swap-option-meta">${formatSwapLastHint(opt.name)}</div>
        </button>`;
      })
      .join('')}`;
}

function selectExerciseSwapOption(exerciseId) {
  swapSheetSelectedId = exerciseId;
  document.querySelectorAll('#exerciseSwapList .exercise-swap-option').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.exerciseId === exerciseId);
  });
}

function confirmExerciseSwap() {
  const card = getExerciseCard(swapSheetSlotId);
  if (!card || !swapSheetPlannedEx || !swapSheetSelectedId) {
    closeExerciseSwapModal();
    return;
  }
  const chosen = getSuggestedExercises(swapSheetPlannedEx).find((o) => o.id === swapSheetSelectedId);
  if (!chosen) {
    closeExerciseSwapModal();
    return;
  }
  const swap = {
    plannedExerciseName: card.dataset.plannedExerciseName,
    plannedExerciseId: card.dataset.plannedExerciseId,
    exerciseName: chosen.name,
    exerciseId: chosen.id,
  };
  const wasPlanned = swapSheetSelectedId === card.dataset.plannedExerciseId;
  applySwapToCard(card, swap, true);
  closeExerciseSwapModal();
  showSaveToast(wasPlanned ? 'Restored planned exercise' : `Using ${chosen.name}`);
}

function buildSetRowHtml(sid, setNum, targetW, ex, showCopy) {
  const wPlaceholder = displayWeight(targetW);
  const repsPh = repsPlaceholder(ex.repsTarget);
  const copyBtn = showCopy
    ? `<button type="button" class="set-copy-btn" onclick="copyPreviousSet('${sid}')" title="Copy previous set" aria-label="Copy previous set">↑</button>`
    : '';
  const plateBtn = exerciseUsesPlates(ex)
    ? `<button type="button" class="set-plate-btn" onclick="openPlatesFromWeight('${sid}')" title="Plates Calculator" aria-label="Plates Calculator">⊕</button>`
    : '';
  const weightWrapClass = plateBtn ? 'set-weight-wrap' : 'set-weight-wrap set-weight-wrap--full';
  return `
      <td class="set-num">${setNum}</td>
      <td class="set-weight-cell">
        <div class="${weightWrapClass}">
          <input type="number" class="set-input set-weight-input" id="${sid}-w" placeholder="${wPlaceholder}" min="0" step="0.5" inputmode="decimal" enterkeyhint="next" autocomplete="off">
          ${plateBtn}
        </div>
      </td>
      <td><input type="number" class="set-input" id="${sid}-r" placeholder="${repsPh}" min="1" inputmode="numeric" enterkeyhint="next" autocomplete="off" oninput="clearSetInputError('${sid}-r')"></td>
      <td><input type="number" class="set-input" id="${sid}-rpe" placeholder="${ex.rpe}" min="1" max="10" step="0.5" inputmode="decimal" enterkeyhint="done" autocomplete="off"></td>
      <td><span class="badge badge-muted" style="font-size:10px">${ex.rest}s</span></td>
      <td class="set-actions-cell">
        ${copyBtn}
        <button type="button" class="set-done-btn" id="${sid}-done" onclick="markSetDone('${sid}')" aria-label="Mark done">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </td>`;
}

function copyPreviousSet(sid) {
  const row = document.getElementById(sid);
  const prev = row?.previousElementSibling;
  if (!prev?.classList.contains('set-row')) return;
  ['w', 'r', 'rpe'].forEach((f) => {
    const src = document.getElementById(`${prev.id}-${f}`);
    const dst = document.getElementById(`${sid}-${f}`);
    if (!dst || !src) return;
    if (src.value !== '') dst.value = src.value;
    else if (src.placeholder) dst.value = src.placeholder;
  });
}

function openPlatesFromWeight(sid) {
  const el = document.getElementById(`${sid}-w`);
  if (!el) return;
  const v = parseFloat(el.value);
  const ph = parseFloat(el.placeholder);
  const prefill = Number.isFinite(v) && v > 0 ? v : ph;
  openPlateCalculator(Number.isFinite(prefill) && prefill > 0 ? prefill : undefined);
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
      saveSetToState(sid);
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
        btn.setAttribute('aria-pressed', 'true');
        row.classList.add('done');
      } else if (btn) {
        btn.classList.remove('checked');
        btn.setAttribute('aria-pressed', 'false');
        row?.classList.remove('done');
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

  renderWeekCompleteBanner(
    document.getElementById('logWeekCompleteBanner'),
    getWeekGymProgress(state.currentWeek),
  );

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
  bindWorkoutInputFocus();
  const inProgressSets = getInProgressSession();
  if (inProgressSets) {
    requestAnimationFrame(() => {
      applyExerciseSwaps(inProgressSets);
      if (inProgressSets.sets?.length) applyInProgressSets(inProgressSets);
      setInitialCurrentExercise();
    });
  } else {
    requestAnimationFrame(() => setInitialCurrentExercise());
  }
  requestAnimationFrame(() => {
    if (typeof syncMobileViewport === 'function') syncMobileViewport();
  });
}

function buildExerciseCard(ex, bi, ei, inSuper) {
  const deload = [6,12].includes(state.currentWeek);
  const baseW = ex.weight;
  const targetW = deload ? Math.round(baseW*0.6*2)/2 : baseW;
  const card = document.createElement('div');
  card.className = 'exercise-card'+(inSuper?' in-superset':'');
  card.id = `ex-${state.currentDay}-${bi}-${ei}`;
  const slotId = getExerciseSlotId(state.currentDay, bi, ei);
  const plannedId = exerciseIdFromName(ex.name);
  const session = getInProgressSession();
  const savedSwap = session?.exerciseSwaps?.[slotId];
  const displayName = savedSwap?.exerciseName || ex.name;
  const displayId = savedSwap?.exerciseId || plannedId;

  card.dataset.slotId = slotId;
  card.dataset.plannedExerciseName = ex.name;
  card.dataset.plannedExerciseId = plannedId;
  card.dataset.exerciseName = displayName;
  card.dataset.exerciseId = displayId;
  card.dataset.rest = String(ex.rest);
  card._plannedExTemplate = ex;

  const lastSets = getLastSetsForExercise(displayName, state.currentDay);
  const lastHint = lastSets
    ? `<div class="last-time-hint"><strong>Last time:</strong> ${formatLastTimeSummary(lastSets)}</div>`
    : '';

  let setsHtml = '';
  for(let s=0;s<ex.sets;s++){
    const sid = `set-${state.currentDay}-${bi}-${ei}-${s}`;
    setsHtml += `<tr class="set-row" id="${sid}">${buildSetRowHtml(sid, s + 1, targetW, ex, s > 0)}</tr>`;
  }

  const showSwap = getSuggestedExercises(ex).length > 1;
  const block = getProgramBlock(bi);
  const lastEi = (block?.exercises?.length || 1) - 1;
  const isRestAnchor = inSuper && ei === lastEi && isSupersetStyleBlock(block);
  const supersetRestHint = isRestAnchor
    ? `<div class="superset-rest-hint">Rest <strong>${ex.rest}s</strong> starts after you complete this exercise</div>`
    : '';

  card.innerHTML = `
    <div class="exercise-header">
      <div>
        <div class="exercise-name-row">
          ${showSwap
    ? `<button type="button" class="exercise-name-btn" onclick="openExerciseSwapSheet('${slotId}')">
            <span class="exercise-name">${displayName}</span>
            <span class="exercise-swap-pill">Swap</span>
          </button>`
    : `<span class="exercise-name">${displayName}</span>`}
        </div>
        ${displayId !== plannedId ? `<div class="exercise-swapped-from">Swapped from ${ex.name}</div>` : ''}
        <div class="exercise-meta">
          <span class="badge badge-muted">${ex.sets}×${formatRepsTargetBadge(ex.repsTarget)}</span>
          <span class="badge badge-muted">Tempo ${ex.tempo}</span>
          <span class="badge badge-accent">RPE ${ex.rpe}</span>
          <span class="badge badge-muted">Rest ${ex.rest}s</span>
        </div>
        <div class="exercise-notes">${ex.notes}</div>
        ${supersetRestHint}
        ${lastHint}
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="sets-table">
        <thead><tr>
          <th style="width:32px">Set</th>
          <th>${weightColumnLabel()}</th>
          <th class="reps-col-hd">${repsColumnLabel(ex)}</th>
          <th>RPE</th>
          <th>Rest</th>
          <th></th>
        </tr></thead>
        <tbody>${setsHtml}</tbody>
      </table>
    </div>
    <div class="set-row-actions">
      <button type="button" class="set-row-btn remove-set-btn" onclick="removeSet(this,'${JSON.stringify(ex).replace(/'/g,"\\'")}',${bi},${ei})" title="Remove last set">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Remove set
      </button>
      <button type="button" class="set-row-btn add-set-btn" onclick="addSet(this,'${JSON.stringify(ex).replace(/'/g,"\\'")}',${bi},${ei})" title="Add a set">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add set
      </button>
    </div>`;
  if (displayId !== plannedId) card.classList.add('is-swapped');
  refreshSetRowPlateButtons(card, ex);
  updateSetRowActions(card);
  return card;
}

function getExerciseTbody(btn) {
  return btn.closest('.exercise-card')?.querySelector('.sets-table tbody');
}

function renumberSetRows(tbody) {
  [...tbody.rows].forEach((row, i) => {
    const numCell = row.querySelector('.set-num');
    if (numCell) numCell.textContent = String(i + 1);
  });
}

function updateSetRowActions(card) {
  const tbody = card?.querySelector('.sets-table tbody');
  const removeBtn = card?.querySelector('.remove-set-btn');
  if (removeBtn && tbody) removeBtn.disabled = tbody.rows.length <= 1;
}

function toggleWarmupItem(cb, itemId) {
  const item = document.getElementById(itemId);
  if(cb.checked) item.classList.add('done');
  else item.classList.remove('done');
}

function removeSet(btn, exJson, bi, ei) {
  try {
    const card = btn.closest('.exercise-card');
    const tbody = getExerciseTbody(btn);
    if (!tbody || tbody.rows.length <= 1) return;
    const lastRow = tbody.rows[tbody.rows.length - 1];
    const sid = lastRow.id;
    lastRow.remove();
    const session = getInProgressSession();
    if (session && sid) {
      session.sets = session.sets.filter(s => s.sid !== sid);
      persistLocalState();
    }
    renumberSetRows(tbody);
    updateSetRowActions(card);
  } catch (e) { console.error(e); }
}

function addSet(btn, exJson, bi, ei) {
  try {
    const ex = JSON.parse(exJson);
    const card = btn.closest('.exercise-card');
    const tbody = getExerciseTbody(btn);
    if (!tbody) return;
    const setNum = tbody.rows.length + 1;
    const sid = `set-${state.currentDay}-${bi}-${ei}-${setNum-1}`;
    const deload = [6,12].includes(state.currentWeek);
    const targetW = deload ? Math.round(ex.weight*0.6*2)/2 : ex.weight;
    const tr = document.createElement('tr');
    tr.className = 'set-row';
    tr.id = sid;
    tr.innerHTML = buildSetRowHtml(sid, setNum, targetW, ex, setNum > 1);
    tbody.appendChild(tr);
    updateSetRowActions(card);
  } catch(e) { console.error(e); }
}

function clearSetInputError(inputId) {
  document.getElementById(inputId)?.classList.remove('set-input--invalid');
}

function getSetRepsFromInput(sid) {
  const el = document.getElementById(`${sid}-r`);
  if (!el) return null;
  const raw = String(el.value).trim();
  if (raw === '') return null;
  const reps = parseInt(raw, 10);
  if (!Number.isFinite(reps) || reps < 1) return null;
  return reps;
}

function markSetDone(sid) {
  const row = document.getElementById(sid);
  const btn = document.getElementById(sid+'-done');
  const isDone = btn.classList.contains('checked');
  const card = getExerciseCard(sid);
  const ctx = getCardExerciseContext(card);
  const exName = ctx?.exerciseName || '';
  const rest = getExerciseRest(exName, ctx?.rest || 60);
  if(!isDone) {
    const repsEl = document.getElementById(`${sid}-r`);
    const reps = getSetRepsFromInput(sid);
    if (reps === null) {
      repsEl?.classList.add('set-input--invalid');
      repsEl?.focus();
      showSaveToast('Enter reps before completing the set');
      return;
    }
    clearSetInputError(`${sid}-r`);
    btn.classList.add('checked');
    btn.setAttribute('aria-pressed', 'true');
    row.classList.add('done');
    saveSetToState(sid);
    setCurrentExerciseCard(card);
    const parsed = parseSetSid(sid);
    const handled = parsed && handleSupersetAfterSetDone(parsed, exName, rest);
    if (!handled) startTimer(exName, rest);
  } else {
    btn.classList.remove('checked');
    btn.setAttribute('aria-pressed', 'false');
    row.classList.remove('done');
    clearSupersetHighlights(row.closest('.superset-block'));
    setCurrentExerciseCard(card);
    removeSetFromState(sid);
  }
}

function parseSetNumber(sid) {
  const parts = sid.split('-');
  const n = parseInt(parts[parts.length - 1], 10);
  return Number.isFinite(n) ? n + 1 : 1;
}

/** @returns {{ day: string, bi: number, ei: number, setIndex: number } | null} */
function parseSetSid(sid) {
  if (!sid || !sid.startsWith('set-')) return null;
  const parts = sid.split('-');
  if (parts.length < 5) return null;
  const setIndex = parseInt(parts[parts.length - 1], 10);
  const ei = parseInt(parts[parts.length - 2], 10);
  const bi = parseInt(parts[parts.length - 3], 10);
  if (!Number.isFinite(setIndex) || !Number.isFinite(ei) || !Number.isFinite(bi)) return null;
  return { day: parts[1], bi, ei, setIndex };
}

function buildSetSid(day, bi, ei, setIndex) {
  return `set-${day}-${bi}-${ei}-${setIndex}`;
}

function getProgramBlock(bi) {
  return PROGRAM[state.currentDay]?.blocks?.[bi] ?? null;
}

function isSupersetStyleBlock(block) {
  return Boolean(block && block.type === 'superset' && block.exercises?.length > 1);
}

function isSetRowDone(sid) {
  return document.getElementById(`${sid}-done`)?.classList.contains('checked') ?? false;
}

function clearSupersetHighlights(container) {
  container?.querySelectorAll('.set-row--superset-next').forEach((row) => {
    row.classList.remove('set-row--superset-next');
  });
}

function setCurrentExerciseCard(card) {
  const root = document.getElementById('workoutContent');
  if (!root) return;
  root.querySelectorAll('.exercise-card--current').forEach((c) => c.classList.remove('exercise-card--current'));
  card?.classList.add('exercise-card--current');
}

function clearCurrentExerciseCards() {
  document.getElementById('workoutContent')?.querySelectorAll('.exercise-card--current').forEach((c) => {
    c.classList.remove('exercise-card--current');
  });
}

const SET_INPUT_FIELDS = ['w', 'r', 'rpe'];

function parseSetInputId(inputId) {
  const m = String(inputId || '').match(/^(.+)-(w|r|rpe)$/);
  if (!m) return null;
  return { base: m[1], field: m[2] };
}

function getNextSetInput(el) {
  const parsed = parseSetInputId(el?.id);
  if (!parsed) return null;
  const fieldIdx = SET_INPUT_FIELDS.indexOf(parsed.field);
  if (fieldIdx >= 0 && fieldIdx < SET_INPUT_FIELDS.length - 1) {
    return document.getElementById(`${parsed.base}-${SET_INPUT_FIELDS[fieldIdx + 1]}`);
  }
  const row = el.closest('tr.set-row');
  const nextRow = row?.nextElementSibling;
  if (nextRow?.classList.contains('set-row')) {
    return document.getElementById(`${nextRow.id}-w`);
  }
  return null;
}

function bindWorkoutInputFocus() {
  const wc = document.getElementById('workoutContent');
  if (!wc || wc.dataset.focusBound === '1') return;
  wc.dataset.focusBound = '1';
  wc.addEventListener('focusin', (e) => {
    const input = e.target.closest?.('.set-input');
    if (!input) return;
    setCurrentExerciseCard(input.closest('.exercise-card'));
  });
  wc.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const input = e.target.closest?.('.set-input');
    if (!input) return;
    e.preventDefault();
    const next = getNextSetInput(input);
    if (next) {
      if (typeof focusLogField === 'function') focusLogField(next);
      else next.focus();
    } else {
      input.blur();
    }
  });
}

function setInitialCurrentExercise() {
  const nextRow = document.querySelector('#workoutContent .set-row--superset-next');
  if (nextRow) {
    setCurrentExerciseCard(nextRow.closest('.exercise-card'));
    return;
  }
  const firstOpen = document.querySelector('#workoutContent tr.set-row:not(.done)');
  if (firstOpen) setCurrentExerciseCard(firstOpen.closest('.exercise-card'));
}

function highlightSupersetNextRow(sid) {
  const row = document.getElementById(sid);
  if (!row) return;
  const block = row.closest('.superset-block');
  clearSupersetHighlights(block);
  row.classList.add('set-row--superset-next');
  setCurrentExerciseCard(row.closest('.exercise-card'));
  requestAnimationFrame(() => {
    const weight = document.getElementById(`${sid}-w`);
    if (typeof focusLogField === 'function') focusLogField(weight);
    else weight?.focus({ preventScroll: true });
  });
}

/** First exercise in the block (same set #) not yet marked done. */
function findNextSupersetSetSid(day, bi, setIndex) {
  const block = getProgramBlock(bi);
  if (!block?.exercises?.length) return null;
  for (let ei = 0; ei < block.exercises.length; ei++) {
    const sid = buildSetSid(day, bi, ei, setIndex);
    if (!isSetRowDone(sid)) return sid;
  }
  return null;
}

function getSupersetTrailExerciseIndex(block) {
  return Math.max(0, (block?.exercises?.length || 1) - 1);
}

function getSupersetTrailExerciseCard(bi, block) {
  const ei = getSupersetTrailExerciseIndex(block);
  return document.getElementById(`ex-${state.currentDay}-${bi}-${ei}`);
}

function getSupersetTrailExerciseName(block, bi) {
  const card = getSupersetTrailExerciseCard(bi, block);
  const ctx = getCardExerciseContext(card);
  const trail = block?.exercises?.[getSupersetTrailExerciseIndex(block)];
  return ctx?.exerciseName || trail?.name || 'Exercise';
}

/** Rest on the last exercise in the pair/block; next work is set 1 on exercise A. */
function getSupersetRoundRestTarget(parsed) {
  const block = getProgramBlock(parsed.bi);
  if (!block?.exercises?.length) {
    return { exerciseName: 'Superset', restSec: 60, nextSid: null, nextSetNum: null, trailCard: null };
  }
  const trailName = getSupersetTrailExerciseName(block, parsed.bi);
  const trailEx = block.exercises[getSupersetTrailExerciseIndex(block)];
  const trailRest = getExerciseRest(trailName, trailEx.rest);
  const nextSetIndex = parsed.setIndex + 1;
  const nextSid = buildSetSid(parsed.day, parsed.bi, 0, nextSetIndex);
  const nextRow = document.getElementById(nextSid);
  const hasNext = nextRow && !isSetRowDone(nextSid);
  return {
    exerciseName: trailName,
    restSec: trailRest,
    nextSid: hasNext ? nextSid : null,
    nextSetNum: hasNext ? nextSetIndex + 1 : null,
    trailCard: getSupersetTrailExerciseCard(parsed.bi, block),
  };
}

/**
 * Superset: no rest between exercises in a round — highlight next set until the round is complete.
 * @returns {boolean} true if rest timer was handled (started or intentionally skipped)
 */
function handleSupersetAfterSetDone(parsed, fallbackExName, fallbackRestSec) {
  const block = getProgramBlock(parsed.bi);
  if (!isSupersetStyleBlock(block)) return false;

  const row = document.getElementById(buildSetSid(parsed.day, parsed.bi, parsed.ei, parsed.setIndex));
  const blockEl = row?.closest('.superset-block');
  const pendingSid = findNextSupersetSetSid(parsed.day, parsed.bi, parsed.setIndex);

  if (pendingSid) {
    highlightSupersetNextRow(pendingSid);
    return true;
  }

  clearSupersetHighlights(blockEl);
  const target = getSupersetRoundRestTarget(parsed);
  setCurrentExerciseCard(target.trailCard);
  startTimer(target.exerciseName, target.restSec, target.nextSid);
  return true;
}

function getInProgressSession() {
  return state.sessions.find(s => s.week === state.currentWeek && s.day === state.currentDay && !s.completed);
}

function buildSetDeletePayload(sid) {
  const card = getExerciseCard(sid);
  const ctx = getCardExerciseContext(card);
  const existing = getInProgressSession()?.sets?.find((s) => s.sid === sid);
  return {
    sid,
    exercise: existing?.exercise || ctx?.exerciseName || card?.querySelector('.exercise-name')?.textContent || '',
    setNumber: existing?.setNumber || parseSetNumber(sid),
  };
}

function removeSetFromState(sid) {
  const session = getInProgressSession();
  const payload = buildSetDeletePayload(sid);
  if (session?.sets?.length) {
    session.sets = session.sets.filter((s) => s.sid !== sid);
    persistLocalState();
  }
  if (payload.exercise) syncSetDeleteToApi(payload, session);
}

function saveSetToState(sid) {
  const card = getExerciseCard(sid);
  const ctx = getCardExerciseContext(card);
  const exName = ctx?.exerciseName || card?.querySelector('.exercise-name')?.textContent || '';
  const wEl = document.getElementById(sid + '-w');
  const wRaw = parseFloat(wEl?.value);
  const wPh = parseFloat(wEl?.placeholder);
  const w = toKg(Number.isFinite(wRaw) ? wRaw : (Number.isFinite(wPh) ? wPh : 0));
  const r = getSetRepsFromInput(sid) ?? 0;
  const rpe = parseFloat(document.getElementById(sid+'-rpe')?.value || document.getElementById(sid+'-rpe')?.placeholder || 7);
  const e1rm = w > 0 && r > 0 ? Math.round(w * (1 + r / 30) * 10) / 10 : 0;
  const setNumber = parseSetNumber(sid);
  const setData = {
    exercise: exName,
    exerciseId: ctx?.exerciseId,
    plannedExerciseId: ctx?.plannedExerciseId,
    plannedExerciseName: ctx?.plannedExerciseName,
    slotId: ctx?.slotId,
    weight: w,
    reps: r,
    rpe,
    e1rm,
    sid,
    setNumber,
  };
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
  const weekBadge = document.getElementById('completeWeekBadge');
  const weekProgress = getWeekGymProgress(session.week);
  if (weekBadge) {
    if (weekProgress.isComplete) {
      weekBadge.classList.remove('hidden');
      weekBadge.textContent = `Week ${session.week} complete — all ${weekProgress.total} gym days logged`;
    } else {
      weekBadge.classList.add('hidden');
      weekBadge.textContent = '';
    }
  }
  document.getElementById('completeKpiRow').innerHTML = `
    <div class="complete-kpi">
      <div class="complete-kpi-val">${stats.totalSets}</div>
      <div class="complete-kpi-lbl">Sets logged</div>
    </div>
    <div class="complete-kpi">
      <div class="complete-kpi-val">${formatSessionVolume(doneSets)}</div>
      <div class="complete-kpi-lbl">Total volume</div>
    </div>
    <div class="complete-kpi">
      <div class="complete-kpi-val">${stats.bestE1rm > 0 ? formatWeightWithUnit(stats.bestE1rm) : '—'}</div>
      <div class="complete-kpi-lbl">Best E1RM${stats.topSet ? ' · ' + stats.topSet.exercise.split(' ')[0] : ''}</div>
    </div>`;
  const prSection = document.getElementById('completePrSection');
  const prList = document.getElementById('completePrList');
  if (stats.prs.length) {
    prSection.style.display = 'block';
    prList.innerHTML = stats.prs.map(p => `
      <div class="complete-pr-item is-pr">
        <span>${p.exercise}</span>
        <span><span class="complete-pr-badge">PR</span> ${formatWeightWithUnit(p.e1rm)}${p.prev ? ` <span style="color:var(--text-faint);font-weight:400">(was ${formatWeightWithUnit(p.prev)})</span>` : ''}</span>
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
        <span style="font-variant-numeric:tabular-nums">${formatSessionVolume(doneSets.filter(x => x.exercise === name))} vol · ${formatWeightWithUnit(d.bestE1rm)} E1RM</span>
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

