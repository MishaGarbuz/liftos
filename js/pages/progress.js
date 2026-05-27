/** @file Progression charts — actual top-set weight per week (no estimated targets). */

/* ═══════════════════════════════════════════════════════════════
   LIFT DEFINITION HELPERS
═══════════════════════════════════════════════════════════════ */

/** Return all liftDefs from the active program bundle (falls back to LIFT_KEYS). */
function getActiveLiftDefs() {
  const defs = typeof LIFT_DEFS !== 'undefined' ? LIFT_DEFS : [];
  if (defs.length) return defs;
  // Fallback: treat plain LIFT_KEYS strings as simple defs with name-based matching.
  return (typeof LIFT_KEYS !== 'undefined' ? LIFT_KEYS : []).map(k => ({ key: k, match: [k.toLowerCase()] }));
}

/**
 * Return all exercise names available in the active program so the
 * lift picker can offer every logged exercise, not just the main lifts.
 */
function getAllProgramExerciseNames() {
  const program = typeof PROGRAM !== 'undefined' ? PROGRAM : {};
  const names = new Set();
  Object.values(program).forEach(day => {
    (day.blocks || []).forEach(block => {
      (block.exercises || []).forEach(ex => {
        if (ex.name && ex.weight !== 0) names.add(ex.name);
      });
    });
  });
  return [...names].sort();
}

/**
 * Find the liftDef whose match list overlaps the given exercise name.
 * Returns the def or null.
 */
function liftDefForExercise(exName) {
  const lower = (exName || '').toLowerCase();
  return getActiveLiftDefs().find(d =>
    (d.match || []).some(m => lower.includes(m.toLowerCase()) || m.toLowerCase().includes(lower.split(' ')[0]))
  ) || null;
}

/**
 * Given a liftDef key (or a custom lift name), find the corresponding def.
 * Custom lifts are stored by exact exercise name.
 */
function liftDefForKey(key) {
  return getActiveLiftDefs().find(d => d.key === key) || { key, match: [key.toLowerCase()], custom: true };
}

/** True if the set's exercise matches any of the def's match strings. */
function setMatchesDef(set, def) {
  const lower = (set.exercise || '').toLowerCase();
  return (def.match || [def.key.toLowerCase()]).some(m => lower.includes(m.toLowerCase()));
}

/* ═══════════════════════════════════════════════════════════════
   DATA EXTRACTION
═══════════════════════════════════════════════════════════════ */

/**
 * For each of 12 weeks, return the best (highest) top-set weight logged
 * for the given liftDef across all completed sessions.
 * Returns Array(12) where each entry is a number or null.
 */
function actualWeightsForDef(def) {
  const out = Array(12).fill(null);
  (state.sessions || []).filter(s => s.completed).forEach(s => {
    const wi = (s.week || 1) - 1;
    if (wi < 0 || wi >= 12) return;
    s.sets.forEach(set => {
      const w = parseFloat(set.weight) || 0;
      if (w > 0 && setMatchesDef(set, def)) {
        out[wi] = Math.max(out[wi] || 0, w);
      }
    });
  });
  return out;
}

/**
 * For each of 12 weeks, return the best bodyweight rep count (weight=0 sets)
 * for exercises matching the def. Used for Pull-Up bodyweight tab.
 */
