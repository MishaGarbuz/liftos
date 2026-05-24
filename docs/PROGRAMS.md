# User programs (DynamoDB)

Training programs are no longer chosen only by hardcoded email in the frontend.

## Storage

| Key | Sort key | Purpose |
|-----|----------|---------|
| `PROGRAM#EMAIL` | `abhi.ar@hotmail.com` | Assignment **before** first login (admin setup) |
| `USER#{cognito-sub}` | `PROGRAM#active` | Active program copied on first sign-in |

Fields: `programId` (`michael` \| `abhi`), optional `bundle` (full JSON override).

## API (Cognito JWT required)

| Method | Path | Who |
|--------|------|-----|
| GET | `/program` | Signed-in user — own program |
| GET | `/program?email=` | Admin — read assignment |
| PUT | `/program` | Admin — `{ "email", "programId" }` or full `bundle` |
| GET | `/program/assignments` | Admin — list all email assignments |

## App flow

1. On login, `GET /program` runs after cloud connect.
2. If no user row exists, the API seeds from `PROGRAM#EMAIL` (or defaults).
3. Frontend applies `programId` to built-in templates in `js/data/programs/*.js`.
4. If `bundle` is present in DynamoDB, it overrides days/schedule/lifts (helpers like `phaseLabel` still come from the template).

## Admin UI

**Settings → Admin — program preview**: assign template by email, preview athlete view.

## Next steps (optional)

- Store full templates in S3 (`programs/{id}.json`) and reference by key from DynamoDB
- Coach editor UI for `bundle` JSON
- Per-user `setsForWeek` / phase rules in stored JSON without relying on built-ins
