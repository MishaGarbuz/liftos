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
  global.getSetsForExercise = getSetsForExercise;
  global.isDeloadWeek = isDeloadWeek;
  global.getWeekGymProgress = getWeekGymProgress;
  global.renderWeekCompleteBanner = renderWeekCompleteBanner;
  global.updateUserChrome = updateUserChrome;
  global.defaultGymDayForToday = defaultGymDayForToday;
  global.EMAIL_PROGRAM_MAP = EMAIL_PROGRAM_MAP;
})(typeof window !== "undefined" ? window : globalThis);
