# MS365 Client Secret Configuration Error

## Problem
The Render deployment is using the MS365 client secret **ID** instead of the client secret **value**, causing token refresh failures:

```
Error: AADSTS7000215: Invalid client secret provided. 
Ensure the secret being sent in the request is the client secret value, 
not the client secret ID, for app '4c470ccc-fbc6-4746-8d98-90b9a88e63ff'
```

## Solution
Update the `MS365_CLIENT_SECRET` environment variable on Render with the correct secret value from Azure.

### Steps to Fix

1. **Go to Azure Portal** → App registrations → Search for app ID `4c470ccc-fbc6-4746-8d98-90b9a88e63ff`

2. **Navigate to Certificates & secrets**:
   - Left sidebar → "Certificates & secrets"
   - Click the "Client secrets" tab

3. **Find the correct secret**:
   - You'll see a list of secrets with:
     - **Display name** (the secret's label/ID) - ❌ This is NOT what you need
     - **Value** (the actual secret string) - ✅ This is what you need
   - Copy the **Value** (not the Display name)
   - Note: The Value column only shows if you click "Show" on that row, or immediately after creation

4. **Update Render environment variables**:
   - Log in to Render dashboard → Your project
   - Go to Settings → Environment
   - Find the `MS365_CLIENT_SECRET` variable
   - Replace its value with the secret **Value** from Azure (the long string)
   - Save/deploy

### Key Differences
- **Secret ID/Display Name**: Short identifier like "api-secret" or "outlook-token" - ❌ WRONG
- **Secret Value**: Long cryptographic string starting with something like `iy8Q...` - ✅ CORRECT

### Verification
After updating, the error should stop appearing in Render logs. The token refresh will work and MS365 connections will function properly.

### Related Code
- Token refresh endpoint: `/api/src/services/user-email.ts:139` (refreshMs365Token function)
- Environment config: `/api/src/env.ts:101` (MS365_CLIENT_SECRET loading)
- Error occurs when: Users' MS365 refresh tokens are refreshed to get new access tokens
