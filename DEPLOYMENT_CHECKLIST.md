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

## Health Check URLs
- API: `https://joinery-ai.onrender.com/health`
- Web: `https://your-web-service.onrender.com/health`
- ML: `https://new-ml-zo9l.onrender.com/health`

## Troubleshooting
- If you can't log in, make sure the demo account was created successfully
- If API calls fail, check that `NEXT_PUBLIC_API_BASE` is set correctly
- If authentication doesn't work, verify the API and Web services can communicate