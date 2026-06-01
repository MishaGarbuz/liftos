/** @file Log workout page and set tracking. */
/* ═══════════════════════════════════════════════════════════════
   LOG WORKOUT PAGE
═══════════════════════════════════════════════════════════════ */

let swapSheetSlotId = null;
let swapSheetPlannedEx = null;
let swapSheetSelectedId = null;
// Tracks the slot currently being edited in the coach-target modal.
let coachTargetModalContext = null;
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
  const sessions = state.sessions.filter((s) => s.completed && s.day === day);
  sessions.sort((a, b) => {
    if (b.week !== a.week) return b.week - a.week;
    const da = Date.parse(a.completedAt || a.date) || 0;
    const db = Date.parse(b.completedAt || b.date) || 0;
    return db - da;
  });
  const meta = typeof findProgramExerciseMeta === 'function'
    ? findProgramExerciseMeta(day, exerciseName)
    : null;
  const template = meta?.ex || { name: exerciseName, alt: '' };
  for (const session of sessions) {
    const sets = session.sets
      .filter((s) => {
        if (!(s.weight > 0 || s.reps > 0)) return false;
        if (s.exercise === exerciseName) return true;
        return typeof exerciseNamesAreRelated === 'function'
          && exerciseNamesAreRelated(s.exercise, exerciseName, template);
      })
      .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
    if (sets.length) return sets;
  }
  return null;
}

/**
 * Swap options should only advertise history for the exact logged variation.
 * We keep the broader related-exercise matcher for target resolution elsewhere.
 */
function getExactLastSetsForExercise(exerciseName, day) {
  const sessions = state.sessions.filter((s) => s.completed && s.day === day);
  sessions.sort((a, b) => {
    if (b.week !== a.week) return b.week - a.week;
    const da = Date.parse(a.completedAt || a.date) || 0;
    const db = Date.parse(b.completedAt || b.date) || 0;
    return db - da;
  });
  for (const session of sessions) {
    const sets = session.sets
      .filter((s) => {
        if (!(s.weight > 0 || s.reps > 0)) return false;
        return s.exercise === exerciseName;
      })
      .sort((a, b) => (a.setNumber || 0) - (b.setNumber || 0));
    if (sets.length) return sets;
  }
  return null;
}

