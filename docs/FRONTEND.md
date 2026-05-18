# LiftOS frontend

Single-page app: slim `index.html` shell, styles in `css/app.css`, logic in ordered global scripts under `js/` (no bundler).

## Load order

Scripts run in declaration order; later files may call earlier globals.

| Order | File | Role |
|------:|------|------|
| 1 | `js/auth.js` | Cognito login, password hints |
| 2 | `js/sync.js` | Offline queue, cloud sync |
| 3 | `js/data/program.js` | Program, schedule, lift targets (constants) |
| 4 | `js/core/state.js` | `state`, API globals, timer state |
| 5 | `js/ui/nav.js` | `showPage`, sidebar, mobile nav |
| 6 | `js/pages/log.js` | Log session, sets, complete workout |
| 7 | `js/features/timer.js` | Rest timer + notifications |
| 8 | `js/pages/progress.js` | Progress chart, sparklines, `chartOptions` |
| 9 | `js/pages/history.js` | History table, session modal |
| 10 | `js/pages/plan.js` | 12-week plan table |
| 11 | `js/pages/schedule.js` | Weekly schedule grid |
| 12 | `js/pages/dashboard.js` | Dashboard KPIs and charts |
| 13 | `js/api/client.js` | API client, prefs, import/export, `bootApp` |
| 14 | `js/core/viewport.js` | iOS PWA viewport / safe areas |
| 15 | `js/features/plates.js` | Plate calculator modal |
| 16 | `js/app/init.js` | `DOMContentLoaded` bootstrap |

Existing modules `js/auth.js` and `js/sync.js` stay at the top.

## Conventions

- **Globals**: Functions and `state` live on the global scope so `onclick="..."` in HTML works without a build step.
- **IIFE modules**: `auth.js`, `sync.js`, and `plates.js` wrap exports as `global.fn = fn`.
- **Modals**: Add `.open` on `.modal-backdrop`; close on backdrop click or `close*` handlers.
- **Units**: `state.prefs.units` is `kg` or `lb`; use `displayWeight` / `weightUnitLabel()` from `api/client.js` in UI.
- **PWA**: Bump `CACHE` in `sw.js` when shell assets change; reinstall home-screen icon after major meta/SW updates.

## Plate calculator

**Plates Calculator** on the Log Workout page (and in the top bar on desktop) opens `#plateCalcModal`. Enter target total and bar weight; result shows plates per side (greedy, largest first) for metric or lb sets from prefs. The modal does not auto-focus inputs on open (avoids the keyboard covering the sheet on mobile PWA).

Each exercise card has **Add set** / **Remove set** (removes the last row; at least one set remains).

- Metric plates: 25, 20, 15, 10, 5, 2.5, 1.25 kg (default bar 20 kg)
- LB plates: 45, 35, 25, 10, 5, 2.5, 1.25 lb (default bar 45 lb)

If the target cannot be loaded exactly, the UI shows the closest achievable weight.

## Local dev

```bash
# From repo root — any static server
python3 -m http.server 8080
```

Open `http://localhost:8080`. API base is `http://localhost:3001` when hostname is localhost (see `loadAppConfig` in `js/api/client.js`).
