/** @file Per-user program bundles, weight resolution, and global PROGRAM assignment. */
(function (global) {
  const EMAIL_PROGRAM_MAP = {
    "abhi.ar@hotmail.com": "abhi",
  };

  const PROGRAM_ID_PREVIEW_EMAIL = {
    abhi: "abhi.ar@hotmail.com",
  };

  const PREVIEW_STORAGE_KEY = "auxos_program_preview_v1";

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
    for (const [id, bundle] of Object.entries(PROGRAMS)) {
      if (bundle?.email && normalizeEmail(bundle.email) === key) return id;
    }
    return key ? "michael" : "michael";
  }

  function getActiveProgramBundle() {
    return activeBundle || PROGRAMS.michael;
  }

  function syncWindowProgramGlobals(bundle) {
    if (!bundle) return;
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

  function syncStateForProgram(bundle) {
    if (typeof state === "undefined" || !bundle) return;
    if (bundle.liftKeys?.length && !bundle.liftKeys.includes(state.progressLift)) {
      state.progressLift = bundle.liftKeys[0];
    }
    const gymDays = bundle.gymDays || [];
    if (gymDays.length && !gymDays.includes(state.currentDay)) {
      state.currentDay = typeof defaultGymDayForToday === "function"
        ? defaultGymDayForToday()
        : gymDays[0];
    }
  }

  function updateProgramPageCopy(bundle) {
    const b = bundle || getActiveProgramBundle();
    const copy = b?.pageCopy || {};
    const planSub = document.getElementById("planPageSubtitle");
    if (planSub) planSub.textContent = copy.planSubtitle || "";
    const scheduleSub = document.getElementById("schedulePageSubtitle");
    if (scheduleSub) scheduleSub.textContent = copy.scheduleSubtitle || "";
    const notes = document.getElementById("scheduleNotesContent");
    if (notes) notes.innerHTML = copy.scheduleNotesHtml || "";
  }

  function applyProgramGlobals(bundle) {
    if (!bundle) return;
    activeBundle = bundle;
    syncWindowProgramGlobals(bundle);
    syncStateForProgram(bundle);
    updateProgramPageCopy(bundle);
  }

  function applyProgramById(programId) {
    const id = programId && PROGRAMS[programId] ? programId : "michael";
    applyProgramGlobals(PROGRAMS[id] || PROGRAMS.michael);
    return id;
  }

  function applyProgramForEmail(email) {
    return applyProgramById(programIdForEmail(email));
  }

  /** Merge API-stored JSON with built-in template helpers (phaseLabel, setsForWeek). */
  function hydrateApiBundle(raw, programId) {
    const base = PROGRAMS[programId] || PROGRAMS.michael;
    if (!raw || typeof raw !== "object") return applyProgramById(programId);
    const bundle = {
      ...base,
      ...raw,
      id: raw.id || programId,
      days: raw.days || base.days,
      scheduleDays: raw.scheduleDays || base.scheduleDays,
      gymDays: raw.gymDays || base.gymDays,
      deloadWeeks: raw.deloadWeeks || base.deloadWeeks,
      liftKeys: raw.liftKeys || base.liftKeys,
      liftTargets: raw.liftTargets || base.liftTargets,
      planProgressions: raw.planProgressions ?? base.planProgressions,
      pageCopy: raw.pageCopy || base.pageCopy,
      displayName: raw.displayName || base.displayName,
      programStartDate: raw.programStartDate ?? base.programStartDate,
      email: raw.email ?? base.email,
      phaseLabel: base.phaseLabel,
      setsForWeek: base.setsForWeek,
    };
    applyProgramGlobals(bundle);
    return bundle;
  }

  async function loadProgramFromCloud() {
    if (typeof apiCall !== "function") return null;
    const data = await apiCall("GET", "/program");
    if (data?.bundle) {
      hydrateApiBundle(data.bundle, data.programId || "michael");
      return data;
    }
    if (data?.programId) {
      applyProgramById(data.programId);
      return data;
    }
    return null;
  }

  async function fetchProgramAssignments() {
    if (typeof apiCall !== "function") return [];
    const data = await apiCall("GET", "/program/assignments");
    return data?.assignments || [];
  }

  async function saveProgramAssignment(email, programId) {
    if (typeof apiCall !== "function") return null;
    return apiCall("PUT", "/program", {
      email: normalizeEmail(email),
      programId,
    });
  }

  /** Load program from API (DynamoDB), admin preview, or offline built-in fallback. */
  async function resolveProgramForUser(jwtEmail) {
    if (!isAppAdmin(jwtEmail)) clearProgramPreview();
    const previewEmail = getPreviewProgramEmail(jwtEmail);
    if (previewEmail && isAppAdmin(jwtEmail)) {
      applyProgramForEmail(previewEmail);
      updateUserChrome(getActiveProgramBundle());
      updatePreviewBanner(jwtEmail);
      updateProgramPageCopy(getActiveProgramBundle());
      return { source: "preview", programId: programIdForEmail(previewEmail) };
    }
    if (typeof apiOnline !== "undefined" && apiOnline) {
      try {
        const data = await loadProgramFromCloud();
        if (data) {
          updateUserChrome(getActiveProgramBundle());
          updatePreviewBanner(jwtEmail);
          updateProgramPageCopy(getActiveProgramBundle());
          return data;
        }
      } catch (e) {
        console.warn("program API fallback to built-in", e);
      }
    }
    applyProgramForEmail(jwtEmail);
    updateUserChrome(getActiveProgramBundle());
    updatePreviewBanner(jwtEmail);
    updateProgramPageCopy(getActiveProgramBundle());
    return { source: "builtin", programId: programIdForEmail(jwtEmail) };
  }

  function isAppAdmin(_jwtEmail) {
    if (typeof isCognitoAdmin === "function" && isCognitoAdmin()) return true;
    return false;
  }

  function clearProgramPreview() {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
  }

  /** Admin-only: enable from URL bookmark after login (ignored for everyone else). */
  function tryEnablePreviewFromUrl(jwtEmail) {
    if (!isAppAdmin(jwtEmail)) {
      clearProgramPreview();
      return null;
    }
    const params = new URLSearchParams(location.search);
    if (params.get("preview") === "0" || params.get("exitPreview") === "1") {
      clearProgramPreview();
      return null;
    }
    const program = params.get("program");
    if (program && PROGRAM_ID_PREVIEW_EMAIL[program]) {
      sessionStorage.setItem(PREVIEW_STORAGE_KEY, PROGRAM_ID_PREVIEW_EMAIL[program]);
      return PROGRAM_ID_PREVIEW_EMAIL[program];
    }
    return sessionStorage.getItem(PREVIEW_STORAGE_KEY);
  }

  function getPreviewProgramEmail(jwtEmail) {
    if (!isAppAdmin(jwtEmail)) return null;
    return sessionStorage.getItem(PREVIEW_STORAGE_KEY);
  }

  function isAdminProgramPreview(jwtEmail) {
    return !!getPreviewProgramEmail(jwtEmail);
  }

  function getPreviewableAthletes() {
    return Object.entries(EMAIL_PROGRAM_MAP).map(([email, programId]) => ({
      email,
      programId,
      name: (PROGRAMS[programId] && PROGRAMS[programId].displayName) || programId,
    }));
  }

  function enableProgramPreview(programId, jwtEmail) {
    if (!isAppAdmin(jwtEmail)) return false;
    const email = PROGRAM_ID_PREVIEW_EMAIL[programId];
    if (!email) return false;
    sessionStorage.setItem(PREVIEW_STORAGE_KEY, email);
    applyProgramForSession(jwtEmail);
    return true;
  }

  function exitProgramPreview() {
    sessionStorage.removeItem(PREVIEW_STORAGE_KEY);
    const url = new URL(location.href);
    url.searchParams.delete("program");
    url.searchParams.delete("preview");
    url.searchParams.delete("previewEmail");
    url.searchParams.delete("exitPreview");
    const qs = url.searchParams.toString();
    location.href = url.pathname + (qs ? `?${qs}` : "") + url.hash;
  }

  /** Logged-in user email unless an admin has an active preview session. */
  function applyProgramForSession(jwtEmail) {
    if (!isAppAdmin(jwtEmail)) clearProgramPreview();
    const previewEmail = getPreviewProgramEmail(jwtEmail);
    const id = applyProgramForEmail(previewEmail || jwtEmail);
    const bundle = getActiveProgramBundle();
    updateUserChrome(bundle);
    updatePreviewBanner(jwtEmail);
    updateProgramPageCopy(bundle);
    return id;
  }

  function refreshAllProgramViews() {
    if (typeof renderDashboard === "function") renderDashboard();
    if (typeof renderSchedule === "function") renderSchedule();
    if (typeof renderPlanPage === "function") renderPlanPage();
    if (typeof renderProgressPage === "function") renderProgressPage();
    if (typeof renderLogPage === "function"
      && document.getElementById("page-log")?.classList.contains("active")) {
      renderLogPage();
    }
  }

  function updatePreviewBanner(jwtEmail) {
    let el = document.getElementById("programPreviewBanner");
    if (!isAdminProgramPreview(jwtEmail)) {
      if (el) el.remove();
      document.body.classList.remove("has-program-preview");
      return;
    }
    document.body.classList.add("has-program-preview");
    const bundle = getActiveProgramBundle();
    if (!el) {
      el = document.createElement("div");
      el.id = "programPreviewBanner";
      el.className = "program-preview-banner";
      el.setAttribute("role", "status");
      document.body.prepend(el);
    }
    el.innerHTML = `
      <span><strong>Admin preview</strong> — ${bundle?.displayName || "Athlete"} program
      (your login data unchanged; template only)</span>
      <button type="button" class="program-preview-exit" onclick="exitProgramPreview()">Exit preview</button>`;
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

  function setMatchesExerciseHistory(set, exerciseName, slotId, plannedName, template) {
    if (!set) return false;
    if (slotId && set.slotId === slotId) return true;
    if (set.exercise === exerciseName) return true;
    if (plannedName && set.plannedExerciseName === plannedName) return true;
    if (plannedName && set.exercise === plannedName) return true;
    const tpl = template || { name: plannedName || exerciseName, alt: "" };
    if (typeof exerciseNamesAreRelated === "function") {
      if (exerciseNamesAreRelated(set.exercise, exerciseName, tpl)) return true;
      if (plannedName && exerciseNamesAreRelated(set.exercise, plannedName, tpl)) return true;
    }
    return false;
  }

  function weightFromPriorWeek(exerciseName, dayKey, priorWeek, slotId, plannedName) {
    const session = (typeof state !== "undefined" ? state.sessions : []).find(
      (s) => s.completed && s.week === priorWeek && s.day === dayKey,
    );
    if (!session) return null;
    const meta = typeof findProgramExerciseMeta === "function"
      ? findProgramExerciseMeta(dayKey, plannedName || exerciseName)
      : null;
    const template = meta?.ex || { name: plannedName || exerciseName, alt: "" };
    const anchor = plannedName || template.name;
    const sets = session.sets.filter((s) =>
      setMatchesExerciseHistory(s, exerciseName, slotId, anchor, template),
    );
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

  function getCoachSuggestionDoc(week) {
    if (typeof state === "undefined") return null;
    return state.coachSuggestions?.[String(week)] || state.coachSuggestions?.[week] || null;
  }

  /** Slot suggestions are keyed the same way the workout UI addresses exercise cards. */
  function getCoachSlotSuggestion(week, slotId) {
    return getCoachSuggestionDoc(week)?.slots?.[slotId] || null;
  }

  function getCoachSetSuggestion(week, slotId, setNumber) {
    const sets = getCoachSlotSuggestion(week, slotId)?.sets || [];
    return sets.find((s) => Number(s.setNumber || 0) === Number(setNumber || 0)) || null;
  }

  function getCoachTargetSummary(week, slotId, setNumber) {
    const slot = getCoachSlotSuggestion(week, slotId);
    const set = getCoachSetSuggestion(week, slotId, setNumber);
    return { slot, set };
  }

  function resolveCoachWeightTarget(ex, week, dayKey, exerciseName, slotId, setNumber) {
    const set = getCoachSetSuggestion(week, slotId, setNumber);
    if (set && typeof set.weightKg === "number") return set.weightKg;
    return resolveTargetWeight(ex, week, dayKey, exerciseName, slotId);
  }

  function resolveCoachRepsTarget(ex, week, slotId, setNumber) {
    const set = getCoachSetSuggestion(week, slotId, setNumber);
    if (!set) return ex.repsTarget;
    if (typeof set.targetReps === "number" && set.targetReps > 0) return String(set.targetReps);
    if (set.repsTarget) return set.repsTarget;
    return ex.repsTarget;
  }

  function resolveCoachRpeTarget(ex, week, slotId, setNumber) {
    const set = getCoachSetSuggestion(week, slotId, setNumber);
    if (set && typeof set.rpeTarget === "number") return String(set.rpeTarget);
    return ex.rpe;
  }

  function resolveCoachRestTarget(ex, block, exerciseIndex, week, slotId, setNumber) {
    const set = getCoachSetSuggestion(week, slotId, setNumber);
    if (set && typeof set.restSec === "number") return set.restSec;
    return typeof getEffectiveExerciseRest === "function"
      ? getEffectiveExerciseRest(ex, block, exerciseIndex)
      : ex.rest;
  }

  function buildCoachProgramSummary(bundle) {
    const b = bundle || getActiveProgramBundle() || {};
    return {
      id: b.id,
      displayName: b.displayName,
      programStartDate: b.programStartDate || null,
      gymDays: Array.isArray(b.gymDays) ? b.gymDays.slice() : [],
      deloadWeeks: Array.isArray(b.deloadWeeks) ? b.deloadWeeks.slice() : [],
      phaseRules: Array.from({ length: 12 }, (_, i) => ({
        maxWeek: i + 1,
        label: typeof b.phaseLabel === "function" ? b.phaseLabel(i + 1) : `Week ${i + 1}`,
      })),
      days: JSON.parse(JSON.stringify(b.days || {})),
    };
  }

  function isLogSlotCompleted(week, day) {
    return (typeof state !== "undefined" ? state.sessions : []).some(
      (s) => s.completed && s.week === week && s.day === day,
    );
  }

  /** Calendar week from programStartDate (1–12), or null if not scheduled. */
  function getCalendarProgramWeek() {
    const startStr = getActiveProgramBundle()?.programStartDate;
    if (!startStr) return null;
    const parts = String(startStr).split("-");
    if (parts.length !== 3) return null;
    const start = Date.UTC(+parts[0], +parts[1] - 1, +parts[2]);
    const now = new Date();
    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    if (todayUtc < start) return 1;
    const diffDays = Math.floor((todayUtc - start) / 86400000);
    return Math.min(12, Math.floor(diffDays / 7) + 1);
  }

  /**
   * Next gym slot to log: in-progress session first, else earliest (week, day) not completed.
   */
  function getNextIncompleteLogSlot() {
    const days = global.DAYS || [];
    const sessions = typeof state !== "undefined" ? state.sessions : [];

    const inProgress = sessions.filter((s) => !s.completed && days.includes(s.day));
    if (inProgress.length) {
      inProgress.sort((a, b) => {
        if (b.week !== a.week) return b.week - a.week;
        return days.indexOf(b.day) - days.indexOf(a.day);
      });
      return { week: inProgress[0].week, day: inProgress[0].day };
    }

    const maxFromSessions = sessions.reduce((m, s) => Math.max(m, s.week || 1), 1);
    const calWeek = getCalendarProgramWeek();
    const maxWeek = Math.min(12, Math.max(maxFromSessions, calWeek || 1, 1));

    for (let w = 1; w <= maxWeek; w += 1) {
      for (const d of days) {
        if (!isLogSlotCompleted(w, d)) return { week: w, day: d };
      }
    }

    const nextWeek = Math.min(12, maxWeek + 1);
    return { week: nextWeek, day: days[0] || "Mon" };
  }

  function applyNextIncompleteLogSlot() {
    const slot = getNextIncompleteLogSlot();
    if (!slot || typeof state === "undefined") return slot;
    state.currentWeek = slot.week;
    state.currentDay = slot.day;
    if (typeof persistLocalState === "function") persistLocalState();
    return slot;
  }

  /** Prefer today's gym day when still open this calendar week; else next incomplete. */
  function applyLogSessionFocus(preferToday = false) {
    const days = global.DAYS || [];
    if (preferToday) {
      const dayMap = { 0: "Sun", 1: "Mon", 2: "Tue", 3: "Wed", 4: "Thu", 5: "Fri", 6: "Sat" };
      const today = dayMap[new Date().getDay()];
      if (days.includes(today)) {
        const week = getCalendarProgramWeek() || state.currentWeek || 1;
        if (!isLogSlotCompleted(week, today)) {
          state.currentWeek = week;
          state.currentDay = today;
          if (typeof persistLocalState === "function") persistLocalState();
          return { week, day: today };
        }
      }
    }
    return applyNextIncompleteLogSlot();
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
    // Sidebar/account chips should reflect the athlete's current program position, not the start date.
    const liveWeek = Math.min(
      12,
      Math.max(1, parseInt(typeof state !== "undefined" ? state.currentWeek : 1, 10) || getCalendarProgramWeek() || 1),
    );
    const phase = bundle.phaseLabel?.(liveWeek) || `Phase ${liveWeek <= 6 ? 1 : 2}`;
    const sub = `Week ${liveWeek} · ${phase}`;
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
  global.applyProgramById = applyProgramById;
  global.hydrateApiBundle = hydrateApiBundle;
  global.loadProgramFromCloud = loadProgramFromCloud;
  global.fetchProgramAssignments = fetchProgramAssignments;
  global.saveProgramAssignment = saveProgramAssignment;
  global.resolveProgramForUser = resolveProgramForUser;
  global.getProgramCatalog = () => ({ ...PROGRAMS });
  global.applyProgramForSession = applyProgramForSession;
  global.isAppAdmin = isAppAdmin;
  global.tryEnablePreviewFromUrl = tryEnablePreviewFromUrl;
  global.getPreviewProgramEmail = getPreviewProgramEmail;
  global.isAdminProgramPreview = isAdminProgramPreview;
  global.getPreviewableAthletes = getPreviewableAthletes;
  global.enableProgramPreview = enableProgramPreview;
  global.clearProgramPreview = clearProgramPreview;
  global.exitProgramPreview = exitProgramPreview;
  global.updatePreviewBanner = updatePreviewBanner;
  global.updateProgramPageCopy = updateProgramPageCopy;
  global.refreshAllProgramViews = refreshAllProgramViews;
  global.applyProgramGlobals = applyProgramGlobals;
  global.getActiveProgramBundle = getActiveProgramBundle;
  global.programIdForEmail = programIdForEmail;
  global.resolveTargetWeight = resolveTargetWeight;
  global.getCoachSuggestionDoc = getCoachSuggestionDoc;
  global.getCoachSlotSuggestion = getCoachSlotSuggestion;
  global.getCoachSetSuggestion = getCoachSetSuggestion;
  global.getCoachTargetSummary = getCoachTargetSummary;
  global.resolveCoachWeightTarget = resolveCoachWeightTarget;
  global.resolveCoachRepsTarget = resolveCoachRepsTarget;
  global.resolveCoachRpeTarget = resolveCoachRpeTarget;
  global.resolveCoachRestTarget = resolveCoachRestTarget;
  global.buildCoachProgramSummary = buildCoachProgramSummary;
  global.getSetsForExercise = getSetsForExercise;
  global.isDeloadWeek = isDeloadWeek;
  global.getWeekGymProgress = getWeekGymProgress;
  global.getCalendarProgramWeek = getCalendarProgramWeek;
  global.getNextIncompleteLogSlot = getNextIncompleteLogSlot;
  global.applyNextIncompleteLogSlot = applyNextIncompleteLogSlot;
  global.applyLogSessionFocus = applyLogSessionFocus;
  global.renderWeekCompleteBanner = renderWeekCompleteBanner;
  global.updateUserChrome = updateUserChrome;
  global.defaultGymDayForToday = defaultGymDayForToday;
  global.EMAIL_PROGRAM_MAP = EMAIL_PROGRAM_MAP;
})(typeof window !== "undefined" ? window : globalThis);
