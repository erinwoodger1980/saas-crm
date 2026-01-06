# Email Configuration Guide

## Current Status

The email system is **fully implemented** but **not configured**. All email functionality is in place but emails are failing silently due to missing SMTP credentials.

## What's Not Working (And Why)

1. **Feedback Emails to erin@erinwoodger.com** ❌
   - Code is calling `sendFeedbackNotification()` correctly
   - Failing silently because SMTP credentials are missing

2. **Daily 9am Task Reminder Emails** ❌
   - Cron job is scheduled and running (weekdays at 9:00 AM UK time)
   - Emails not sending because SMTP credentials are missing

3. **Holiday Request Notifications** ❌ (just added)
   - Will notify admins when holidays are requested
   - Will create tasks for approval
   - Emails won't send until SMTP is configured

## Required Configuration

Add the following to `/Users/Erin/saas-crm/.env.local`:

```bash
# SMTP Email Configuration
SMTP_HOST=smtp.gmail.com           # Or your email provider's SMTP server
SMTP_PORT=587                       # Usually 587 for TLS, 465 for SSL
SMTP_USER=your-email@gmail.com     # Your email address
SMTP_PASS=your-app-password        # App-specific password (NOT your regular password)
SMTP_SECURE=false                   # Set to "true" if using port 465

# Web URL for links in emails
WEB_URL=https://app.joineryai.app  # Or your production URL
```

## SMTP Provider Options

### Option 1: Gmail (Recommended for Development)
1. Go to https://myaccount.google.com/apppasswords
2. Create an "App Password" for "Mail"
3. Use these settings:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_SECURE=false
   ```

### Option 2: SendGrid (Recommended for Production)
1. Sign up at https://sendgrid.com
2. Create an API key
3. Use these settings:
   ```
   SMTP_HOST=smtp.sendgrid.net
   SMTP_PORT=587
   SMTP_USER=apikey
   SMTP_PASS=your-sendgrid-api-key
   SMTP_SECURE=false
   ```

### Option 3: AWS SES (Cost-Effective for Production)
1. Set up SES in AWS Console
2. Verify your sending email/domain
3. Create SMTP credentials
4. Use the provided credentials

### Option 4: Mailgun, Postmark, etc.
Any SMTP provider will work - just use their SMTP settings.

## Email Features Currently Implemented

### 1. Feedback Notifications ✅ (Code Ready)
- **Trigger**: When user submits feedback via the app
- **Recipient**: `erin@erinwoodger.com` (hardcoded)
- **Content**: Feature, rating, comment, user details
- **File**: `api/src/routes/feedback.ts` (line 213)

### 2. Daily Task Digest ✅ (Code Ready)
- **Trigger**: Cron job at 9:00 AM UK time, Monday-Friday
- **Recipients**: All users with email addresses
- **Content**: Tasks due in next 7 days, AI summary
- **Files**: 
  - `api/src/services/scheduler.ts` (cron schedule)
  - `api/src/services/task-digest.ts` (email generation)
  - `api/src/server.ts` line 1131 (initialization)

### 3. Holiday Request Notifications ✅ (Code Ready)
- **Trigger**: When employee submits holiday request
- **Recipients**: All owner/admin users
- **Content**: Employee name, dates, duration, reason, links to review
- **Creates Task**: Yes - "Review Holiday Request" assigned to admins
- **File**: `api/src/routes/workshop.ts` (lines 1780-1920)

## Testing After Configuration

### 1. Test Feedback Email
```bash
curl -X POST http://localhost:4455/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "feature": "test-feature",
    "rating": 5,
    "comment": "Test feedback to verify email"
  }'
```

Check: `erin@erinwoodger.com` should receive an email

### 2. Test Daily Digest (Manual Trigger)
Add this endpoint to `api/src/routes/scheduler.ts`:
```typescript
router.get("/trigger-digest", async (req, res) => {
  await triggerDailyDigestNow();
  res.json({ ok: true });
});
```

Then call:
```bash
curl http://localhost:4455/scheduler/trigger-digest
```

Check: All users with email addresses should receive digest

### 3. Test Holiday Request Email
1. Go to Workshop page
2. Click "Holidays" button
3. Submit a holiday request
4. Check: Admin users should receive email + task should be created

## Debugging

### Check if SMTP is configured:
```bash
cd /Users/Erin/saas-crm/api
node -e "require('dotenv').config({path:'../.env.local'}); console.log('SMTP_HOST:', process.env.SMTP_HOST); console.log('SMTP_USER:', process.env.SMTP_USER);"
```

### Watch server logs for email errors:
```bash
# Look for these log messages:
# [email-notification] SMTP not configured, skipping email send
# [email-notification] Email sent to ...
# [email-notification] Failed to send email: ...
```

### Common Issues:
1. **"Authentication failed"** - Wrong password or need app-specific password
2. **"Connection timeout"** - Wrong SMTP_HOST or PORT
3. **"Less secure app access"** - Gmail: Use App Password instead
4. **"Daily limit exceeded"** - Gmail has daily sending limits (500/day free accounts)

## Production Recommendations

1. **Use a dedicated email service** (SendGrid, Mailgun, AWS SES)
2. **Set up SPF/DKIM records** for your domain to avoid spam folders
3. **Monitor email delivery rates** 
4. **Add rate limiting** to avoid triggering spam filters
5. **Consider email templates** for consistent branding

## Next Steps

1. Add SMTP credentials to `.env.local`
2. Restart the API server: `cd /Users/Erin/saas-crm && pnpm dev`
3. Test feedback submission
4. Test holiday request submission
5. Wait for 9am (or manually trigger) to test daily digest

---

**All email code is ready and waiting for SMTP configuration!** 🎉
