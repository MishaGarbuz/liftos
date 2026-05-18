# LiftOS

Personal lifting tracker — **https://www.liftos.net**

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

Sign in at https://www.liftos.net · use **Forgot password** on the login screen if needed.

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

## Teardown

```bash
aws cloudformation delete-stack --stack-name lifting-tracker --region ap-southeast-2
```
