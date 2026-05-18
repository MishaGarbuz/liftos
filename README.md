# LiftOS – AWS Full Stack

## Architecture

```
Browser (lifting-tracker.html)
        │  HTTPS
        ▼
API Gateway (prod stage)
        │
   ┌────┴────────────────────────────┐
   │         Lambda Functions        │
   ├─ Sessions  (CRUD sessions)      │
   ├─ Sets      (log sets + E1RM)    │
   ├─ Progress  (chart data)         │
   └─ Summary   (dashboard KPIs)    │
        │
        ▼
DynamoDB (LiftingTracker table)
  PK: USER#michael / PROGRESS#michael / SESSION#<id>
  SK: SESSION#<id> / EXERCISE#<name>#WEEK#<nn> / SET#<ex>#<nn>
```

## Prerequisites

```bash
# Install AWS SAM CLI
brew install aws-sam-cli          # macOS
pip install aws-sam-cli           # or pip

# Configure AWS credentials (ap-southeast-2 = Sydney)
aws configure
# AWS Access Key ID: <your key>
# AWS Secret Access Key: <your secret>
# Default region: ap-southeast-2
# Default output: json
```

## Backend Deploy (5 minutes)

```bash
cd lifting-tracker-aws/backend

# Option A: One command
./deploy.sh

# Option B: Manual SAM
sam build
sam deploy --guided
# Stack name: lifting-tracker
# Region: ap-southeast-2
# Confirm changes: Y
# Allow IAM role creation: Y
```

After deploy, copy the **API URL** from the output (looks like):
`https://abc123def.execute-api.ap-southeast-2.amazonaws.com/prod`

## Frontend Deploy (liftos.app)

The canonical app is **`index.html`** at the repo root, with **`config.json`** (API URL, auto-loaded on startup).

### Git → Amplify (CI/CD)

The frontend auto-deploys on every push to **`main`** via [AWS Amplify](https://ap-southeast-2.console.aws.amazon.com/amplify/home?region=ap-southeast-2#/d3rsrp8jsdtbu1) (app `lifttracker`).

| Item | Value |
|------|--------|
| GitHub | `github.com/MishaGarbuz/liftos` |
| Amplify app ID | `d3rsrp8jsdtbu1` |
| Production branch | `main` |
| Build spec | `amplify.yml` (repo root) |
| Default URL | `https://d3rsrp8jsdtbu1.amplifyapp.com` |

**Workflow:** edit `index.html` or `config.json` → `git push origin main` → Amplify builds and deploys (~1 min).

**Custom domains** (configure at your registrar):

| Domain | Record | Value |
|--------|--------|--------|
| `liftos.app` (apex) | CNAME or ALIAS | `drqwm1ecp3jfm.cloudfront.net` |
| `www.liftos.app` | CNAME | `drqwm1ecp3jfm.cloudfront.net` |

`liftos.net` / `www.liftos.net` also point to this app (branch `main`). Check Amplify → Domain management for live DNS values if these change.

**Backend:** run `cd backend && ./deploy.sh` locally after API changes; commit the updated `config.json` and push so the frontend picks up the new URL.

### Option 1: AWS Amplify (drag-and-drop)
1. Go to https://console.aws.amazon.com/amplify
2. "Host a web app" → "Deploy without Git"
3. Drag and drop **`index.html`** and **`config.json`**
4. Add custom domain **liftos.app** in Domain management

### Option 2: S3 Static Website
```bash
BUCKET="michael-liftos-app"
aws s3 mb s3://$BUCKET --region ap-southeast-2
aws s3 cp frontend/lifting-tracker.html s3://$BUCKET/index.html --content-type "text/html"
aws s3 website s3://$BUCKET --index-document index.html
# Enable public access in S3 console → Permissions → Block public access → OFF
# Add bucket policy for public read
```

### Option 3: Vercel / Netlify
Drag `lifting-tracker.html` (rename to `index.html`) — instant deploy.

## Backend connection

The app reads **`/config.json`** on load (written by `./deploy.sh`). Sets and sessions sync to DynamoDB automatically when the API is reachable. If the API is down, data is cached in **localStorage** and syncs on the next visit.

Local dev: `sam local start-api --port 3001` — the app uses `http://localhost:3001` when opened from localhost.

## DynamoDB Data Model

| Entity | PK | SK | Description |
|--------|----|----|-------------|
| Session | `USER#michael` | `SESSION#<uuid>` | Workout session metadata |
| Set | `SESSION#<uuid>` | `SET#<exercise>#<003>` | Individual logged set |
| Progress | `PROGRESS#michael` | `EXERCISE#<name>#WEEK#<02>` | Best E1RM per exercise per week |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /sessions | List all sessions |
| POST | /sessions | Create/update session |
| GET | /sessions/{id} | Get single session |
| DELETE | /sessions/{id} | Delete session |
| GET | /sessions/{id}/sets | Get all sets for session |
| POST | /sessions/{id}/sets | Log a set (auto-updates progress) |
| GET | /progress | All exercises latest E1RM |
| GET | /progress/{exercise} | Single exercise 12-week chart data |
| GET | /summary | Dashboard KPIs |

## Cost Estimate (Sydney region, free tier eligible)

| Service | Usage | Monthly Cost |
|---------|-------|-------------|
| DynamoDB | ~1,000 writes/month | $0 (free tier) |
| Lambda | ~5,000 requests/month | $0 (free tier) |
| API Gateway | ~5,000 requests/month | $0 (free tier) |
| S3/Amplify | Static hosting | ~$0.01 |
| **Total** | | **~$0/month** |

## Local Development

```bash
cd backend
sam local start-api --port 3001
# Then in lifting-tracker.html, set API_BASE to http://localhost:3001
```

## Teardown

```bash
aws cloudformation delete-stack --stack-name lifting-tracker --region ap-southeast-2
```
