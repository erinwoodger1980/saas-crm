# Gmail OAuth Setup Guide

## Overview
To enable Gmail integration in your CRM, you need to create OAuth 2.0 credentials in Google Cloud Console.

## Step-by-Step Setup

### 1. Go to Google Cloud Console
Visit: https://console.cloud.google.com/

### 2. Create or Select a Project
- Click on the project dropdown at the top
- Either select an existing project or click "New Project"
- Name it something like "Joinery AI CRM" or "SaaS CRM"

### 3. Enable Gmail API
1. Go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click "Enable"

### 4. Create OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (or "Internal" if you have Google Workspace)
3. Fill in the required information:
   - App name: "Joinery AI CRM"
   - User support email: your email
   - Developer contact: your email
4. Add scopes:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.send`
   - `https://www.googleapis.com/auth/gmail.modify`
5. Add test users (your email addresses during development)
6. Save and continue

### 5. Create OAuth 2.0 Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth 2.0 Client ID"
3. Application type: **Web application**
4. Name: "SaaS CRM Local Dev"
5. **Authorized redirect URIs** - Add:
   ```
   http://localhost:4000/gmail/user/callback
   ```
6. Click "Create"
7. **IMPORTANT**: Copy the Client ID and Client Secret that appear

### 6. Update Your .env File
Edit `/Users/Erin/saas-crm/api/.env` and replace the placeholder values:

```bash
GMAIL_CLIENT_ID=your-actual-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-actual-client-secret
GMAIL_REDIRECT_URI=http://localhost:4000/gmail/user/callback
```

### 7. Restart the API Server
```bash
cd /Users/Erin/saas-crm/api
# Kill the current server
lsof -ti :4000 | xargs kill

# Restart it
npm run dev > /tmp/api.log 2>&1 &
```

### 8. Test the Connection
1. Go to Settings in your CRM
2. Click "Connect Gmail"
3. You should be redirected to Google's OAuth consent page
4. Approve the permissions
5. You'll be redirected back to your app

## Production Setup

For production deployment, you'll need to:

1. **Verify your OAuth consent screen** (submit for Google review if needed)
2. **Update the redirect URI** to your production domain:
   ```
   https://api.yourdomain.com/gmail/user/callback
   ```
3. **Create production credentials** with the production redirect URI
4. **Update production environment variables**

## Troubleshooting

### Error: "oauth_start_failed"
- Check that `GMAIL_CLIENT_ID` is set in `.env`
- Restart the API server after changing `.env`

### Error: "redirect_uri_mismatch"
- Ensure the redirect URI in Google Cloud Console exactly matches `GMAIL_REDIRECT_URI` in `.env`
- Common mistake: forgetting `/gmail/user/callback` at the end

### Error: "Access blocked: This app's request is invalid"
- Make sure you've added your email as a test user in the OAuth consent screen
- Check that all required scopes are added

### Error: "invalid_client"
- Double-check your `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`
- Make sure there are no extra spaces or quotes in the `.env` file

## Security Notes

⚠️ **NEVER commit OAuth credentials to git!**
- `.env` files should be in `.gitignore`
- Use different credentials for dev/staging/production
- Rotate credentials if they're ever exposed

## Additional Resources

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Gmail API Scopes](https://developers.google.com/gmail/api/auth/scopes)
- [OAuth Consent Screen Setup](https://support.google.com/cloud/answer/10311615)
