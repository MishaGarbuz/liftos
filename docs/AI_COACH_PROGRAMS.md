# AI Coach + program storage (target architecture)

## Short answer: yes, use S3 — with DynamoDB as the index

S3 is a strong fit for **program documents** (large JSON, versioning, cheap history). It is a weak fit as the **only** database: you still need DynamoDB (or similar) for who owns what, which version is active, and coach chat threads.

```mermaid
flowchart LR
  subgraph app [Auxos app]
    UI[Log / Plan / Coach chat]
  end
  subgraph api [API Lambda]
    Coach[CoachFunction]
    Program[ProgramFunction]
  end
  subgraph data [Data]
    DDB[(DynamoDB metadata)]
    S3[(S3 program JSON)]
    LLM[LLM provider]
  end
  UI --> Coach
  UI --> Program
  Coach --> LLM
  Coach --> S3
  Coach --> DDB
  Program --> DDB
  Program --> S3
```

## Responsibilities

| Layer | Stores | Why |
|-------|--------|-----|
| **S3** | `users/{sub}/current.json`, `users/{sub}/versions/{ts}.json`, `templates/{id}.json` | Versioned blobs; easy backup; AI writes full program JSON |
| **DynamoDB** | `USER#{sub}` / `PROGRAM#active` pointer, `COACH#THREAD#…` messages | Fast auth-scoped lookups; no public S3 URLs for athletes |
| **Built-in JS templates** | `js/data/programs/*.js` | Offline fallback + `phaseLabel` / `setsForWeek` helpers until fully in JSON schema |
| **LLM** (future) | Nothing durable | Stateless; output validated JSON → saved via Program/Coach API |

## Program document shape (v1)

See `docs/program-schema.json`. Rules:

- **No JavaScript functions** in stored JSON — only data (`deloadWeeks`, `phaseRules`, `days`, `scheduleDays`, …).
- **`schemaVersion`** on every file for migrations.
- **`source`**: `template` \| `admin` \| `ai_coach` \| `import`.
- Frontend **hydrates** stored JSON + template helpers (same as today’s `hydrateApiBundle`).

## AI Coach flow (future)

1. User: “Make Week 1 lighter and add an extra pull day.”
2. `POST /coach/program` loads `users/{sub}/current.json` + recent thread from DynamoDB.
3. LLM returns **structured patch** or full program JSON (tool call / JSON mode).
4. Server **validates** against `program-schema.json`.
5. Server writes new object to `users/{sub}/versions/{ts}.json`, updates `current.json`, bumps DynamoDB `version` + `s3CurrentKey`.
6. App `GET /program` returns updated bundle; user sees changes on next navigation.

Rollback = point `s3CurrentKey` at an older version key (admin or user “undo”).

## Progression suggestions

Week 1 uses the authored program baseline. From week 2 onward, the app should
prefer cached **AI-generated progression suggestions** built from logged
performance summaries rather than only copying the prior week's top load.

Current flow in this repo:

1. Athlete completes the week's gym sessions.
2. Frontend sends `activeProgramSummary` + `targetWeek` to `POST /coach/program`
   with `task=progression_suggestions`.
3. Server queries DynamoDB sessions / sets and compacts them into per-slot
   summaries (`slotId`, actual variation, load scheme, reps, weight, RPE,
   completion signal). Input contract: `docs/progression-slot-summary-schema.json`.
4. `task=progression_suggestions` uses the shared coach policy in
   `docs/AI_COACH_PROMPTS.md`.
5. Bedrock returns JSON shaped like
   `docs/progression-suggestions-schema.json`.
6. Suggestions are stored in DynamoDB under `USER#{sub}` with week-scoped keys.
7. App reads cached suggestions from `GET /coach/suggestions?week=N`; athlete
   edits are saved via `PUT /coach/suggestions` using
   `docs/athlete-suggestion-override-schema.json` and merged back into future
   coach runs.

## Permissions

- Athletes: **never** read S3 directly. Only `GET /program` with their JWT.
- Admin: `PUT /program`, `GET /program/assignments`, optional `GET /program/versions`.
- Coach Lambda: read/write **only** `users/{their-sub}/*` (IAM scoped by prefix; enforce `sub` from JWT in code).

## Why not DynamoDB-only for AI programs?

- Item size limit (400 KB) fills up with long 12-week programs + history.
- Harder to diff/version than S3 Versioning.
- AI pipelines naturally emit a file-shaped JSON document.

## Why not S3-only?

- Listing “all assignments”, coach threads, and “current pointer” without scanning buckets.
- Cognito `sub` → program mapping belongs in DynamoDB.

## Scaffold in this repo (now)

- S3 bucket `auxos-programs-*` (private, versioned)
- `program_store.py` — save/load `current.json` + version snapshots
- Program API sets `s3CurrentKey` when admin saves a `bundle`
- `POST /coach/program` for progression suggestion generation
- `GET /coach/suggestions?week=N` for cached suggestions
- `PUT /coach/suggestions` for athlete overrides
- deterministic fallback when Bedrock is unavailable

## Suggested build order

1. ✅ DynamoDB assignment + `GET /program` (done)
2. ✅ S3 save/load on custom `bundle` PUT (this scaffold)
3. Move shared templates to `templates/*.json` in S3; drop redeploy for template-only edits
4. Coach thread storage in DynamoDB
5. LLM integration with schema validation + diff/patch
6. In-app coach UI
