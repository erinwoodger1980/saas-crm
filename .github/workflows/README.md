# GitHub Actions Deployment Workflow

## Overview

This repository uses a three-workflow system to ensure safe deployments to Render:

1. **`api-ci.yml`** - Runs tests/build for API when `api/**` files change
2. **`web-ci.yml`** - Runs tests/build for Web when `web/**` files change  
3. **`deploy-to-render.yml`** - Deploys to Render **only when BOTH ci workflows pass**

## How It Works

### Path-Based Triggering
- `api-ci` only runs when files in `api/**` change
- `web-ci` only runs when files in `web/**` change
- This prevents unnecessary builds and saves CI minutes

### Conditional Deployment
The `deploy-to-render.yml` workflow uses `workflow_run` triggers to:
1. Wait for both `api-ci` and `web-ci` to complete
2. Check that **both** workflows succeeded for the same commit SHA
3. Prevent duplicate deployments (only deploys once per commit)
4. Only then trigger the Render deployment

### Deployment Flow

```
Push to main (api/** or web/** changes)
    ↓
api-ci and/or web-ci run
    ↓
deploy-to-render checks if BOTH passed
    ↓
    ├─ Both passed → Deploy to Render ✅
    ├─ One failed → Skip deployment ❌
    ├─ Still waiting → Skip for now ⏳
    └─ Already deployed → Skip duplicate 🔄
```

## Setup Instructions

### 1. Get Render API Credentials

1. Log in to [Render Dashboard](https://dashboard.render.com)
2. Go to **Account Settings** → **API Keys**
3. Create a new API key (or use existing)
4. Copy the API key

### 2. Get Service ID

You need the Service ID for your **API service** (the one with Prisma migrations):

**Option A - From URL:**
1. Go to your API service in Render dashboard
2. Look at the URL: `https://dashboard.render.com/web/srv-xxxxx`
3. The `srv-xxxxx` part is your Service ID

**Option B - From API:**
```bash
curl -H "Authorization: Bearer YOUR_RENDER_API_KEY" \
  https://api.render.com/v1/services | jq '.[] | {id, name}'
```

### 3. Add GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add two repository secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `RENDER_API_KEY` | Your Render API key | Used to authenticate with Render API |
| `RENDER_SERVICE_ID` | `srv-xxxxx` | The ID of your API service on Render (runs Prisma migrations) |
| `RENDER_WEB_SERVICE_ID` | `srv-xxxxx` | Optional: ID of your Web service to auto-deploy UI after API migrations |

### 4. Verify Setup

1. Make a small change to a file in `api/**` or `web/**`
2. Push to `main` branch
3. Watch the Actions tab:
   - The relevant CI workflow(s) should run
   - Once both pass, `deploy-to-render` should trigger
   - Check the workflow summary for deployment status

## Workflow Details

### api-ci.yml

- **Triggers:** Push/PR to `main` with `api/**` changes
- **Jobs:**
  - Installs dependencies with pnpm
  - Generates Prisma client
  - Compiles TypeScript
  - Runs parse smoke test
  - Verifies API starts

### web-ci.yml

- **Triggers:** Push/PR to `main` with `web/**` changes
- **Jobs:**
  - Installs dependencies with pnpm
  - Rebuilds native modules (LightningCSS)
  - Builds Next.js application
  - Uploads build artifacts

### deploy-to-render.yml

- **Triggers:** After `api-ci` or `web-ci` completes
- **Logic:**
  1. Checks if triggering workflow succeeded (exits early if failed)
  2. Queries GitHub API for status of BOTH workflows for the same commit
  3. Checks for duplicate deployments to prevent re-deploying same commit
  4. Triggers Render deployment via API if all checks pass (API required, Web optional)

## Troubleshooting

### Deployment Not Triggering

**Problem:** Both CI workflows pass but no deployment happens

**Solutions:**
1. Check workflow names match exactly: `api-ci` and `web-ci`
2. Verify secrets are set correctly in GitHub Settings
3. Check the deploy workflow logs for specific error messages
4. Ensure you're pushing to `main` branch

### Deployment Happens Twice

**Problem:** Same commit deploys multiple times

**Solution:** The workflow includes duplicate detection. If this happens:
1. Check the deployment summary in the Actions tab
2. Look for "already deployed" messages
3. Verify the duplicate check logic is working (check logs)

### Only One Workflow Runs

**Problem:** Changes to `api/**` don't trigger `web-ci` (or vice versa)

**Solution:** This is expected behavior! Path filters ensure only relevant workflows run:
- Changes to `api/**` → only `api-ci` runs
- Changes to `web/**` → only `web-ci` runs
- Changes to both → both run

The deploy workflow knows to wait for BOTH, even if only one was triggered by recent changes.

### Prisma Migrations Failing

**Problem:** Render deployment succeeds but migrations fail

**Solution:** 
1. Check your `render.yaml` has the correct `preDeployCommand`
2. Verify `DATABASE_URL` is set in Render service environment
3. Check migration logs in Render dashboard
4. Ensure migrations are in `api/prisma/migrations/` directory

## Manual Deployment

To manually trigger a deployment without pushing code:

1. Go to Actions tab
2. Select `api-ci` or `web-ci` workflow
3. Click "Run workflow" → select `main` branch
4. Once it completes successfully, `deploy-to-render` will trigger

## Render Configuration

Your `render.yaml` already includes the migration command:

```yaml
services:
  - type: web
    name: api
    preDeployCommand: npx prisma migrate deploy && pnpm tsx scripts/update-wealden-landing-prod.ts || true
```

This ensures Prisma migrations run **before** the new code is deployed, preventing database schema mismatches.

## Benefits of This Setup

✅ **Safety:** Deployment only happens when both API and Web builds pass  
✅ **Efficiency:** Only relevant workflows run based on file changes  
✅ **No Duplicates:** Prevents deploying the same commit multiple times  
✅ **Visibility:** Clear logs and summaries for each deployment  
✅ **Automated:** Zero manual intervention required after initial setup  
✅ **Migration Safety:** Prisma migrations run before new code deploys  

## Questions?

- Check workflow run logs in the Actions tab for detailed information
- Each deploy workflow includes a summary showing exactly why it deployed (or didn't)
- Workflow status badges: `Actions` tab → workflow name → `...` → `Create status badge`
