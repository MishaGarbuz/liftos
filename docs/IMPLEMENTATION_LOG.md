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
6. Notifications — **the service worker is the single owner** (the page no longer fires its own `Notification`, which previously duplicated alerts):
   - `scheduleRestTimerAlerts()` posts `TIMER_START` to `sw.js` with `endAt`, `goBody`, and `nextLabel`. The "GO" body leads with the **next exercise** (`getRestTimerContext` → `notifyBody = "Next up: <name>"`).
   - `sw.js` re-arms in ≤10s chunks (iOS-safe). Each tick calls `showRestProgress()` → a **live "⏱ Rest — m:ss left" notification with the next-exercise line** (tag `auxos-rest`). First banner alerts; later refreshes are `silent`.
   - When rest ends → `showRestDone()` (vibrate + "GO"), guarded by `restDoneFired` so it fires **exactly once** even if throttled SW timers burst on resume. `armRestTimer` bails when `!timerEndAt || restDoneFired`.
   - All SW notifications check `hasVisibleClient()` first, so nothing shows while Auxos is open (the overlay covers it). `finishTimer()` deliberately does **not** cancel SW alerts (would race out the background notification); `closeTimer()` cancels as a backstop.
   - Page posts `TIMER_BG` on `visibilitychange→hidden` so the live banner appears immediately when backgrounded. `TIMER_CANCEL` and tap (`notificationclick`) clear the banner / focus the app.

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
| 2026-05-27 | **Per-user week isolation**: `getNextIncompleteLogSlot` now derives week position from the user's own sessions only — no shared calendar date floor. Prevents new users landing in a week another user has already advanced to. |
| 2026-05-27 | **Skip workout**: "Skip workout" button in log session actions. Skipped slots are recorded in DynamoDB (`status=skipped`), shown with a dimmed `–` tab badge and an in-page skipped banner with Undo. PATCH `/sessions/{id}` endpoint added. |
| 2026-05-27 | **AI Coach hold on skip**: `build_slot_summary` flags `sessionWasSkipped`; `next_weight_from_summary` returns a hold decision (no increase); coach prompt rule #10 instructs LLM to do the same. |
| 2026-06-02 | **Skip persistence fix**: skips now POST (upsert) to DynamoDB with an explicit sessionId and queue offline, so they survive app reloads instead of being wiped by `hydrateFromApi`. |
| 2026-06-02 | **Progress = actuals**: progress + dashboard charts now plot real top-set weights (no estimated E1RM targets); Pull-Up has a bodyweight-reps tab; users can add any program exercise to track via a lift picker. |
| 2026-06-02 | **Editable rest**: the Rest badge on each log exercise card is now an inline input saved per-exercise (`liftos_rest_v1`), which the rest timer already reads. Mockup: canvases/rest-edit-saved-mockup.canvas.tsx |
| 2026-06-02 | **Code cleanup**: extracted shared Chart.js helpers into `js/features/charts.js`; removed dead `isLogSlotCompleted`, `getCoachTargetSummary`, `reloadSession`, and the unused `LIFT_TARGETS` global; fixed a duplicate `style` attribute on `#deloadBanner`. |
| 2026-06-02 | **Log action bar cleanup**: the fixed bottom bar is now a single **Complete Session** CTA plus a `⋯` overflow menu (Save progress, Repeat last, Skip, Clear-as-danger) in `js/pages/log.js` (`toggleLogActionsMenu`/`logMenuAction`). Repeat stays context-gated; menu closes on outside-click, day switch, and re-render. Mockup: canvases/log-actions-bar-cleanup-mockup.canvas.tsx |
| 2026-06-02 | **`window.global` shim**: defined in `index.html` before any script so the top-level `global.X = X` exports in `log.js`/`progress.js`/`history.js`/`client.js` run instead of throwing `global is not defined`. |
| 2026-06-02 | **Live rest notification**: backgrounding mid-rest now shows an ongoing "⏱ Rest — m:ss left · Next: …" notification that refreshes (~10s) and flips to a vibrating "GO" when done. SW checks `hasVisibleClient()` so it never duplicates the in-app overlay. Mockup: canvases/rest-timer-notification-mockup.canvas.tsx |
| 2026-06-02 | **SW asset fallback fix**: failed non-navigation fetches no longer fall back to `index.html` (which served HTML as JS — `Unexpected token '<'` — and broke the whole app on any network blip). Shell fallback is navigation-only; assets return cache or a network error. |
| 2026-06-02 | **Rest notification fires once + correct next exercise**: removed the page-side `Notification` (duplicated the SW alert); SW `showRestDone()` is now guarded by `restDoneFired`. "GO" copy leads with the next exercise (`Next up: <name>`) instead of the just-finished lift. |
| 2026-06-02 | **Add/remove set fix**: the log-page add/remove-set buttons embedded `JSON.stringify(ex)` (double quotes) inside a double-quoted `onclick`, breaking the attribute so clicks did nothing. Buttons now call `addSet(this)`/`removeSet(this)` and read the exercise + block/exercise indices from the card (`_plannedExTemplate`, `dataset.bi/ei`); remove reuses `removeSetFromState` (local + server delete). |
| 2026-06-02 | **Visual polish batch 1** (`css/app.css`): cards + KPI tiles get a soft shadow and a hairline top sheen (new `--card-sheen` token, subtle in dark / off in light) for depth; KPI hover-lift; primary KPI gets a 2px accent top rule; KPI value type bumped to 28px with tighter tracking. Mockup: `canvases/visual-polish-review.canvas.tsx`. |
| 2026-06-02 | **Dashboard "Today" hero** (visual batch 2): replaced the small Today's-Session card with a full-width hero above the KPIs — accent rail + subtle ember wash, eyebrow (`Today · <weekday>`), big focus headline, exercise preview (first 3 + "+N more"), week-of-12 pill, week dots, prominent Start CTA, and a last-done meta line. Volume + top-set charts now stack full-width below. `index.html`, `css/app.css` (`.today-hero*`), `js/pages/dashboard.js`; removed dead `.today-session-card` rules. Mockup: `canvases/visual-polish-review.canvas.tsx`. |
