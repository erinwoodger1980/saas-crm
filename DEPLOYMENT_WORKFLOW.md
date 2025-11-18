# Deployment Workflow Guide

## Overview

We use a **branch-based deployment strategy** with staging and production environments.

```
main (production) ← promote ← staging ← merge ← feature branches
     ↓ manual deploy           ↓ auto-deploy
  joineryai.app          staging.joineryai.app
```

## Environments

### 🟢 Production
- **Branch:** `main`
- **API:** https://api.joineryai.app
- **Web:** https://joineryai.app
- **Database:** Production PostgreSQL
- **Auto-deploy:** ❌ Disabled (manual only)

### 🟡 Staging
- **Branch:** `staging`
- **API:** https://api-staging.joineryai.app (configure in Render)
- **Web:** https://staging.joineryai.app (configure in Render)
- **Database:** Staging PostgreSQL (separate database)
- **Auto-deploy:** ✅ Enabled

### 🔵 Development
- **Branch:** Feature branches
- **API:** http://localhost:4000
- **Web:** http://localhost:3000
- **Database:** Local PostgreSQL

## Workflow Steps

### 1️⃣ Develop Feature
```bash
# Create feature branch from main
git checkout main
git pull
git checkout -b feature/your-feature

# Make changes, commit, push
git add .
git commit -m "feat: your feature"
git push -u origin feature/your-feature
```

### 2️⃣ Merge to Staging
```bash
# Merge feature to staging for testing
git checkout staging
git pull
git merge feature/your-feature
git push

# 🎯 This triggers auto-deploy to staging environment
```

**Or via GitHub:**
- Create PR: `feature/your-feature` → `staging`
- Review and merge
- Staging auto-deploys ✅

### 3️⃣ Test on Staging
- Visit https://staging.joineryai.app
- Test all features thoroughly
- Check logs in Render dashboard for errors
- Verify database migrations worked
- Test with real-ish data

### 4️⃣ Promote to Production
Once staging is validated:

**Option A: GitHub Actions (Recommended)**
1. Go to **Actions** tab in GitHub
2. Select **"Promote Staging to Production"** workflow
3. Click **"Run workflow"**
4. Type `promote` to confirm
5. This merges `staging` → `main`

**Option B: Manual Merge**
```bash
git checkout main
git pull
git merge staging --no-ff
git push
```

### 5️⃣ Deploy Production
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select **api** service → Click **"Manual Deploy"** → Choose `main` branch
3. Select **web** service → Click **"Manual Deploy"** → Choose `main` branch
4. Monitor deployment logs
5. Verify at https://joineryai.app

## CI/CD Pipeline

### All Branches
- ✅ Run tests on push/PR
- ✅ TypeScript compilation
- ✅ Linting checks
- ✅ Build verification

### Staging Branch
- ✅ All CI checks
- ✅ Auto-deploy to staging on merge

### Main Branch
- ✅ All CI checks
- ❌ No auto-deploy (manual only)

## Render Configuration

### First-Time Setup

1. **Create Staging Database** in Render:
   - Name: `joineryai-db-staging`
   - Copy connection string

2. **Configure Staging Services** in Render:
   - Create `api-staging` service from repo
   - Create `web-staging` service from repo
   - Set environment variables (see render.yaml)
   
3. **Set up Custom Domains** (optional):
   - api-staging.joineryai.app → api-staging service
   - staging.joineryai.app → web-staging service

### Required Environment Variables

#### api-staging
```bash
DATABASE_URL=postgresql://...  # Staging database
NODE_ENV=staging
ML_URL=https://new-ml-zo9l.onrender.com
ML_TIMEOUT_MS=8000
TEMPLATE_TENANT_NAME=Demo Tenant
APP_JWT_SECRET=<same as prod>
OPENAI_API_KEY=<your key>
# ... other env vars from production
```

#### web-staging
```bash
NODE_ENV=staging
API_ORIGIN=https://api-staging.joineryai.app
NEXT_PUBLIC_API_BASE=https://api-staging.joineryai.app
NEXT_PUBLIC_WEB_ORIGIN=https://staging.joineryai.app
```

## Emergency Rollback

If production has issues:

### Quick Fix
```bash
# Revert the problematic commit
git checkout main
git revert <commit-hash>
git push

# Manual deploy from Render dashboard
```

### Full Rollback
```bash
# Reset to previous working commit
git checkout main
git reset --hard <previous-commit-hash>
git push --force

# Manual deploy from Render dashboard
```

## Best Practices

✅ **Always test on staging first**
✅ **Keep staging and main in sync** (merge main → staging regularly)
✅ **Use descriptive commit messages**
✅ **Monitor Render logs after deployment**
✅ **Keep environment variables documented**
✅ **Test database migrations on staging before production**

❌ **Never push directly to main** (except emergencies)
❌ **Don't skip staging** (even for "small" changes)
❌ **Don't deploy during peak hours** (without warning)

## Troubleshooting

### Staging won't deploy
- Check CI status on staging branch
- Check Render logs for build errors
- Verify environment variables are set

### Can't merge to main
- Ensure staging is up to date with main
- Resolve any merge conflicts
- Make sure CI passes on staging

### Production deployment fails
- Check Render logs
- Verify database migrations
- Check environment variables
- Rollback if needed

## Monitoring

After deployment, monitor:
- 📊 Render service logs
- 🔍 Error rates in application
- ⏱️ Response times
- 💾 Database performance
- 🔐 Authentication issues

## Support

Questions? Check:
- Render Dashboard: https://dashboard.render.com
- GitHub Actions: https://github.com/erinwoodger1980/saas-crm/actions
- This guide: `/DEPLOYMENT_WORKFLOW.md`
