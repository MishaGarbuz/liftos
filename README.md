# LiftOS

Personal lifting tracker — **https://www.liftos.net**

Static SPA (`index.html` + `config.json`) on Amplify · API Gateway + Lambda + DynamoDB + Cognito in `ap-southeast-2` · GitHub `MishaGarbuz/liftos`

## Prerequisites

- [AWS CLI](https://aws.amazon.com/cli/) configured for `ap-southeast-2`
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) (`brew install aws-sam-cli`)

## Deploy

**Backend** (API + Cognito + DynamoDB):

```bash
cd backend
./deploy.sh
```

Commit the updated `config.json` at the repo root, then push to `main`.

**Frontend** — push to `main`; Amplify builds from `amplify.yml` (~1 min).

## First login (once per environment)

```bash
cd backend
./create-user.sh your@email.com 'YourSecurePass123!'
```

Password must match the pool policy (12+ characters, upper, lower, number, symbol). Sign in at https://www.liftos.net.

If sign-in fails with `FORCE_CHANGE_PASSWORD`, re-run the same command (the script disables the AWS CLI pager so the password step always runs).

## Local API (optional)

```bash
cd backend
sam build && sam local start-api --port 3001
```

Serve `index.html` locally (e.g. Live Server on port 5500). The app uses `http://localhost:3001` when the hostname is `localhost` / `127.0.0.1`; production still requires Cognito sign-in.

## Teardown

```bash
aws cloudformation delete-stack --stack-name lifting-tracker --region ap-southeast-2
```
