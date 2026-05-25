# Auxos implementation log

Working reference for **where features live** and **how they behave**. Update this file when you ship a user-facing change.

| Doc | Purpose |
|-----|---------|
| [FRONTEND.md](./FRONTEND.md) | File layout, script load order, conventions |
| This file | Feature logic, data flow, “change X here” pointers |
| [README.md](../README.md) | Deploy, backend, Cognito |

---

## How to use this log

1. Find the feature section below.
2. Open the **Primary files** paths.
3. Read the **Logic** steps — they match the code flow.
4. After edits, add a line under **Changelog** at the bottom.

---

## Timed holds (plank, hollow hold, etc.)

**Primary files:** `js/pages/log.js` (`isTimedExercise`, `startHoldSet`, `completeTimedSet`), `js/features/hold-timer.js`, `js/features/timer.js`

**Logic**

1. Detect holds from `repsTarget` containing seconds (e.g. `30–45s`) or `tempo: "hold"`.
2. Set row shows **TIME** column with target, optional seconds override, and **Start**.
3. **Start** opens hold countdown overlay; on finish → vibrate + notification (same prefs as rest timer) → auto-complete set → rest timer.
4. Checkmark without duration starts the hold timer; tap ✓ again to undo.

---

## Rest timer + next exercise label

**Mockup:** `canvases/rest-timer-next-exercise-mockup.canvas.tsx` (open beside chat)

**Primary files**

| File | What to change |
|------|----------------|
| `js/pages/log.js` | When rest starts; **next exercise copy** → `getRestTimerContext()`, `resolveNextExerciseNameAfter()` |
| `js/features/timer.js` | Overlay UI, notification body, `startTimer()` |
| `js/core/state.js` | `timerState` fields |
| `index.html` | `#timerOverlay`, `#timerExercise`, `#timerNextExercise` |
| `css/app.css` | `.timer-next-exercise` |
| `sw.js` | Background push (`TIMER_START` / `TIMER_CANCEL`) |

**Logic**

1. User marks a set done → `markSetDone(sid)` in `log.js`.
2. Superset block? → `handleSupersetAfterSetDone()`:
   - More exercises in the **same round** → highlight next row, **no timer**.
   - Round complete → `getSupersetRoundRestTarget()` → `startTimer(..., getRestTimerContext(completedSid, ...))`.
3. Standalone exercise → `startTimer(exName, rest, null, getRestTimerContext(sid, exName))`.
4. `getRestTimerContext(sid, currentExName)`:
   - Not last row on that exercise card → notify: `"{exercise}: start your next set"`; no `nextLabel`.
   - Last row → `resolveNextExerciseNameAfter(sid)`:
     - Superset: partner exercise in round, or first exercise of next round.
     - Else: next `.exercise-card` in DOM order (respects swaps via `data-exercise-name`).
   - Last exercise in workout → `nextLabel`: `"Last exercise in workout"`.
5. `startTimer()` stores `nextLabel` + `notifyBody` on `timerState`, updates overlay.
6. Notifications:
   - Foreground hidden → `fireRestTimerAlert()` (page `Notification` API).
   - PWA background → `scheduleRestTimerAlerts()` posts `TIMER_START` to service worker; `sw.js` arms chunked timeouts (iOS-safe).

**Set row id format** (used everywhere): `set-{day}-{blockIndex}-{exerciseIndex}-{setIndex}` — see `parseSetSid()` / `buildSetSid()`.

---

## Superset flow (no rest between pair; rest after round)

**Primary files:** `js/pages/log.js` (`isSupersetStyleBlock`, `handleSupersetAfterSetDone`, `findNextSupersetSetSid`, `getSupersetRoundRestTarget`, `highlightSupersetNextRow`)

**Logic**

- Only `block.type === 'superset'` (not `core`).
- Completing a set on exercise A → highlight exercise B same set number; focus **weight** input.
- Completing last exercise in the pair for that set number → rest timer on **trail** (last) exercise’s rest seconds.
- Rest ends → highlight next round on exercise A (`afterRestSid`).

---

## Clear session (local + cloud)

**Primary files:** `js/pages/log.js` → `clearSession()`; `js/api/client.js` → `deleteCloudSession()`; `js/sync.js` → `dropQueuedSessionOps`, queue type `deleteSession`

**Logic**

1. Collect all in-progress sessions for current `state.currentWeek` + `state.currentDay`.
2. Remove from `state.sessions`, clear `activeApiSessionId`, `persistLocalState()`.
3. For each `sessionId`, `DELETE /sessions/{id}` (cascades sets in DynamoDB).
4. On reload, `hydrateFromApi()` must not find orphan `in_progress` rows (duplicate session IDs were a past bug — clear deletes **all** IDs for the slot).

---

## Set sync / untick / delete from cloud

**Primary files**

| Layer | File |
|-------|------|
| UI | `js/pages/log.js` — `saveSetToState`, `removeSetFromState`, `markSetDone` |
| API | `js/api/client.js` — `syncSetToApi`, `syncSetDeleteToApi`, `deleteCloudSession` |
| Queue | `js/sync.js` |
| API | `backend/functions/sets/handler.py` — POST set, DELETE set |
| Infra | `backend/template.yaml` — `DeleteSet` route |

**Logic**

