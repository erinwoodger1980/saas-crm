# Deployment Checklist for Render

## Issue Fixed
The web deployment was timing out and lead details weren't loading because:
1. The `DevAuth` component was running in production and making API calls
2. Missing environment variables for the web service
3. No explicit `NODE_ENV=production` setting
4. Authentication cookie mismatch between frontend middleware and API server

## Changes Made
1. ✅ Fixed `DevAuth` to only run in development mode
2. ✅ Added required environment variables to `render.yaml`
3. ✅ Set `NODE_ENV=production` for the web service
4. ✅ Set `API_ORIGIN` to point to your existing API service
5. ✅ Fixed authentication cookie name in middleware (`jid` → `jauth`)

## Environment Variables to Set in Render Dashboard

### For Web Service
After deployment, go to your web service in Render Dashboard and set these environment variables:

**Required:**
- `NEXT_PUBLIC_API_BASE` = `https://joinery-ai.onrender.com`

**Optional (for full functionality):**
- `NEXT_PUBLIC_FOUNDERS_PROMO_CODE` = (your promo code)
- `NEXT_PUBLIC_DISCOUNT_DEADLINE` = (deadline date)
- `NEXT_PUBLIC_STRIPE_CHECKOUT_URL_MONTHLY` = (your monthly Stripe URL)
- `NEXT_PUBLIC_STRIPE_CHECKOUT_URL_ANNUAL` = (your annual Stripe URL)

### For API Service
Make sure these are set:
- `ML_URL` = `https://new-ml-zo9l.onrender.com`

Email OAuth (redirect URIs must match your deployed API base):
- `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`
- `GMAIL_REDIRECT_URI` should include both tenant and user flows in your Google Cloud Console:
  - https://YOUR-API-BASE/gmail/oauth/callback
  - https://YOUR-API-BASE/gmail/user/callback
- `MS365_CLIENT_ID` / `MS365_CLIENT_SECRET` / `MS365_TENANT` ("common" is fine)
- `MS365_REDIRECT_URI` should be registered in Azure App registration and point to:
  - https://YOUR-API-BASE/ms365/callback (SSO login flow, optional)
  - https://YOUR-API-BASE/ms365/user/callback (per-user email connection)
- `MS365_SCOPES` should include at least: `offline_access Mail.ReadWrite User.Read`

Optional (controls automated Sent-folder ingestion/training schedule on the API server):
- `ML_AUTO_COLLECT_SENT` = `1` to enable, `0` to disable
	- Default: enabled in production, disabled in local dev
- `ML_SENT_COLLECT_EVERY_MIN` = interval in minutes (minimum 30)
	- Default: `60` (runs roughly hourly per tenant)

## Creating a Demo Account for Testing

Since the app no longer auto-creates demo accounts in production, you'll need to create a user account manually:

### Option 1: Using API Service Terminal (Recommended)
1. Go to your API service dashboard on Render
2. Open the Shell/Terminal
3. Run: `node scripts/bootstrap-admin.mjs demo@acme.test Password123!`

### Option 2: Using Local Database Connection
If you have the production database URL:
```bash
cd api
DATABASE_URL='your_production_db_url' node scripts/bootstrap-admin.mjs demo@acme.test Password123!
```

### Option 3: Through Stripe Signup (Production)
Use the signup flow at `/signup` which goes through Stripe checkout.

## Login Credentials
After creating the demo account, you can log in at:
- URL: `https://your-web-service.onrender.com/login`
- Email: `demo@acme.test`
- Password: `Password123!`

## Next Steps
1. ✅ Commit and push these changes
2. ✅ Redeploy your services  
3. Set the environment variables in Render Dashboard
4. Create a demo account using one of the methods above
5. Test the deployment by logging in
6. Run pending Prisma migrations on API (see Schema Migrations section below)

## Health Check URLs
- API: `https://joinery-ai.onrender.com/health`
- Web: `https://your-web-service.onrender.com/health`
- ML: `https://new-ml-zo9l.onrender.com/health`

## Troubleshooting
- If you can't log in, make sure the demo account was created successfully
- If API calls fail, check that `NEXT_PUBLIC_API_BASE` is set correctly
- If authentication doesn't work, verify the API and Web services can communicate

## Schema Migrations
If supplier PDF template saving fails with missing column errors (pageCount/meta/createdByUserId) run:

```bash
cd api
DATABASE_URL="<prod_db_url>" npx prisma migrate deploy
```

Included idempotent migration: `20251124183000_add_pdf_template_optional_columns` adds any missing optional columns and index.

To verify columns:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name='PdfLayoutTemplate';
```

If still failing, tail logs and confirm new POST /pdf-templates diagnostic lines, then re-run deploy.