# Deployment Checklist for Render

## Issue Fixed
The web deployment was timing out because:
1. The `DevAuth` component was running in production and making API calls
2. Missing environment variables for the web service
3. No explicit `NODE_ENV=production` setting

## Changes Made
1. ✅ Fixed `DevAuth` to only run in development mode
2. ✅ Added required environment variables to `render.yaml`
3. ✅ Set `NODE_ENV=production` for the web service
4. ✅ Set `API_ORIGIN` to point to your existing API service

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

## Next Steps
1. Commit and push these changes
2. Redeploy your services
3. Set the environment variables in Render Dashboard
4. Test the deployment

## Health Check URLs
- API: `https://joinery-ai.onrender.com/health`
- Web: `https://your-web-service.onrender.com/health`
- ML: `https://new-ml-zo9l.onrender.com/health`