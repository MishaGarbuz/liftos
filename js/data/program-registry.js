/** @file Per-user program bundles, weight resolution, and global PROGRAM assignment. */
(function (global) {
  const EMAIL_PROGRAM_MAP = {
    "abhi.ar@hotmail.com": "abhi",
  };

  const PROGRAMS = {
    michael: typeof MICHAEL_PROGRAM_BUNDLE !== "undefined" ? MICHAEL_PROGRAM_BUNDLE : null,
    abhi: typeof ABHI_PROGRAM_BUNDLE !== "undefined" ? ABHI_PROGRAM_BUNDLE : null,
  };

  let activeBundle = PROGRAMS.michael;

  function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
  }

  function programIdForEmail(email) {
    const key = normalizeEmail(email);
    if (EMAIL_PROGRAM_MAP[key]) return EMAIL_PROGRAM_MAP[key];
    return "michael";
  }

  function getActiveProgramBundle() {
    return activeBundle || PROGRAMS.michael;
  }

  function applyProgramGlobals(bundle) {
    if (!bundle) return;
    activeBundle = bundle;
    global.PROGRAM = bundle.days;
    global.DAYS = bundle.gymDays.slice();
    global.SCHEDULE_DAYS = bundle.scheduleDays;
    global.PLAN_PROGRESSIONS = bundle.planProgressions || {};
    global.LIFT_KEYS = bundle.liftKeys || [];
    global.LIFT_TARGETS = bundle.liftTargets || {};
    global.DELOAD_WEEKS = bundle.deloadWeeks || [6, 12];
    global.ACTIVE_PROGRAM_ID = bundle.id;
    global.ACTIVE_PROGRAM_META = bundle;
  }

  function applyProgramForEmail(email) {
    const id = programIdForEmail(email);
    applyProgramGlobals(PROGRAMS[id] || PROGRAMS.michael);
    return id;
  }

  function isDeloadWeek(week) {
    return (global.DELOAD_WEEKS || []).includes(week);
  }

  function getSetsForExercise(ex, block, week) {
    const bundle = getActiveProgramBundle();
    const tier = block?.tier || (block?.type === "core" ? "core" : "secondary");
    if (typeof bundle.setsForWeek === "function") {
      const n = bundle.setsForWeek(tier, week);
      if (n) return n;
    }
    if (isDeloadWeek(week)) return Math.max(2, (ex.sets || 3) - 1);
    return ex.sets || 3;
  }

  function baselineProgramWeight(ex, week) {
    let w = ex.weight || 0;
    if (isDeloadWeek(week)) return Math.round(w * 0.6 * 2) / 2;
    return w;
  }

  function maxWeightFromSessionSets(sets) {
    const logged = (sets || []).filter((s) => s.weight > 0);
    if (!logged.length) return null;
    return Math.max(...logged.map((s) => s.weight));
  }

  function weightFromPriorWeek(exerciseName, dayKey, priorWeek, slotId, plannedName) {
    const session = (typeof state !== "undefined" ? state.sessions : []).find(
      (s) => s.completed && s.week === priorWeek && s.day === dayKey,
    );
    if (!session) return null;
    const sets = session.sets.filter((s) => {
      if (slotId && s.slotId === slotId) return true;
      if (s.exercise === exerciseName) return true;
      if (plannedName && s.plannedExerciseName === plannedName) return true;
      return false;
    });
    return maxWeightFromSessionSets(sets);
  }

  /** Week 1 = program baseline; week 2+ uses prior week's logged weights when available. */
  function resolveTargetWeight(ex, week, dayKey, exerciseName, slotId) {
    if (week <= 1) return baselineProgramWeight(ex, week);
    const prior = weightFromPriorWeek(
      exerciseName,
      dayKey,
      week - 1,
      slotId,
      ex.name,
    );
    if (prior != null) {
      return isDeloadWeek(week) ? Math.round(prior * 0.6 * 2) / 2 : prior;
    }
    const week1 = weightFromPriorWeek(exerciseName, dayKey, 1, slotId, ex.name);
    if (week1 != null) {
      return isDeloadWeek(week) ? Math.round(week1 * 0.6 * 2) / 2 : week1;
    }
    return baselineProgramWeight(ex, week);
  }

  function getWeekGymProgress(week) {
    const days = global.DAYS || [];
    const completedDays = new Set(
      (typeof state !== "undefined" ? state.sessions : [])
        .filter((s) => s.completed && s.week === week && days.includes(s.day))
        .map((s) => s.day),
    );
    const missingDays = days.filter((d) => !completedDays.has(d));
    const label = getActiveProgramBundle().gymDayLabel || days.join(" · ");
    return {
      week,
      total: days.length,
      completedCount: completedDays.size,
      isComplete: missingDays.length === 0,
      completedDays,
      missingDays,
      gymDayLabel: label,
    };
  }

  function renderWeekCompleteBanner(el, progress) {
    if (!el) return;
    const label = progress.gymDayLabel || "gym days";
    if (progress.isComplete) {
      el.classList.remove("hidden");
      el.classList.add("is-complete");
      el.innerHTML = `
      <h3>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        Week ${progress.week} complete
      </h3>
      <p>All <strong>${progress.total} ${label}</strong> logged. Great consistency.</p>`;
      return;
    }
    el.classList.remove("is-complete");
    if (progress.completedCount > 0) {
      el.classList.remove("hidden");
      el.innerHTML = `
      <p><strong>${progress.completedCount} of ${progress.total}</strong> gym days this week
      · Still to go: <strong>${progress.missingDays.join(", ")}</strong></p>`;
      return;
    }
    el.classList.add("hidden");
    el.innerHTML = "";
  }

  function updateUserChrome(bundle) {
    const name = bundle?.displayName;
    if (!name) return;
    document.querySelectorAll(".user-name").forEach((el) => { el.textContent = name; });
    const sub = bundle.programStartDate
      ? `Starts ${bundle.programStartDate} · ${bundle.phaseLabel?.(1) || "Week 1"}`
      : null;
    if (sub) {
      document.querySelectorAll(".user-sub").forEach((el) => { el.textContent = sub; });
    }
  }

  function defaultGymDayForToday() {
    const map = { 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat", 0: "Sun" };
    const today = map[new Date().getDay()];
    const days = global.DAYS || [];
    return days.includes(today) ? today : days[0] || "Mon";
  }

  applyProgramGlobals(PROGRAMS.michael);

  global.applyProgramForEmail = applyProgramForEmail;
  global.applyProgramGlobals = applyProgramGlobals;
  global.getActiveProgramBundle = getActiveProgramBundle;
  global.programIdForEmail = programIdForEmail;
  global.resolveTargetWeight = resolveTargetWeight;
  global.getSetsForExercise = getSetsForExercise;
  global.isDeloadWeek = isDeloadWeek;
  global.getWeekGymProgress = getWeekGymProgress;
  global.renderWeekCompleteBanner = renderWeekCompleteBanner;
  global.updateUserChrome = updateUserChrome;
  global.defaultGymDayForToday = defaultGymDayForToday;
  global.EMAIL_PROGRAM_MAP = EMAIL_PROGRAM_MAP;
})(typeof window !== "undefined" ? window : globalThis);