function actualBodyweightRepsForDef(def) {
  const out = Array(12).fill(null);
  (state.sessions || []).filter(s => s.completed).forEach(s => {
    const wi = (s.week || 1) - 1;
    if (wi < 0 || wi >= 12) return;
    s.sets.forEach(set => {
      const w = parseFloat(set.weight) || 0;
      const r = parseInt(set.reps, 10) || 0;
      // Bodyweight set = weight is 0 (or very small assistance weight)
      if (w === 0 && r > 0 && setMatchesDef(set, def)) {
        out[wi] = Math.max(out[wi] || 0, r);
      }
    });
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS MODE (weight vs reps tab)
═══════════════════════════════════════════════════════════════ */

// 'weight' | 'reps'
let _progressMode = 'weight';

function setProgressMode(mode) {
  _progressMode = mode;
  document.getElementById('progressModeWeight')?.classList.toggle('active', mode === 'weight');
  document.getElementById('progressModeReps')?.classList.toggle('active', mode === 'reps');
  _drawProgressChart();
}
global.setProgressMode = setProgressMode;

/* ═══════════════════════════════════════════════════════════════
   CHART RENDERING
═══════════════════════════════════════════════════════════════ */

function _drawProgressChart() {
  const def = liftDefForKey(state.progressLift);
  const chartC = typeof getChartColors === 'function'
    ? getChartColors()
    : { accent: '#14b8a6', accentFill: 'rgba(20,184,166,0.12)' };
  const labels = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);

  const useReps = def.trackReps && _progressMode === 'reps';
  const data = useReps ? actualBodyweightRepsForDef(def) : actualWeightsForDef(def);
  const displayData = useReps ? data : data.map(v => v == null ? null : toDisplayUnit(v));

  const unit = useReps ? ' reps' : weightUnitLabel();
  const chartTitle = useReps
    ? `${def.key} — bodyweight reps`
    : `${def.key} — top-set weight (${unit})`;

  document.getElementById('progressChartTitle').textContent = chartTitle;

  const phaseEl = document.getElementById('progressPhase');
  if (phaseEl && typeof getActiveProgramBundle === 'function') {
    phaseEl.textContent = getActiveProgramBundle().phaseLabel(state.currentWeek) || '';
  }

  const datasets = [{
    label: useReps ? 'Max reps (bodyweight)' : `Best set weight`,
    data: displayData,
    borderColor: chartC.accent,
    backgroundColor: chartC.accentFill,
    borderWidth: 2.5,
    pointRadius: displayData.map(v => v != null ? 4 : 0),
    pointBackgroundColor: chartC.accent,
    tension: 0.4,
    fill: true,
    spanGaps: true,
  }];

  if (state.progressChart) state.progressChart.destroy();
  state.progressChart = new Chart(document.getElementById('progressChart'), {
    type: 'line',
    data: { labels, datasets },
    options: chartOptions(unit, getWeightChartScaleBounds(datasets)),
  });
  observeChartContainer(state.progressChart, document.getElementById('progressChart')?.parentElement);
}

/* ═══════════════════════════════════════════════════════════════
   SPARKLINES
═══════════════════════════════════════════════════════════════ */

function _renderSparklines() {
  const sg = document.getElementById('sparklineGrid');
  sg.innerHTML = '';
  const chartC = typeof getChartColors === 'function'
    ? getChartColors()
    : { accent: '#14b8a6', accentFill: 'rgba(20,184,166,0.12)' };

  const allDefs = [
    ...getActiveLiftDefs(),
    ...(state.customLifts || []).map(k => liftDefForKey(k)),
  ];

  allDefs.forEach(def => {
    const actuals = actualWeightsForDef(def);
    const hasData = actuals.some(v => v != null);

    // Most recent non-null value and the one before it for delta
    let latest = null, prev = null;
    for (let i = 11; i >= 0; i--) {
      if (actuals[i] != null) { if (latest == null) latest = actuals[i]; else if (prev == null) { prev = actuals[i]; break; } }
    }
    const delta = latest != null && prev != null ? latest - prev : null;

    const card = document.createElement('div');
    card.className = 'sparkline-card' + (def.key === state.progressLift ? ' active' : '');
    card.onclick = () => {
      state.progressLift = def.key;
      _progressMode = 'weight';
      renderProgressPage();
    };
    const valText = latest != null ? `${displayWeight(latest)}${weightUnitLabel()}` : '—';
    const deltaText = delta != null
      ? `${delta > 0 ? '+' : ''}${displayWeight(Math.abs(delta))}${weightUnitLabel()} vs prior`
      : (hasData ? 'first session' : 'no data yet');
    const deltaClass = delta == null ? 'flat' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';

    card.innerHTML = `
      <div class="sparkline-label">${def.key}</div>
      <div class="sparkline-val">${valText}</div>
      <div class="sparkline-delta ${deltaClass}">${deltaText}</div>
      <div class="sparkline-chart"><canvas id="spark-${def.key.replace(/\s+/g, '-')}"></canvas></div>`;
    sg.appendChild(card);

    setTimeout(() => {
      const ctx = document.getElementById('spark-' + def.key.replace(/\s+/g, '-'));
      if (!ctx) return;
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: Array.from({ length: 12 }, (_, i) => `W${i + 1}`),
          datasets: [{
            data: actuals.map(v => v == null ? null : toDisplayUnit(v)),
            borderColor: chartC.accent,
            borderWidth: 1.5,
            pointRadius: 0,
            tension: 0.4,
            fill: true,
            backgroundColor: chartC.accentFill,
            spanGaps: true,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      });
    }, 50);
  });
}

/* ═══════════════════════════════════════════════════════════════
   LIFT PICKER MODAL
═══════════════════════════════════════════════════════════════ */

function openLiftPicker() {
  const overlay = document.getElementById('liftPickerOverlay');
  const list = document.getElementById('liftPickerList');
  if (!overlay || !list) return;

  const mainDefKeys = new Set(getActiveLiftDefs().map(d => d.key));
  const customKeys = new Set(state.customLifts || []);
  const allExercises = getAllProgramExerciseNames();

  list.innerHTML = '';

  if (!allExercises.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:13px">No exercises found in your program yet.</p>';
  }

  allExercises.forEach(name => {
    // Skip exercises already in the main lift chips
    const isMain = getActiveLiftDefs().some(d =>
      (d.match || []).some(m => name.toLowerCase().includes(m.toLowerCase()))
    );
    if (isMain) return;

    const isAdded = customKeys.has(name);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'lift-picker-row' + (isAdded ? ' is-added' : '');
    btn.innerHTML = `
      <span>${name}</span>
      <span class="lift-picker-action">${isAdded ? 'Remove' : 'Track'}</span>`;
    btn.onclick = () => {
      if (isAdded) {
        state.customLifts = (state.customLifts || []).filter(k => k !== name);
      } else {
        state.customLifts = [...new Set([...(state.customLifts || []), name])];
      }
      if (typeof persistLocalState === 'function') persistLocalState();
      closeLiftPicker();
      renderProgressPage();
    };
    list.appendChild(btn);
  });

  overlay.classList.remove('hidden');
}

function closeLiftPicker() {
  document.getElementById('liftPickerOverlay')?.classList.add('hidden');
}

global.openLiftPicker = openLiftPicker;
global.closeLiftPicker = closeLiftPicker;

/* ═══════════════════════════════════════════════════════════════
   MAIN RENDER
═══════════════════════════════════════════════════════════════ */

async function renderProgressPage() {
  // Build the full ordered list: main defs + user's custom lifts
  const allDefs = [
    ...getActiveLiftDefs(),
    ...(state.customLifts || []).map(k => liftDefForKey(k)),
  ];

  // Ensure progressLift is valid
  if (!allDefs.some(d => d.key === state.progressLift)) {
    state.progressLift = allDefs[0]?.key || '';
  }

  // Render lift chips
  const chips = document.getElementById('liftChips');
  chips.innerHTML = '';
  allDefs.forEach(def => {
    const c = document.createElement('button');
    c.type = 'button';
    c.className = 'lift-chip' + (def.key === state.progressLift ? ' active' : '');
    c.textContent = def.key;
    c.onclick = () => {
      state.progressLift = def.key;
      _progressMode = 'weight';
      renderProgressPage();
    };
    chips.appendChild(c);
  });

  // Show/hide dual-mode tabs for trackReps lifts (e.g. Pull-Up)
  const currentDef = liftDefForKey(state.progressLift);
  const modeTabs = document.getElementById('progressModeTabs');
  if (modeTabs) {
    if (currentDef.trackReps) {
      modeTabs.classList.remove('hidden');
    } else {
      modeTabs.classList.add('hidden');
      _progressMode = 'weight';
    }
  }

  _drawProgressChart();
  _renderSparklines();
}

/* ═══════════════════════════════════════════════════════════════
   SHARED CHART UTILITIES (used by dashboard.js too)
═══════════════════════════════════════════════════════════════ */

function getWeightChartScaleBounds(datasets) {
  const vals = datasets
    .flatMap(ds => ds.data || [])
    .filter(v => v != null && v !== '' && !Number.isNaN(Number(v)))
    .map(Number);
  if (!vals.length) return {};
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 10;
  const pad = Math.max(4, span * 0.12);
  return {
    suggestedMin: Math.max(0, Math.floor(min - pad)),
    suggestedMax: Math.ceil(max + pad * 0.35),
  };
}

function scheduleChartResize(chart) {
  if (!chart) return;
  const resize = () => { try { chart.resize(); } catch (_) { /* destroyed */ } };
  requestAnimationFrame(() => requestAnimationFrame(resize));
  setTimeout(resize, 120);
  setTimeout(resize, 400);
}

function observeChartContainer(chart, container) {
  if (!chart || !container) { scheduleChartResize(chart); return; }
  if (container._chartResizeObserver) container._chartResizeObserver.disconnect();
  if (typeof ResizeObserver === 'undefined') { scheduleChartResize(chart); return; }
  const ro = new ResizeObserver(() => requestAnimationFrame(() => chart.resize()));
  ro.observe(container);
  container._chartResizeObserver = ro;
  scheduleChartResize(chart);
}

function chartOptions(unit, yScale = {}) {
  const iosPwa = document.documentElement.classList.contains('ios-pwa');
  const ui = typeof getChartUiColors === 'function'
    ? getChartUiColors()
    : { tick: '#8892a4', grid: 'rgba(255,255,255,0.05)', tooltipBg: '#1a2235', tooltipTitle: '#e8eaf0', tooltipBody: '#8892a4' };
  return {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 6, right: 10, bottom: iosPwa ? 26 : 14, left: 8 } },
    plugins: {
      legend: { labels: { color: ui.tick, font: { size: 11 }, boxHeight: 10 } },
      tooltip: {
        backgroundColor: ui.tooltipBg,
        borderColor: ui.grid,
        borderWidth: 1,
        titleColor: ui.tooltipTitle,
        bodyColor: ui.tooltipBody,
        padding: 10,
      },
    },
    scales: {
      x: { ticks: { color: ui.tick, font: { size: 11 } }, grid: { color: ui.grid } },
      y: {
        ticks: { color: ui.tick, font: { size: 11 }, callback: v => v + unit },
        grid: { color: ui.grid },
        grace: '8%',
        ...yScale,
      },
    },
  };
}
