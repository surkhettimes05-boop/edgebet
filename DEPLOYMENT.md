# EdgeBet — Production Deployment Guide

## Architecture

```
Vercel (Next.js frontend)
    ↕ HTTPS
Railway (Express API)
    ↕ PostgreSQL wire protocol (SSL)
Supabase (PostgreSQL database)
    ↑
Railway Cron (Python prediction worker, every 6h)
```

---

## Prerequisites

- Node.js 20+, npm 10+
- Python 3.11+
- Railway CLI: `npm install -g @railway/cli`
- Vercel CLI: `npm install -g vercel`
- A Supabase project (free tier works for MVP)
- An account at [the-odds-api.com](https://the-odds-api.com) (free tier: 500 req/month)
- An OpenAI API key (for the LLM auditor)

---

## Step 1 — Supabase Database

1. Create a new Supabase project at [supabase.com](https://supabase.com).
2. Go to **Project Settings → Database → Connection string (URI)**.
3. Copy the URI. It looks like:
   ```
   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
4. Append `?sslmode=require` to the URI.
5. Save this as `DATABASE_URL` — you will use it in both the API and the prediction worker.

> Supabase free tier includes 500 MB storage and 2 GB bandwidth/month.
> The EdgeBet MVP schema fits comfortably within these limits.

---

## Step 2 — API on Railway

### 2a. Create the service

```bash
railway login
railway init          # creates a new project
railway link          # link to existing project if needed
```

### 2b. Set environment variables

In Railway → Service → Variables, add every key from `apps/api/.env.production`.
Replace all placeholder values with real secrets.

Generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2c. Configure the service root

Railway needs to know the service lives in a subdirectory of the monorepo.
In Railway → Service → Settings → Root Directory, set:
```
apps/api
```

### 2d. Deploy

```bash
cd apps/api
railway up
```

Railway will:
1. Detect Node.js via Nixpacks
2. Run `npm install`
3. Run `npm run start:prod` which executes `prisma migrate deploy` then starts the server

### 2e. Verify

```bash
node apps/api/scripts/health-check.js https://YOUR-RAILWAY-URL.up.railway.app
```

Expected output:
```
  ✓  API reachable
  ✓  Database connected
  ✓  Matches endpoint responds
  ✓  Calibration endpoint responds

  4 passed, 0 failed
```

---

## Step 3 — Prediction Worker on Railway (Cron)

### 3a. Create a second Railway service in the same project

In Railway dashboard → **New Service → Empty Service**.
Name it `prediction-worker`.

### 3b. Set root directory

Railway → prediction-worker → Settings → Root Directory:
```
services/prediction-worker
```

### 3c. Set environment variables

Add `DATABASE_URL` (same Supabase URI as the API).
Add `PREDICTION_LIMIT=50` and `HISTORY_LIMIT=500`.

### 3d. Configure as a cron job

Railway → prediction-worker → Settings → Cron Schedule:
```
0 */6 * * *
```
This runs the worker every 6 hours. Adjust to `0 */3 * * *` for higher frequency
once you have an active odds API key.

### 3e. Deploy

```bash
cd services/prediction-worker
railway up
```

Railway will install Python dependencies from `requirements.txt` and run `python main.py`
on the cron schedule. The worker exits after each run — this is expected.

---

## Step 4 — Frontend on Vercel

### 4a. Import the repository

1. Go to [vercel.com/new](https://vercel.com/new).
2. Import your GitHub repository.
3. Set **Root Directory** to `apps/web`.
4. Framework preset: **Next.js** (auto-detected).

### 4b. Set environment variables

In Vercel → Project → Settings → Environment Variables, add:

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-RAILWAY-URL.up.railway.app` |

Set scope to **Production** (and optionally Preview).

### 4c. Deploy

Vercel deploys automatically on every push to `main`.
For a manual deploy:
```bash
cd apps/web
vercel --prod
```

### 4d. Update CORS on the API

Once you have your Vercel URL (e.g. `https://edgebet.vercel.app`), update the
`CORS_ORIGINS` variable in Railway:
```
CORS_ORIGINS=https://edgebet.vercel.app
```

Railway will redeploy automatically.

---

## Step 5 — Post-Deploy Validation

Run through this checklist after every production deploy:

### Automated
```bash
node apps/api/scripts/health-check.js https://YOUR-RAILWAY-URL.up.railway.app
```

### Manual
- [ ] `GET /health` returns `{ "status": "ok", "database": "connected" }`
- [ ] Frontend loads at your Vercel URL
- [ ] `/login` page renders, registration works end-to-end
- [ ] `/dashboard` loads after login
- [ ] `/matches` page loads (empty state is fine without odds data)
- [ ] `/value-bets` page loads (demo data shown without predictions)
- [ ] `/bet-tracker` page loads, LOG BET modal opens
- [ ] Prediction worker ran at least once (check Railway logs)
- [ ] No CORS errors in browser console

---

## Environment Variables Reference

### API (`apps/api/.env.production`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Supabase PostgreSQL URI with `?sslmode=require` |
| `NODE_ENV` | ✅ | Must be `production` |
| `PORT` | ✅ | Railway sets this automatically; default `4000` |
| `JWT_SECRET` | ✅ | 48+ byte random hex string. Rotate if compromised. |
| `JWT_EXPIRES_IN` | — | Token lifetime. Default `7d`. |
| `CORS_ORIGINS` | ✅ | Comma-separated list of allowed frontend origins |
| `ODDS_API_KEY` | — | From the-odds-api.com. Worker skips ingestion if absent. |
| `ODDS_SPORTS` | — | Comma-separated sport keys. Default: `basketball_nba` |
| `ODDS_CRON_ENABLED` | — | Set `true` to enable in-process odds cron |
| `LLM_API_KEY` | — | OpenAI API key. Audit endpoint returns error if absent. |
| `LLM_MODEL` | — | Default `gpt-4o-mini` |

### Web (`apps/web/.env.production`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | ✅ | Full URL of the Railway API service |

### Prediction Worker

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Same Supabase URI as the API |
| `PREDICTION_LIMIT` | — | Max upcoming matches per run. Default `50`. |
| `HISTORY_LIMIT` | — | Max historical results for xG. Default `500`. |

---

## Rollback Instructions

### API rollback (Railway)

Railway keeps a full deploy history.

**Option A — Dashboard:**
1. Railway → Service → Deployments
2. Find the last known-good deploy
3. Click **Redeploy**

**Option B — CLI:**
```bash
# List recent deploys
railway deployments

# Redeploy a specific deployment ID
railway redeploy <DEPLOYMENT_ID>
```

**If a bad migration was applied:**
Prisma does not auto-rollback migrations. To revert a schema change:

1. Write a new migration that undoes the change:
   ```bash
   # Locally, against a dev database
   npx prisma migrate dev --name revert_bad_change --schema apps/api/prisma/schema.prisma
   ```
2. Commit and push — Railway will apply it on next deploy.
3. Never delete migration files from `prisma/migrations/` — this breaks the migration history.

### Frontend rollback (Vercel)

1. Vercel → Project → Deployments
2. Find the last known-good deployment
3. Click the **⋯** menu → **Promote to Production**

This is instant — no rebuild required.

### Database rollback

Supabase does not support point-in-time restore on the free tier.
On the Pro tier: Supabase → Project → Database → Backups → Restore.

For the MVP, take a manual backup before any significant migration:
```bash
pg_dump "postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres?sslmode=require" \
  --no-owner --no-acl -Fc -f edgebet_backup_$(date +%Y%m%d).dump
```

---

## Production Health Checks

### Automated (run after every deploy)
```bash
node apps/api/scripts/health-check.js $API_URL
```

### Manual endpoint checks

```bash
# API health
curl https://YOUR-API.up.railway.app/health

# Database connectivity
curl https://YOUR-API.up.railway.app/health | jq .database

# Matches (should return empty array if no odds ingested yet)
curl https://YOUR-API.up.railway.app/matches | jq .meta

# Calibration (should return empty stats)
curl https://YOUR-API.up.railway.app/calibration | jq .data.stats.resolvedCount
```

### Monitoring recommendations

- Set up Railway's built-in **Uptime Monitoring** on the `/health` endpoint.
- Configure a Railway alert for deploy failures.
- Check prediction worker logs after each cron run:
  ```bash
  railway logs --service prediction-worker
  ```

---

## Security Notes

- `JWT_SECRET` must be at least 48 bytes of random data. Rotate it by updating the
  Railway variable — all existing sessions will be invalidated immediately.
- `DATABASE_URL` contains the database password. Treat it as a top-secret credential.
- The `.env.production` files in this repo contain only placeholders. Real values
  live exclusively in Railway and Vercel environment variable stores.
- HTTP-only cookies are used for session persistence alongside Bearer tokens.
  The `Secure` flag is set automatically when `NODE_ENV=production`.
- All API responses include `X-Content-Type-Options`, `X-Frame-Options`, and
  `Strict-Transport-Security` headers in production.