function formatLastTimeSummary(sets, ex) {
  return sets.map(s => {
    const rpe = s.rpe ? ` @${s.rpe}` : '';
    if (ex && isTimedExercise(ex)) return `${s.reps}s${rpe}`;
    const w = formatWeightWithUnit(s.weight);
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

/** Holds and isometric work (repsTarget uses seconds or tempo is "hold"). */
function isTimedExercise(ex) {
  if (!ex) return false;
  if (String(ex.tempo || '').toLowerCase() === 'hold') return true;
  return /\d+\s*(?:–|-|to)\s*\d+\s*s\b|\d+\s*s(?:ec(?:ond)?s?)?\b/i.test(String(ex.repsTarget || ''));
}

function parseTimedTargetSeconds(repsTarget) {
  const stripped = String(repsTarget || '')
    .toLowerCase()
    .replace(/\s*(each\s*side|each|per\s*side|e\/s|e\.s\.)\s*$/i, '')
    .trim();
  const range = stripped.match(/(\d+)\s*(?:–|-|to)\s*(\d+)\s*s(?:ec(?:ond)?s?)?\b/);
  if (range) {
    const minSec = parseInt(range[1], 10);
    const maxSec = parseInt(range[2], 10);
    return { minSec, maxSec, defaultSec: maxSec, label: `${minSec}–${maxSec}s` };
  }
  const single = stripped.match(/(\d+)\s*s(?:ec(?:ond)?s?)?\b/);
  if (single) {
    const sec = parseInt(single[1], 10);
    return { minSec: sec, maxSec: sec, defaultSec: sec, label: `${sec}s` };
  }
  return { minSec: 30, maxSec: 30, defaultSec: 30, label: '30s' };
}

function durationColumnLabel(ex) {
  return isTimedExercise(ex) ? 'TIME' : repsColumnLabel(ex);
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
    loadScheme: card.dataset.loadScheme,
    rest: parseInt(card.dataset.rest, 10) || 60,
  };
}

function isCardSwapped(card) {
  if (!card) return false;
  return card.dataset.exerciseId !== card.dataset.plannedExerciseId;
}

function formatSwapLastHint(name, dayKey) {
  const day = dayKey || state.currentDay;
  const sets = getExactLastSetsForExercise(name, day);
  const scheme = typeof getExerciseLoadScheme === 'function' ? getExerciseLoadScheme(name) : null;
  const schemeBit = scheme && scheme.short !== '—' ? ` · ${scheme.short}` : '';
  if (!sets) return `No history for this exercise${schemeBit}`;
  return `Last: ${formatLastTimeSummary(sets)}${schemeBit}`;
}

function updateExerciseSwapLoadWarning() {
  const el = document.getElementById('exerciseSwapLoadWarning');
  if (!el) return;
  const fromName = window.exerciseSwapContext?.fromExerciseName;
  const plannedEx = window.exerciseSwapContext?.plannedEx || swapSheetPlannedEx;
  if (!fromName || !plannedEx || !swapSheetSelectedId) {
    el.classList.add('hidden');
    el.textContent = '';
    return;
  }
  const chosen = getSuggestedExercises(plannedEx).find((o) => o.id === swapSheetSelectedId);
  const note = chosen && typeof getLoadSchemeChangeNote === 'function'
    ? getLoadSchemeChangeNote(fromName, chosen.name)
    : null;
  if (note) {
    el.textContent = note;
    el.classList.remove('hidden');
  } else {
    el.classList.add('hidden');
    el.textContent = '';
  }
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

function formatCoachTargetSummary(slotId, week) {
  const slot = typeof getCoachSlotSuggestion === 'function' ? getCoachSlotSuggestion(week, slotId) : null;
  if (!slot?.sets?.length) return '';
  const first = slot.sets[0] || {};
  const weight = typeof first.weightKg === 'number' ? formatWeightWithUnit(first.weightKg) : '—';
  const reps = first.targetReps || first.repsTarget || '—';
  const rpe = typeof first.rpeTarget === 'number' ? `@${first.rpeTarget}` : '';
  return `Coach target: ${weight} · ${reps}${rpe ? ` · ${rpe}` : ''}`;
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
  window.exerciseSwapContext = {
    mode: 'log',
    slotId,
    plannedEx: card._plannedExTemplate,
    fromExerciseName: card.dataset.exerciseName,
    dayKey: state.currentDay,
  };
  document.getElementById('exerciseSwapSubtitle').textContent =
    `Planned: ${card.dataset.plannedExerciseName}`;
  renderExerciseSwapOptions();
  updateExerciseSwapLoadWarning();
  document.getElementById('exerciseSwapModal')?.classList.add('open');
}

function closeExerciseSwapModal() {
  document.getElementById('exerciseSwapModal')?.classList.remove('open');
  swapSheetSlotId = null;
  swapSheetPlannedEx = null;
  swapSheetSelectedId = null;
  window.exerciseSwapContext = null;
  document.getElementById('exerciseSwapLoadWarning')?.classList.add('hidden');
}

function openCoachTargetModal(slotId) {
  const card = getExerciseCard(slotId);
  if (!card) return;
  const ctx = getCardExerciseContext(card);
  const ex = card._plannedExTemplate;
  const blockParts = String(slotId || '').split('-');
  const bi = parseInt(blockParts[1] || '0', 10);
  const ei = parseInt(blockParts[2] || '0', 10);
  const block = getProgramBlock(bi);
  const slot = typeof getCoachSlotSuggestion === 'function'
    ? getCoachSlotSuggestion(state.currentWeek, slotId)
    : null;
  if (!slot) {
    showSaveToast('Coach targets are not ready for this slot yet');
    return;
  }
  const setCount = slot?.sets?.length || (typeof getSetsForExercise === 'function'
    ? getSetsForExercise(ex, block, state.currentWeek)
    : ex.sets || 1);
  coachTargetModalContext = { slotId, ctx, ex, block, bi, ei, setCount };
  document.getElementById('coachTargetTitle').textContent = ctx?.exerciseName || ex.name;
  document.getElementById('coachTargetSubtitle').textContent = `Week ${state.currentWeek} · ${state.currentDay}`;
  const scheme = typeof getExerciseLoadScheme === 'function' ? getExerciseLoadScheme(ctx?.exerciseName || ex.name) : null;
  document.getElementById('coachTargetLoadNote').textContent = scheme?.note || '';
  const body = document.getElementById('coachTargetBody');
  body.innerHTML = '';
  for (let i = 1; i <= setCount; i += 1) {
    const set = typeof getCoachSetSuggestion === 'function'
      ? getCoachSetSuggestion(state.currentWeek, slotId, i)
      : null;
    const weight = typeof resolveCoachWeightTarget === 'function'
      ? resolveCoachWeightTarget(ex, state.currentWeek, state.currentDay, ctx?.exerciseName || ex.name, slotId, i)
      : (ex.weight || 0);
    const reps = typeof resolveCoachRepsTarget === 'function'
      ? resolveCoachRepsTarget(ex, state.currentWeek, slotId, i)
      : ex.repsTarget;
    const rpe = typeof resolveCoachRpeTarget === 'function'
      ? resolveCoachRpeTarget(ex, state.currentWeek, slotId, i)
      : ex.rpe;
    const rest = typeof resolveCoachRestTarget === 'function'
      ? resolveCoachRestTarget(ex, block, ei, state.currentWeek, slotId, i)
      : ex.rest;
    const row = document.createElement('div');
    row.className = 'coach-target-row';
    row.innerHTML = `
      <div class="coach-target-setnum">Set ${i}</div>
      <input type="number" class="settings-input coach-target-input" id="coachTargetWeight-${i}" value="${set?.weightKg ?? weight}" min="0" step="0.5" inputmode="decimal" aria-label="Set ${i} weight">
      <input type="number" class="settings-input coach-target-input" id="coachTargetReps-${i}" value="${set?.targetReps ?? repsPlaceholder(reps)}" min="1" inputmode="numeric" aria-label="Set ${i} reps">
      <input type="number" class="settings-input coach-target-input" id="coachTargetRpe-${i}" value="${set?.rpeTarget ?? rpe}" min="1" max="10" step="0.5" inputmode="decimal" aria-label="Set ${i} RPE">
      <input type="number" class="settings-input coach-target-input coach-target-rest" id="coachTargetRest-${i}" value="${set?.restSec ?? rest}" min="0" step="5" inputmode="numeric" aria-label="Set ${i} rest seconds">
    `;
    body.appendChild(row);
  }
  document.getElementById('coachTargetModal')?.classList.add('open');
}

function closeCoachTargetModal() {
  document.getElementById('coachTargetModal')?.classList.remove('open');
  coachTargetModalContext = null;
}

async function saveCoachTargetOverride() {
  const ctx = coachTargetModalContext;
  if (!ctx || typeof saveCoachSuggestionOverride !== 'function') return;
  const btn = document.getElementById('coachTargetSaveBtn');
  if (btn) btn.disabled = true;
  try {
    // Save only athlete-owned fields; the backend merges these back onto the generated slot.
    const override = {
      targetExerciseName: ctx.ctx?.exerciseName || ctx.ex.name,
      sets: Array.from({ length: ctx.setCount }, (_, idx) => {
        const setNumber = idx + 1;
        return {
          setNumber,
          weightKg: parseFloat(document.getElementById(`coachTargetWeight-${setNumber}`)?.value || 0) || 0,
          targetReps: parseInt(document.getElementById(`coachTargetReps-${setNumber}`)?.value || 0, 10) || 0,
          rpeTarget: parseFloat(document.getElementById(`coachTargetRpe-${setNumber}`)?.value || 0) || 0,
          restSec: parseInt(document.getElementById(`coachTargetRest-${setNumber}`)?.value || 0, 10) || 0,
        };
      }),
      note: 'Athlete override',
    };
    await saveCoachSuggestionOverride(state.currentWeek, ctx.slotId, override);
    closeCoachTargetModal();
    renderLogPage();
    if (typeof renderPlanPage === 'function') renderPlanPage();
    showSaveToast('Coach targets updated');
  } catch (e) {
    alert(e.message || 'Could not save coach targets');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function renderExerciseSwapOptions() {
  const list = document.getElementById('exerciseSwapList');
  const plannedEx = window.exerciseSwapContext?.plannedEx || swapSheetPlannedEx;
  if (!list || !plannedEx) return;
  const options = getSuggestedExercises(plannedEx);
  const dayKey = window.exerciseSwapContext?.dayKey || state.currentDay;
  list.innerHTML = `
    <p class="exercise-swap-section-label">Suggested for this slot</p>
    ${options
      .map((opt) => {
        const selected = opt.id === swapSheetSelectedId;
        const scheme = typeof getExerciseLoadScheme === 'function' ? getExerciseLoadScheme(opt.name) : null;
        const loadLabel = scheme ? scheme.label : '';
        return `<button type="button" class="exercise-swap-option${selected ? ' is-selected' : ''}"
          data-exercise-id="${opt.id}"
          onclick="selectExerciseSwapOption('${opt.id}')">
          <div class="exercise-swap-option-name">${opt.name}</div>
          <div class="exercise-swap-option-meta">${formatSwapLastHint(opt.name, dayKey)}${loadLabel ? ` · ${loadLabel}` : ''}</div>
        </button>`;
      })
      .join('')}`;
}

function selectExerciseSwapOption(exerciseId) {
  swapSheetSelectedId = exerciseId;
  document.querySelectorAll('#exerciseSwapList .exercise-swap-option').forEach((btn) => {
    btn.classList.toggle('is-selected', btn.dataset.exerciseId === exerciseId);
  });
  updateExerciseSwapLoadWarning();
}

function confirmExerciseSwap() {
  if (window.exerciseSwapContext?.mode === 'history') {
    if (typeof confirmHistoryExerciseSwap === 'function') confirmHistoryExerciseSwap();
    return;
  }
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

global.openExerciseSwapSheet = openExerciseSwapSheet;
global.closeExerciseSwapModal = closeExerciseSwapModal;
global.confirmExerciseSwap = confirmExerciseSwap;
global.updateExerciseSwapLoadWarning = updateExerciseSwapLoadWarning;
global.openCoachTargetModal = openCoachTargetModal;
global.closeCoachTargetModal = closeCoachTargetModal;
global.saveCoachTargetOverride = saveCoachTargetOverride;
global.regenerateCoachTargets = regenerateCoachTargets;

function changeLogWeek(week) {
  state.currentWeek = week;
  if (typeof persistLocalState === 'function') persistLocalState();
  if (typeof ensureCoachSuggestionsForWeek === 'function') {
    ensureCoachSuggestionsForWeek(week).finally(() => renderLogPage());
    return;
  }
  renderLogPage();
}

function coachBannerMessageForPage(doc, pageName) {
  if (!doc) return '';
  if (pageName === 'plan') {
    return 'Coach-adjusted targets are applied to the table values below for this week.';
  }
  return doc.athleteMessage || 'Coach-adjusted targets appear on each exercise card below.';
}

function escapeCoachBannerText(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderCoachStatusBanner(host, week, pageName) {
  if (!host) return;
  host.className = 'coach-status-banner hidden';
  host.innerHTML = '';

  const wk = parseInt(week, 10) || 1;
  if (wk <= 1) {
    host.className = 'coach-status-banner is-pending';
    host.innerHTML = `
      <div>
        <div class="coach-status-banner-title">AI Coach starts in Week 2</div>
        <div class="coach-status-banner-copy">Week 1 uses the authored program baseline. From Week 2 onward, coach-generated targets appear here and inside the workout cards.</div>
      </div>`;
    return;
  }

  const doc = typeof getCoachSuggestionDoc === 'function' ? getCoachSuggestionDoc(wk) : null;
  if (doc?.slots && Object.keys(doc.slots).length) {
    const bannerCopy = escapeCoachBannerText(coachBannerMessageForPage(doc, pageName));
    host.className = 'coach-status-banner is-active';
    host.innerHTML = `
      <div>
        <div class="coach-status-banner-title">AI Coach targets active for Week ${wk}</div>
        <div class="coach-status-banner-copy">${bannerCopy}</div>
      </div>
      <div class="coach-status-banner-actions">
        <button type="button" class="btn btn-ghost btn-sm" onclick="regenerateCoachTargets(${wk}, '${pageName}')">Regenerate targets</button>
      </div>`;
    return;
  }

  const offline = typeof apiOnline !== 'undefined' && !apiOnline;
  host.className = `coach-status-banner ${offline ? 'is-offline' : 'is-pending'}`;
  host.innerHTML = `
    <div>
      <div class="coach-status-banner-title">AI Coach targets not loaded for Week ${wk}</div>
      <div class="coach-status-banner-copy">${offline
        ? 'You are offline, so cached coach targets are unavailable right now.'
        : 'Generate this week once to see coach-adjusted weights, reps, RPE, and rest in the workout and plan views.'}</div>
    </div>
    ${offline ? '' : `<div class="coach-status-banner-actions">
      <button type="button" class="btn btn-primary btn-sm" onclick="regenerateCoachTargets(${wk}, '${pageName}')">Generate targets</button>
    </div>`}`;
}

async function regenerateCoachTargets(week, pageName = 'log') {
  if (typeof ensureCoachSuggestionsForWeek !== 'function') return;
  try {
    const doc = await ensureCoachSuggestionsForWeek(week, true, { throwOnError: true });
    if (doc?.slots && Object.keys(doc.slots).length) {
      showSaveToast(`AI Coach targets ready for Week ${week}`);
    } else {
      alert('AI Coach targets were not generated for this week yet.');
    }
  } catch (e) {
    alert(`Could not generate AI Coach targets: ${e.message || 'unknown error'}`);
  }
  if (pageName === 'plan' && typeof renderPlanPage === 'function') {
    renderPlanPage();
    return;
  }
  renderLogPage();
}

function buildTimedSetRowHtml(sid, setNum, ex, showCopy, target) {
  const timed = parseTimedTargetSeconds(ex.repsTarget);
  const copyBtn = showCopy
    ? `<button type="button" class="set-copy-btn" onclick="copyPreviousSet('${sid}')" title="Copy previous set" aria-label="Copy previous set">↑</button>`
    : '';
  return `
      <td class="set-num">${setNum}</td>
      <td class="set-weight-cell"><span class="set-na">—</span></td>
      <td class="set-hold-cell">
        <div class="hold-set-wrap">
          <input type="number" class="set-input set-hold-input" id="${sid}-r" placeholder="${target?.targetReps || timed.defaultSec}" min="1" max="600" inputmode="numeric" autocomplete="off" oninput="clearSetInputError('${sid}-r')" aria-label="Hold duration in seconds">
          <span class="hold-target-label">${target?.repsTarget || timed.label}</span>
          <button type="button" class="hold-start-btn" id="${sid}-hold-start" onclick="startHoldSet('${sid}')">Start</button>
        </div>
      </td>
      <td><input type="number" class="set-input" id="${sid}-rpe" placeholder="${target?.rpeTarget ?? ex.rpe}" min="1" max="10" step="0.5" inputmode="decimal" enterkeyhint="done" autocomplete="off"></td>
      <td><span class="badge badge-muted" style="font-size:10px">${target?.restSec ?? ex.rest}s</span></td>
      <td class="set-actions-cell">
        ${copyBtn}
        <button type="button" class="set-done-btn" id="${sid}-done" onclick="markSetDone('${sid}')" aria-label="Mark done">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        </button>
      </td>`;
}

function buildSetRowHtml(sid, setNum, targetW, ex, showCopy, target) {
  if (isTimedExercise(ex)) return buildTimedSetRowHtml(sid, setNum, ex, showCopy, target);
  const wPlaceholder = displayWeight(typeof target?.weightKg === 'number' ? target.weightKg : targetW);
  const repsPh = target?.targetReps || repsPlaceholder(target?.repsTarget || ex.repsTarget);
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
      <td><input type="number" class="set-input" id="${sid}-rpe" placeholder="${target?.rpeTarget ?? ex.rpe}" min="1" max="10" step="0.5" inputmode="decimal" enterkeyhint="done" autocomplete="off"></td>
      <td><span class="badge badge-muted" style="font-size:10px">${target?.restSec ?? ex.rest}s</span></td>
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
  const repeatItem = document.getElementById('logMenuRepeat');
  const hint = document.getElementById('logRepeatHint');
  const last = getLastCompletedSessionForDay(state.currentDay);
  const completed = getCompletedSessionForSlot(state.currentWeek, state.currentDay);
  if (repeatItem) {
    const show = last && !completed;
    repeatItem.style.display = show ? 'flex' : 'none';
    if (show) {
      repeatItem.title = `Copy sets from Week ${last.week} (${last.date})`;
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

// ── Log action bar overflow menu ──────────────────────────────────────────
// The fixed bottom bar shows a single primary CTA (Complete Session) plus a
// "⋯" button that opens this menu for the secondary/occasional actions.
function setLogActionsMenuOpen(open) {
  const menu = document.getElementById('logActionsMenu');
  const btn = document.getElementById('logMoreBtn');
  if (!menu || !btn) return;
  menu.classList.toggle('hidden', !open);
  btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  if (open) {
    // Close when tapping/clicking anywhere outside the menu or its trigger.
    requestAnimationFrame(() => document.addEventListener('click', onLogActionsOutsideClick, true));
  } else {
    document.removeEventListener('click', onLogActionsOutsideClick, true);
  }
}

function onLogActionsOutsideClick(e) {
  const wrap = document.querySelector('.log-actions-more');
  if (wrap && !wrap.contains(e.target)) closeLogActionsMenu();
}

function closeLogActionsMenu() {
  setLogActionsMenuOpen(false);
}

function toggleLogActionsMenu(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('logActionsMenu');
  const isOpen = menu && !menu.classList.contains('hidden');
  setLogActionsMenuOpen(!isOpen);
}

function logMenuAction(action) {
  closeLogActionsMenu();
  switch (action) {
    case 'save': return saveSessionProgress();
    case 'repeat': return repeatLastWorkout();
    case 'skip': return skipSession();
    case 'clear': return clearSession();
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
  closeLogActionsMenu();
  if (typeof updateUserChrome === 'function' && typeof getActiveProgramBundle === 'function') {
    updateUserChrome(getActiveProgramBundle());
  }
  renderCoachStatusBanner(document.getElementById('logCoachBanner'), state.currentWeek, 'log');
  activeApiSessionId = null;
  const inProgress = state.sessions.find(s => s.week === state.currentWeek && s.day === state.currentDay && !s.completed);
  if (inProgress?.sessionId) activeApiSessionId = inProgress.sessionId;
  // Week tabs
  const wt = document.getElementById('logWeekTabs');
  wt.innerHTML = '';
  for(let w=1;w<=12;w++){
    const isDeload = typeof isDeloadWeek === 'function' ? isDeloadWeek(w) : [6, 12].includes(w);
    const btn = document.createElement('button');
    btn.className = 'week-tab'+(w===state.currentWeek?' active':'')+(isDeload?' deload':'');
    btn.textContent = 'W'+w;
    btn.onclick = ()=>{ changeLogWeek(w); };
    wt.appendChild(btn);
  }
  // Day tabs
  const dt = document.getElementById('dayTabs');
  dt.innerHTML = '';
  DAYS.forEach(d=>{
    const btn = document.createElement('button');
    const done = getCompletedSessionForSlot(state.currentWeek, d);
    const skipped = !done && state.sessions.some(
      (s) => s.week === state.currentWeek && s.day === d && s.skipped,
    );
    btn.className = 'day-tab'+(d===state.currentDay?' active':'')+(done?' completed':'')+(skipped?' skipped':'');
    btn.textContent = d;
    btn.title = done ? 'Completed — view in history' : skipped ? 'Skipped' : '';
    btn.onclick = ()=>{ state.currentDay=d; renderLogPage(); };
    dt.appendChild(btn);
  });

  renderWeekCompleteBanner(
    document.getElementById('logWeekCompleteBanner'),
    getWeekGymProgress(state.currentWeek),
  );

  const completed = getCompletedSessionForSlot(state.currentWeek, state.currentDay);
  const skippedSession = !completed && state.sessions.find(
    (s) => s.week === state.currentWeek && s.day === state.currentDay && s.skipped,
  );
  const actions = document.getElementById('logSessionActions');
  const wc = document.getElementById('workoutContent');
  wc.innerHTML = '';

  if (completed) {
    renderLogCompletedBanner(completed);
    document.getElementById('deloadBanner').style.display = 'none';
    if (actions) actions.classList.add('is-hidden');
    const hint = document.getElementById('logRepeatHint');
    if (hint) { hint.classList.add('hidden'); hint.textContent = ''; }
    closeLogActionsMenu();
    wc.innerHTML = '<p class="log-completed-hint">This session is finished. Use the button above to review your logged sets, or switch to another day to log a new workout.</p>';
    return;
  }

  if (skippedSession) {
    hideLogCompletedBanner();
    document.getElementById('deloadBanner').style.display = 'none';
    if (actions) actions.classList.add('is-hidden');
    const dayLabel = PROGRAM[state.currentDay]?.label || state.currentDay;
    wc.innerHTML = `
      <div class="log-skipped-banner">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        <div>
          <strong>${dayLabel} – Week ${state.currentWeek} skipped</strong>
          <p>AI Coach will hold targets — no increase next week for this slot.</p>
        </div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="undoSkipSession()">Undo skip</button>
      </div>`;
    return;
  }

  hideLogCompletedBanner();
  if (actions) actions.classList.remove('is-hidden');
  document.getElementById('deloadBanner').style.display =
    (typeof isDeloadWeek==='function'?isDeloadWeek(state.currentWeek):[6,12].includes(state.currentWeek))
      ?'flex':'none';

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
      wrapper.innerHTML = `
        <div class="superset-label">
          <span class="superset-tag">${tag}</span>
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
  const card = document.createElement('div');
  card.className = 'exercise-card'+(inSuper?' in-superset':'');
  card.id = `ex-${state.currentDay}-${bi}-${ei}`;
  const slotId = getExerciseSlotId(state.currentDay, bi, ei);
  const plannedId = exerciseIdFromName(ex.name);
  const session = getInProgressSession();
  const savedSwap = session?.exerciseSwaps?.[slotId];
  const displayName = savedSwap?.exerciseName || ex.name;
  const displayId = savedSwap?.exerciseId || plannedId;
  const targetSlot = typeof getCoachSlotSuggestion === 'function'
    ? getCoachSlotSuggestion(state.currentWeek, slotId)
    : null;
  const targetW = typeof resolveCoachWeightTarget === 'function'
    ? resolveCoachWeightTarget(ex, state.currentWeek, state.currentDay, displayName, slotId, 1)
    : ex.weight;
  const block = getProgramBlock(bi);
  const effectiveRest = typeof resolveCoachRestTarget === 'function'
    ? resolveCoachRestTarget(ex, block, ei, state.currentWeek, slotId, 1)
    : (typeof getEffectiveExerciseRest === 'function'
      ? getEffectiveExerciseRest(ex, block, ei)
      : ex.rest);

  // A rest of 0 means a superset lead exercise (round rest lives on the trailing
  // lift) — those stay non-editable. Everything else can be edited and is read
  // back from the per-exercise saved value so edits persist across reloads.
  const restIsEditable = (effectiveRest || 0) > 0;
  const displayRest = restIsEditable && typeof getExerciseRest === 'function'
    ? getExerciseRest(displayName, effectiveRest)
    : effectiveRest;

  card.dataset.slotId = slotId;
  card.dataset.plannedExerciseName = ex.name;
  card.dataset.plannedExerciseId = plannedId;
  card.dataset.exerciseName = displayName;
  card.dataset.exerciseId = displayId;
  card.dataset.loadScheme = typeof getExerciseLoadScheme === 'function'
    ? getExerciseLoadScheme(displayName).id
    : 'other';
  card.dataset.rest = String(displayRest);
  card._plannedExTemplate = { ...ex, rest: displayRest };

  const lastSets = getLastSetsForExercise(displayName, state.currentDay);
  const lastHint = lastSets
    ? `<div class="last-time-hint"><strong>Last time:</strong> ${formatLastTimeSummary(lastSets, ex)}</div>`
    : '';

  let setsHtml = '';
  const setCount = targetSlot?.sets?.length || (typeof getSetsForExercise === 'function'
    ? getSetsForExercise(ex, block, state.currentWeek)
    : ex.sets);
  const rowEx = card._plannedExTemplate;
  for (let s = 0; s < setCount; s++) {
    const sid = `set-${state.currentDay}-${bi}-${ei}-${s}`;
    const setTarget = typeof getCoachSetSuggestion === 'function'
      ? getCoachSetSuggestion(state.currentWeek, slotId, s + 1)
      : null;
    setsHtml += `<tr class="set-row" id="${sid}">${buildSetRowHtml(sid, s + 1, targetW, rowEx, s > 0, setTarget)}</tr>`;
  }

  const showSwap = getSuggestedExercises(ex).length > 1;
  const lastEi = (block?.exercises?.length || 1) - 1;
  const isRestAnchor = inSuper && ei === lastEi && isSupersetStyleBlock(block);
  const supersetRestHint = isRestAnchor
    ? `<div class="superset-rest-hint">Rest <strong>${displayRest}s</strong> starts after you complete this exercise</div>`
    : (inSuper && isSupersetStyleBlock(block) && ei < lastEi
      ? '<div class="superset-rest-hint">No rest — go straight to the next exercise in this superset</div>'
      : '');
  const coachSummary = formatCoachTargetSummary(slotId, state.currentWeek);
  const coachActions = state.currentWeek > 1 && targetSlot
    ? `<div class="exercise-coach-row">
        <div class="exercise-coach-summary">
          <span class="badge badge-blue">AI Coach</span>
          <div class="exercise-coach-target">${coachSummary || 'Coach target ready for this slot'}</div>
        </div>
        <button type="button" class="btn btn-ghost btn-sm exercise-coach-btn" onclick="openCoachTargetModal('${slotId}')">Edit target</button>
      </div>`
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
          ${restIsEditable
    ? `<span class="badge badge-muted rest-edit-badge" title="Tap to edit rest — saved for this exercise">Rest
            <input type="number" class="rest-edit-input" value="${displayRest}" min="0" step="5" inputmode="numeric"
              data-exercise="${escapeCoachBannerText(displayName)}"
              onclick="event.stopPropagation()"
              onchange="updateExerciseRest(this)">s</span>`
    : `<span class="badge badge-muted">Rest ${effectiveRest}s</span>`}
        </div>
        <div class="exercise-notes">${ex.notes}</div>
        ${supersetRestHint}
        ${lastHint}
        ${coachActions}
      </div>
    </div>
    <div style="overflow-x:auto">
      <table class="sets-table">
        <thead><tr>
          <th style="width:32px">Set</th>
          <th>${weightColumnLabel()}</th>
          <th class="reps-col-hd">${durationColumnLabel(ex)}</th>
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
    const cardEl = btn.closest('.exercise-card');
    const ctx = getCardExerciseContext(cardEl);
    const slotId = cardEl?.dataset?.slotId;
    const targetW = typeof resolveCoachWeightTarget === 'function'
      ? resolveCoachWeightTarget(ex, state.currentWeek, state.currentDay, ctx?.exerciseName || ex.name, slotId, setNum)
      : ex.weight;
    const setTarget = typeof getCoachSetSuggestion === 'function'
      ? getCoachSetSuggestion(state.currentWeek, slotId, setNum)
      : null;
    const tr = document.createElement('tr');
    tr.className = 'set-row';
    tr.id = sid;
    tr.innerHTML = buildSetRowHtml(sid, setNum, targetW, ex, setNum > 1, setTarget);
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
  const card = getExerciseCard(sid);
  const ex = card?._plannedExTemplate;
  if (isTimedExercise(ex)) {
    if (!Number.isFinite(reps) || reps < 1 || reps > 600) return null;
    return reps;
  }
  if (!Number.isFinite(reps) || reps < 1) return null;
  return reps;
}

function startHoldSet(sid) {
  const card = getExerciseCard(sid);
  const ex = card?._plannedExTemplate;
  if (!ex || !isTimedExercise(ex)) return;
  if (timerState.active) {
    showSaveToast('Timer already running');
    return;
  }
  const btn = document.getElementById(`${sid}-done`);
  if (btn?.classList.contains('checked')) return;
  const ctx = getCardExerciseContext(card);
  const timed = parseTimedTargetSeconds(ex.repsTarget);
  const inputSec = getSetRepsFromInput(sid);
  const durationSec = inputSec || timed.defaultSec;
  startHoldTimer(sid, ctx?.exerciseName || ex.name, durationSec);
}

function completeTimedSet(sid, elapsedSec) {
  const row = document.getElementById(sid);
  const rEl = document.getElementById(`${sid}-r`);
  if (rEl) rEl.value = String(elapsedSec);
  row?.classList.remove('set-row--hold-active');
  const startBtn = document.getElementById(`${sid}-hold-start`);
  if (startBtn) {
    startBtn.disabled = false;
    startBtn.textContent = 'Start';
  }
  finalizeSetDone(sid);
}

function finalizeSetDone(sid) {
  const row = document.getElementById(sid);
  const btn = document.getElementById(`${sid}-done`);
  const card = getExerciseCard(sid);
  const ctx = getCardExerciseContext(card);
  const exName = ctx?.exerciseName || '';
  const rest = getExerciseRest(exName, ctx?.rest || 60);
  btn.classList.add('checked');
  btn.setAttribute('aria-pressed', 'true');
  row.classList.add('done');
  saveSetToState(sid);
  setCurrentExerciseCard(card);
  const parsed = parseSetSid(sid);
  const handled = parsed && handleSupersetAfterSetDone(parsed, exName, rest);
  if (!handled) startTimer(exName, rest, null, getRestTimerContext(sid, exName));
}

/** Toggle set done; starts rest timer unless superset defers it — see getRestTimerContext. */
function markSetDone(sid) {
  const row = document.getElementById(sid);
  const btn = document.getElementById(sid+'-done');
  const isDone = btn.classList.contains('checked');
  const card = getExerciseCard(sid);
  const ex = card?._plannedExTemplate;
  if (!isDone && timerState.active && timerState.mode === 'hold' && timerState.holdSid === sid) {
    showSaveToast('Finish the hold timer first');
    return;
  }
  if(!isDone) {
    const repsEl = document.getElementById(`${sid}-r`);
    const reps = getSetRepsFromInput(sid);
    if (reps === null) {
      if (isTimedExercise(ex)) {
        startHoldSet(sid);
        return;
      }
      repsEl?.classList.add('set-input--invalid');
      repsEl?.focus();
      showSaveToast('Enter reps before completing the set');
      return;
    }
    clearSetInputError(`${sid}-r`);
    finalizeSetDone(sid);
  } else {
    btn.classList.remove('checked');
    btn.setAttribute('aria-pressed', 'false');
    row.classList.remove('done');
    row.classList.remove('set-row--hold-active');
    const startBtn = document.getElementById(`${sid}-hold-start`);
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = 'Start';
    }
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
/* ── Rest timer context (overlay + push) — change copy in getRestTimerContext ── */

function isLastSetOfExercise(sid) {
  const row = document.getElementById(sid);
  const tbody = row?.closest('tbody');
  if (!tbody) return true;
  const rows = tbody.querySelectorAll('tr.set-row');
  return rows.length > 0 && rows[rows.length - 1].id === sid;
}

/** Exercise cards in DOM order (warm-up section excluded). */
function getExerciseCardsInWorkoutOrder() {
  return [...document.querySelectorAll('#workoutContent .exercise-card')];
}

function getExerciseNameFromCard(card) {
  const ctx = getCardExerciseContext(card);
  return ctx?.exerciseName || card?.querySelector('.exercise-name')?.textContent?.trim() || '';
}

/**
 * Name of the next exercise card after completing the last set on `sid`.
 * Superset: partner in the same round, or first exercise of the next round.
 * Standalone: next card in the workout.
 */
function resolveNextExerciseNameAfter(sid) {
  const parsed = parseSetSid(sid);
  const currentCard = getExerciseCard(sid);
  if (!parsed || !currentCard) return null;

  const block = getProgramBlock(parsed.bi);
  if (isSupersetStyleBlock(block)) {
    const pendingSid = findNextSupersetSetSid(parsed.day, parsed.bi, parsed.setIndex);
    if (pendingSid) {
      const pendingName = getExerciseNameFromCard(getExerciseCard(pendingSid));
      const currentName = getExerciseNameFromCard(currentCard);
      if (pendingName && pendingName !== currentName) return pendingName;
    }
    const target = getSupersetRoundRestTarget(parsed);
    if (target.nextSid) return getExerciseNameFromCard(getExerciseCard(target.nextSid)) || null;
  }

  const cards = getExerciseCardsInWorkoutOrder();
  const idx = cards.indexOf(currentCard);
  if (idx >= 0 && idx < cards.length - 1) return getExerciseNameFromCard(cards[idx + 1]);
  return null;
}

/**
 * Copy for rest overlay (#timerExercise, #timerNextExercise) and notifications.
 * Mid-exercise sets: "start your next set". Last set: "Next: …" when another exercise follows.
 */
function getRestTimerContext(sid, currentExName) {
  const exercise = currentExName || getExerciseNameFromCard(getExerciseCard(sid)) || 'Exercise';
  const defaultNotify = `${exercise}: start your next set`;

  if (!sid || !isLastSetOfExercise(sid)) {
    return { exercise, nextLabel: null, notifyBody: defaultNotify };
  }

  const nextName = resolveNextExerciseNameAfter(sid);
  if (nextName) {
    return {
      exercise,
      nextLabel: `Next: ${nextName}`,
      notifyBody: `${exercise}: next up — ${nextName}`,
    };
  }

  return {
    exercise,
    nextLabel: 'Last exercise in workout',
    notifyBody: `${exercise}: last exercise — go when ready`,
  };
}

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
  const completedSid = buildSetSid(parsed.day, parsed.bi, parsed.ei, parsed.setIndex);
  setCurrentExerciseCard(target.trailCard);
  startTimer(target.exerciseName, target.restSec, target.nextSid, getRestTimerContext(completedSid, target.exerciseName));
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
  const planned = card?._plannedExTemplate;
  const timed = isTimedExercise(planned);
  const w = timed ? 0 : toKg(Number.isFinite(wRaw) ? wRaw : (Number.isFinite(wPh) ? wPh : 0));
  const r = getSetRepsFromInput(sid) ?? 0;
  const rpe = parseFloat(document.getElementById(sid+'-rpe')?.value || document.getElementById(sid+'-rpe')?.placeholder || 7);
  const e1rm = timed ? 0 : (w > 0 && r > 0 ? Math.round(w * (1 + r / 30) * 10) / 10 : 0);
  const setNumber = parseSetNumber(sid);
  const setData = {
    exercise: exName,
    exerciseId: ctx?.exerciseId,
    plannedExerciseId: ctx?.plannedExerciseId,
    plannedExerciseName: ctx?.plannedExerciseName,
    slotId: ctx?.slotId,
    loadScheme: ctx?.loadScheme || (typeof getExerciseLoadScheme === 'function' ? getExerciseLoadScheme(exName).id : 'other'),
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
  const liftGroups = typeof groupSessionSetsByExercise === 'function'
    ? groupSessionSetsByExercise(session, doneSets)
    : Object.keys(stats.byExercise).map((exName) => ({ exName, sets: [] }));
  liftList.innerHTML = liftGroups
    .map(({ exName }) => {
      const d = stats.byExercise[exName];
      if (!d) return '';
      return `
      <div class="complete-pr-item">
        <span>${exName}</span>
        <span style="font-variant-numeric:tabular-nums">${formatSessionVolume(doneSets.filter(x => x.exercise === exName))} vol · ${formatWeightWithUnit(d.bestE1rm)} E1RM</span>
      </div>`;
    })
    .join('');
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

async function clearSession() {
  if (!confirm('Clear this session?')) return;
  const toClear = state.sessions.filter(
    (s) => s.week === state.currentWeek && s.day === state.currentDay && !s.completed,
  );
  const sessionIds = [...new Set([...toClear.map((s) => s.sessionId), activeApiSessionId].filter(Boolean))];
  const setSids = toClear.flatMap((s) => (s.sets || []).map((x) => x.sid).filter(Boolean));
  state.sessions = state.sessions.filter(
    (s) => !(s.week === state.currentWeek && s.day === state.currentDay && !s.completed),
  );
  activeApiSessionId = null;
  persistLocalState();
  for (const sessionId of sessionIds) await deleteCloudSession(sessionId, setSids);
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

/**
 * Skip the current session slot.
 * - Marks it skipped in local state so getNextIncompleteLogSlot advances past it.
 * - Syncs the skip to the backend (status=skipped) so the AI Coach can treat
 *   this slot as "hold targets — do not increase" for the following week.
 * - Advances the log view to the next incomplete slot.
 */
async function skipSession() {
  const week = state.currentWeek;
  const day = state.currentDay;

  if (!confirm(`Skip ${PROGRAM[day]?.label || day} – Week ${week}?\n\nAI Coach will hold targets at this week's level (no increase) when generating next week's plan.`)) {
    return;
  }

  // Reuse an existing session id for this slot if one exists (so we overwrite
  // it in the backend rather than orphan it); otherwise mint a fresh id.
  // Using the same id locally and in DynamoDB is what lets the skip survive
  // a reload — hydrateFromApi will return this same skipped session.
  const existing = state.sessions.find(
    (s) => s.week === week && s.day === day && !s.completed,
  );
  const sid = existing?.sessionId
    || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `skip-${Date.now()}`);

  // Remove any in-progress session for this slot from local state and mark skipped.
  state.sessions = state.sessions.filter(
    (s) => !(s.week === week && s.day === day && !s.completed),
  );

  // Record a skipped session locally so isLogSlotOccupied returns true.
  const skippedSession = {
    sessionId: sid,
    week,
    day,
    date: new Date().toISOString().slice(0, 10),
    completed: false,
    skipped: true,
    sets: [],
  };
  state.sessions.push(skippedSession);

  if (typeof persistLocalState === 'function') persistLocalState();
  if (typeof applyNextIncompleteLogSlot === 'function') applyNextIncompleteLogSlot();

  // Persist to backend (or offline queue) using the same id.
  if (typeof skipSessionInApi === 'function') {
    skipSessionInApi(sid, week, day, day.toLowerCase(), '').catch((e) =>
      console.warn('skip sync failed', e),
    );
  }

  showSaveToast(`Week ${week} ${PROGRAM[day]?.label || day} skipped — AI Coach will hold targets`);
  renderLogPage();
}

global.skipSession = skipSession;

/** Remove a skipped-session marker so the slot can be logged normally again. */
function undoSkipSession() {
  const week = state.currentWeek;
  const day = state.currentDay;
  const idx = state.sessions.findIndex(
    (s) => s.week === week && s.day === day && s.skipped,
  );
  if (idx < 0) return;
  const sid = state.sessions[idx].sessionId;
  state.sessions.splice(idx, 1);
  if (typeof persistLocalState === 'function') persistLocalState();
  // Drop any still-queued skip op so it doesn't re-create the skip on next flush.
  if (typeof dropQueuedSessionOps === 'function' && sid) dropQueuedSessionOps(sid);
  // Delete the skipped record from the backend so the slot is open again.
  if (sid) {
    if (apiOnline) {
      apiCall('DELETE', `/sessions/${encodeURIComponent(sid)}`).catch((e) =>
        console.warn('undo skip delete failed', e),
      );
    } else if (typeof enqueueSync === 'function') {
      enqueueSync({ type: 'deleteSession', sessionId: sid });
    }
  }
  showSaveToast('Skip undone — you can now log this session');
  renderLogPage();
}
global.undoSkipSession = undoSkipSession;

/**
 * Persist an edited rest duration for an exercise.
 * Saved per-exercise via saveExerciseRest (localStorage `liftos_rest_v1`),
 * which the rest timer already reads through getExerciseRest — so the new
 * value drives the next countdown and survives an app reload.
 * @param {HTMLInputElement} input - the inline rest input element
 */
function updateExerciseRest(input) {
  if (!input) return;
  const exName = input.dataset.exercise;
  const seconds = parseInt(input.value, 10);
  if (!exName || !Number.isFinite(seconds) || seconds < 0) {
    // Revert to the card's current value on invalid input.
    const card = input.closest('.exercise-card');
    if (card?.dataset.rest != null) input.value = card.dataset.rest;
    return;
  }
  if (typeof saveExerciseRest === 'function') saveExerciseRest(exName, seconds);
  const card = input.closest('.exercise-card');
  if (card) {
    card.dataset.rest = String(seconds);
    if (card._plannedExTemplate) card._plannedExTemplate.rest = seconds;
  }
  showSaveToast(`Rest for ${exName} set to ${seconds}s`);
}
global.updateExerciseRest = updateExerciseRest;
global.toggleLogActionsMenu = toggleLogActionsMenu;
global.closeLogActionsMenu = closeLogActionsMenu;
global.logMenuAction = logMenuAction;

function showSaveToast(msg) {
  const t = document.getElementById('saveToast');
  t.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5" style="vertical-align:middle;margin-right:6px"><polyline points="20 6 9 17 4 12"/></svg>${msg}`;
  t.style.display = 'block';
  t.style.animation = 'slideUp 200ms ease';
  setTimeout(()=>{ t.style.display='none'; }, 2500);
}