- Checkmark on → `saveSetToState` → local session + `POST .../sets` (requires weight **and** reps).
- Checkmark off → `removeSetFromState` → `DELETE .../sets?exercise=&setNumber=`.
- Offline → ops queued; flushed on reconnect.

---

## Exercise swap (plan `alt` suggestions)

**Primary files:** `js/data/exercises.js`, `js/pages/log.js` (`openExerciseSwapSheet`, `applySwapToCard`, `persistExerciseSwap`), `index.html` swap modal

**Logic**

- Suggestions parsed from program `alt` string only (no full catalog DB yet).
- Swap stored on in-progress session: `exerciseSwaps[slotId]`.
- Sets store `exerciseId`, `plannedExerciseId`, `slotId` locally; Dynamo still keys sets by **display name**.

---

## Coach progression targets

**Mockup:** `canvases/coach-targets-mockup.canvas.tsx` (open beside chat)
**Mockup:** `canvases/coach-visibility-log-layout-mockup.canvas.tsx` (open beside chat)

**Primary files:** `backend/functions/coach/handler.py`, `backend/functions/shared/coach_progression.py`, `backend/functions/shared/coach_store.py`, `js/api/client.js`, `js/data/program-registry.js`, `js/pages/log.js`, `js/pages/plan.js`

**Logic**

1. Frontend builds `activeProgramSummary` from the current bundle and requests `task=progression_suggestions`.
2. Coach Lambda compacts completed sessions into slot summaries and either calls Bedrock or falls back to deterministic progression rules.
3. Suggestions are cached per week in DynamoDB and read via `GET /coach/suggestions?week=N`.
4. Athlete edits from the log card modal save slot-scoped overrides via `PUT /coach/suggestions`.
5. Log and Plan both resolve displayed weight, reps, RPE, and rest from the same cached suggestion document.
6. Week 2+ surfaces a top-level AI Coach banner, exposes a manual regenerate action, and marks plan rows with an `AI Coach` badge when slot suggestions are active.

---

## Auth + per-user DynamoDB partition

**Primary files:** `js/auth.js`, `js/api/client.js` (`getAuthHeaders`, `hydrateFromApi`), `backend/functions/shared/utils.py` (`get_user_pk`), `backend/functions/shared/migrate.py`

**Logic**

- JWT `sub` → `USER#{sub}` sessions, `PROGRESS#{sub}` bests.
- First login may copy legacy `USER#michael` / `PROGRESS#michael`.

---

## PWA / cache bust

**Primary files:** `sw.js` (`CACHE` version), `manifest.json`, `index.html`

**Logic**

- Bump `CACHE` in `sw.js` after shell/JS changes so installed PWAs fetch updates.
- `config.json` and `index.html` are network-first in SW fetch handler.

---

## Mobile keyboard (log inputs)

**Primary files:** `js/core/viewport.js`, `js/pages/log.js` (`bindWorkoutInputFocus`, `focusLogField`, Enter key → next column)

---

## DynamoDB single-table schema (summary)

**Table:** `LiftingTracker` — see `backend/template.yaml`

| Entity | pk | sk |
|--------|----|----|
| Session | `USER#{sub}` | `SESSION#{uuid}` |
| Set | `SESSION#{sessionId}` | `SET#{exerciseName}#{setNum:03d}` |
| Progress | `PROGRESS#{sub}` | `EXERCISE#{name}#WEEK#{nn}` |

---

## Appearance (dark / light / auto)

**Primary files:** `js/core/theme.js`, `css/app.css` (`[data-theme]`), Settings page, `js/api/client.js` (`loadCloudPrefs` / `syncPrefsToCloud`), `backend/functions/preferences/handler.py`

**Logic**

1. Pref `state.prefs.theme`: `dark` | `light` | `auto` (default `auto`).
2. `auto` → `prefers-color-scheme` when OS reports it; else dark **19:00–07:00** local.
3. `applyTheme()` sets `document.documentElement[data-theme]` + `theme-color` meta.
4. `auxos-theme-change` event re-renders dashboard/progress charts.
5. **Cloud profile:** DynamoDB `USER#{sub}` / `PREFS#profile` via `GET|PUT /preferences` (theme, palette, units, timer flags). Loaded after sign-in in `initApi`; saved on any `savePrefs()` (debounced).

---

## Changelog

| Date | Change |
|------|--------|
| 2026-05-22 | **BRAND.md** + dark/light/auto themes. |
| 2026-05-22 | Rebrand **LiftOS → Auxos**; domain **auxos.app**; teal accent + A monogram icon. |
| 2026-05-22 | Rest timer shows **Next: {exercise}** on last set of an exercise; same text in push notifications. Added this implementation log. |
| 2026-05-22 | Clear deletes all in-progress cloud sessions for the week/day slot. |
| 2026-05-22 | DELETE set API + sync when unticking a set. |
| 2026-05-22 | Superset rest on trail exercise; core blocks sequential. |
| 2026-05-25 | AI Coach progression targets wired end-to-end: slot-summary payload builder, week-scoped suggestion cache, athlete overrides, and log/plan target consumption. |
| 2026-05-25 | AI Coach visibility pass: week banners, manual regenerate action, plan-row indicators, and tighter mobile log columns so the tick stays on screen. |
| 2026-05-25 | Coach generation now waits longer, surfaces real API timeout/error messages in the UI, and gives the Bedrock-backed Lambda a 45s timeout. |
