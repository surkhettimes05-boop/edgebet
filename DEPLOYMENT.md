# EdgeBet - Deployment Guide

## GitHub Repository

Your code is now hosted at: **https://github.com/surkhettimes05-boop/edgebet**

All commits are tracked and the repository is ready for collaboration.

## Vercel Deployment

### Prerequisites

1. **Vercel Account**: Sign up at https://vercel.com (free tier available)
2. **GitHub Connected**: Your GitHub account should be connected to Vercel
3. **Environment Variables**: Database and OAuth credentials

### Step 1: Connect to Vercel

1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Select "Import Git Repository"
4. Search for and select `surkhettimes05-boop/edgebet`
5. Click "Import"

### Step 2: Configure Environment Variables

In the Vercel project settings, add the following environment variables:

**Required Variables:**
```
DATABASE_URL=postgresql://user:password@host:port/database
JWT_SECRET=your-secret-key-here
VITE_APP_ID=your-oauth-app-id
OAUTH_SERVER_URL=https://api.manus.im
VITE_OAUTH_PORTAL_URL=https://oauth.manus.im
OWNER_OPEN_ID=your-owner-id
OWNER_NAME=Your Name
```

**Optional Variables (for LLM features):**
```
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
VITE_FRONTEND_FORGE_API_KEY=your-frontend-key
VITE_FRONTEND_FORGE_API_URL=https://api.manus.im
```

### Step 3: Deploy

1. After adding environment variables, click "Deploy"
2. Vercel will automatically build and deploy your app
3. Your live URL will be: `https://edgebet-[random].vercel.app`

### Step 4: Custom Domain (Optional)

1. In Vercel project settings, go to "Domains"
2. Add your custom domain (e.g., `edgebet.com`)
3. Follow DNS configuration instructions

## Database Setup for Production

### Option 1: PostgreSQL on Railway (Recommended)

1. Go to https://railway.app
2. Create new project → Add PostgreSQL
3. Copy the connection string
4. Add to Vercel environment variables as `DATABASE_URL`

### Option 2: PostgreSQL on AWS RDS

1. Create RDS instance with PostgreSQL
2. Configure security groups to allow Vercel IPs
3. Copy connection string to `DATABASE_URL`

### Option 3: PostgreSQL on Supabase

1. Go to https://supabase.com
2. Create new project
3. Copy PostgreSQL connection string
4. Add to Vercel environment variables

## Running Migrations

After deployment, run database migrations:

```bash
# In your local environment
DATABASE_URL="your-production-db-url" pnpm db:push
```

Or use Vercel's CLI:

```bash
vercel env pull
pnpm db:push
```

## Monitoring & Logs

### View Deployment Logs

1. Go to Vercel dashboard
2. Select your project
3. Click "Deployments" tab
4. Click on any deployment to see logs

### Real-time Logs

```bash
vercel logs --follow
```

## Troubleshooting

### Build Fails

**Error: "Cannot find module"**
- Solution: Ensure all dependencies are in `package.json`
- Run: `pnpm install` locally and commit `pnpm-lock.yaml`

**Error: "DATABASE_URL not set"**
- Solution: Add `DATABASE_URL` to Vercel environment variables
- Verify it's set for both Preview and Production environments

### Database Connection Issues

**Error: "ECONNREFUSED"**
- Solution: Check database URL is correct
- Verify database security groups allow Vercel IPs
- Test connection locally first

### OAuth Issues

**Error: "Invalid redirect URI"**
- Solution: Add Vercel URL to OAuth app's allowed redirects
- Format: `https://your-vercel-domain.vercel.app/api/oauth/callback`

## Performance Optimization

### Enable Caching

Add to `vercel.json`:
```json
{
  "headers": [
    {
      "source": "/api/trpc/:path*",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=60, s-maxage=120"
        }
      ]
    }
  ]
}
```

### Database Connection Pooling

For production, use connection pooling:
```
DATABASE_URL="postgresql://user:pass@pool.host:6543/db?schema=public"
```

## CI/CD Pipeline

Vercel automatically:
- Builds on every push to `main`
- Runs tests (if configured)
- Deploys to preview on pull requests
- Deploys to production on merge to `main`

### Add GitHub Status Checks

1. In Vercel settings, enable "Deployment Status"
2. This prevents merging PRs if deployment fails

## Rollback

To rollback to a previous deployment:

1. Go to Vercel dashboard
2. Click "Deployments"
3. Find the previous working deployment
4. Click the three dots → "Promote to Production"

## Environment-Specific Configuration

### Preview Environment (Pull Requests)
- Uses separate database (optional)
- Can have different API endpoints
- Good for testing before production

### Production Environment
- Uses production database
- Must have all required variables set
- Should use custom domain

## Monitoring & Analytics

### Enable Vercel Analytics

1. In Vercel project settings, enable "Web Analytics"
2. View real-time metrics in dashboard

### Application Monitoring

For production monitoring, consider:
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **New Relic**: Performance monitoring

## Scaling

### Auto-scaling

Vercel handles auto-scaling automatically:
- Scales up during traffic spikes
- Scales down during low traffic
- No configuration needed

### Database Scaling

As traffic grows:
1. Monitor database CPU/memory in Railway/AWS/Supabase
2. Upgrade instance type if needed
3. Consider read replicas for heavy read workloads

## Security Best Practices

1. **Never commit secrets** - Use environment variables only
2. **Enable branch protection** - Require reviews before merge
3. **Rotate secrets regularly** - Change API keys periodically
4. **Use HTTPS only** - Vercel provides free SSL/TLS
5. **Monitor logs** - Check for suspicious activity

## Support & Documentation

- **Vercel Docs**: https://vercel.com/docs
- **EdgeBet Setup**: See `EDGEBET_SETUP.md`
- **GitHub Issues**: Report bugs at https://github.com/surkhettimes05-boop/edgebet/issues

## Next Steps

1. ✅ Code pushed to GitHub
2. ⏳ Deploy to Vercel (follow steps above)
3. ⏳ Set up production database
4. ⏳ Configure custom domain
5. ⏳ Monitor and optimize performance
