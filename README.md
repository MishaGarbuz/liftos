# LiftOS

Personal lifting tracker — **https://www.liftos.net** · also **https://www.auxos.app**

Static SPA + API Gateway + Lambda + DynamoDB + Cognito (`ap-southeast-2`) · GitHub `MishaGarbuz/liftos`

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) configured for `ap-southeast-2`
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html)

## Deploy

**Backend:**

```bash
cd backend
./deploy.sh
# Optional alarms email:
sam deploy --template-file packaged.yaml --stack-name lifting-tracker \
  --capabilities CAPABILITY_IAM --region ap-southeast-2 \
  --parameter-overrides AlertEmail=you@example.com
```

Commit updated `config.json`, then push to `main` for Amplify (~1 min).

**First login (once):**

```bash
cd backend
./create-user.sh your@email.com 'YourSecurePass12!Symbol'
```

Password: 12+ chars, upper, lower, number, symbol. Pool is admin-create only (no public sign-up).

Sign in at https://www.liftos.net or https://www.auxos.app (same Cognito account and cloud data). Use **Forgot password** on the login screen if needed.

## Custom domain (auxos.app)

1. In **Amplify Console** → your app → **Hosting** → add custom domains `auxos.app` and `www.auxos.app`.
2. Copy the Amplify **CloudFront domain** into `infra/route53-auxos-app.json` if it differs from the template.
3. Apply DNS (hosted zone for `auxos.app`):

```bash
cd infra
./apply-dns.sh <HOSTED_ZONE_ID>
```

4. Run `backend/deploy.sh` so CORS allows both production origins (`AllowedOrigins` in `backend/template.yaml`).

## Local API (optional)

```bash
cd backend && sam build && sam local start-api --port 3001
```

Serve `index.html` on localhost; app uses `http://localhost:3001` automatically.

## Features

- PWA: install via browser “Add to Home Screen” (`manifest.json` + service worker)
- Cloud sync with offline queue; import/export JSON backups
- Per-user DynamoDB partition (JWT `sub`); legacy `USER#michael` data migrates on first login
- Cognito forgot-password flow on login screen
- Plate calculator (target weight → bar + plates per side)
- Last-time hints, repeat last workout, rest timer alerts

## Docs

- [docs/FRONTEND.md](docs/FRONTEND.md) — script load order and UI conventions
- [docs/IMPLEMENTATION_LOG.md](docs/IMPLEMENTATION_LOG.md) — **feature logic, data flow, where to edit** (rest timer, sync, supersets, etc.)

## Frontend layout

See [docs/FRONTEND.md](docs/FRONTEND.md) for script load order and module boundaries (`index.html`, `css/app.css`, `js/**`).

## Teardown

```bash
aws cloudformation delete-stack --stack-name lifting-tracker --region ap-southeast-2
```
