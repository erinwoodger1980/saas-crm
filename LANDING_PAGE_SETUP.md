# Landing Page Lead Capture - Setup Complete

## ✅ Files Created/Modified

### 1. Database Schema
- **Modified:** `api/prisma/schema.prisma`
  - Added `LandingLead` model for public lead capture
  - Includes fields: id, createdAt, source, name, email, phone, postcode, projectType, propertyType, message, userAgent, ip
  - Index on `[email, source, createdAt]` for fast dedupe checks

### 2. API Backend
- **Created:** `api/src/lib/env.ts` - Environment variable configuration
- **Created:** `api/src/lib/mailer.ts` - Email notification helper (nodemailer)
- **Created:** `api/src/lib/recaptcha.ts` - Google reCAPTCHA v3 verification
- **Modified:** `api/src/routes/leads.ts` - Added `POST /leads/public` endpoint

### 3. Frontend
- **Created:** `web/src/app/wealden-landing/page.tsx` - Premium landing page
- **Modified:** `web/src/app/layout.tsx` - Added `/wealden-landing` to marketing routes (no AppShell)
- **Modified:** `web/.env.local` - Added tracker env vars (GA4, Meta Pixel, Hotjar)
- **Created:** `web/public/images/wealden/p1.jpg` - `p6.jpg` (placeholder images)

### 4. Configuration
- **Modified:** `api/.env` - Added landing page env vars
- **Modified:** `api/.env.example` - Documented all new env vars
- **Modified:** `api/package.json` - Added `nodemailer` and `@types/nodemailer`

## 🔧 Environment Variables Required

### API (.env)
```bash
# Existing
DATABASE_URL=postgresql://user:password@localhost:5432/saas_crm
PORT=4000

# New for landing page
WEB_ORIGIN=http://localhost:3000           # Your web app URL (for CORS)
RECAPTCHA_ENABLED=false                     # Set to true to enable reCAPTCHA
RECAPTCHA_SECRET=                           # Google reCAPTCHA v3 secret key
SALES_NOTIFY_EMAIL=                         # Email to receive lead notifications
SMTP_HOST=                                  # SMTP server hostname
SMTP_PORT=587                               # SMTP port (usually 587 or 465)
SMTP_USER=                                  # SMTP username
SMTP_PASS=                                  # SMTP password
SMTP_SECURE=false                           # Set to true for port 465
```

### Web (.env.local)
```bash
NEXT_PUBLIC_API_BASE=http://localhost:4000
NEXT_PUBLIC_GA4_ID=                         # Optional: Google Analytics 4 ID
NEXT_PUBLIC_META_PIXEL_ID=                  # Optional: Meta/Facebook Pixel ID
NEXT_PUBLIC_HOTJAR_ID=                      # Optional: Hotjar site ID
```

## 📋 Deployment Checklist

### Before First Deploy

1. **Run Database Migration**
   ```bash
   cd api
   pnpm prisma generate
   pnpm prisma migrate dev --name add_landing_lead_model
   ```

2. **Install Dependencies**
   ```bash
   cd api
   pnpm install
   cd ../web
   pnpm install
   ```

3. **Replace Placeholder Images**
   - Add real joinery/window photos to `web/public/images/wealden/p1.jpg` through `p6.jpg`
   - Or download from Unsplash/Pexels with search terms:
     - "timber windows"
     - "oak door"
     - "joinery workshop"
     - "sash window"
     - "period property"

### Production Deployment (Render)

#### API Service Environment Variables
Add these to your Render API service:
```
DATABASE_URL=<your-production-postgres-url>
PORT=4000
WEB_ORIGIN=https://your-web-app-domain.com
RECAPTCHA_ENABLED=true
RECAPTCHA_SECRET=<your-recaptcha-secret>
SALES_NOTIFY_EMAIL=sales@wealdenjoinery.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=<your-app-password>
SMTP_SECURE=false
```

#### Web Service Environment Variables
Add these to your Render web service:
```
NEXT_PUBLIC_API_BASE=https://your-api-domain.com
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=123456789
NEXT_PUBLIC_HOTJAR_ID=123456
```

### After Deploy

1. **Run Migration in Production**
   - Render should auto-run migrations, or run manually:
     ```bash
     pnpm prisma migrate deploy
     ```

2. **Test the Endpoint**
   ```bash
   curl -X POST https://your-api-domain.com/leads/public \
     -H "Content-Type: application/json" \
     -d '{
       "source":"wealden-landing",
       "name":"Test User",
       "email":"test@example.com",
       "phone":"07123456789",
       "postcode":"TN1 1AA",
       "projectType":"Windows",
       "propertyType":"Period",
       "message":"Test message"
     }'
   ```
   Expected response: `{"ok":true,"id":"..."}`

3. **Test the Landing Page**
   - Visit `https://your-web-domain.com/wealden-landing`
   - Submit the form
   - Check that:
     - You receive email notification (if SMTP configured)
     - Lead is saved in database
     - GA4/Meta/Hotjar events fire (if configured)

## 🎯 API Endpoint Details

### POST /leads/public

**URL:** `http://localhost:4000/leads/public` (dev) or `https://your-api.com/leads/public` (prod)

**Method:** POST

**Headers:**
- `Content-Type: application/json`

**Body:**
```json
{
  "source": "wealden-landing",
  "name": "John Smith",
  "email": "john@example.com",
  "phone": "07123456789",
  "postcode": "TN1 1AA",
  "projectType": "Windows",
  "propertyType": "Period",
  "message": "I need a quote for sash windows",
  "recaptchaToken": ""
}
```

**Success Response (200):**
```json
{
  "ok": true,
  "id": "clx123abc..."
}
```

**Dedupe Response (200):**
```json
{
  "ok": true,
  "deduped": true,
  "id": "clx123abc..."
}
```

**Error Responses:**
- 400: `{"ok":false,"error":"missing_required_fields"}`
- 400: `{"ok":false,"error":"invalid_email"}`
- 400: `{"ok":false,"error":"recaptcha_failed"}`
- 500: `{"ok":false,"error":"server_error"}`

## 🔒 Security Features

1. **CORS Protection:** Only allows requests from `WEB_ORIGIN`
2. **Input Validation:** Required fields, email format, string length limits
3. **Sanitization:** All strings trimmed and capped at 5000 chars
4. **Rate Limiting:** 10-minute dedupe window per email+source
5. **reCAPTCHA v3:** Optional bot protection (score threshold: 0.4)
6. **IP Tracking:** Stores IP and user-agent for audit trail

## 📊 Analytics & Tracking

The landing page includes optional tracking for:

1. **Google Analytics 4**
   - PageView on load
   - `generate_lead` event on form submit
   - Channel: `google_ads`

2. **Meta Pixel**
   - PageView on load
   - `Lead` event on form submit

3. **Hotjar**
   - Session recording and heatmaps (if HOTJAR_ID set)

## 🎨 Landing Page Features

- **Premium Design:** Playfair Display + Inter fonts, gold/green palette
- **Responsive:** Mobile-first, adapts to all screen sizes
- **Sections:**
  - Hero with background image and gold CTAs
  - Why Choose section (3 cards)
  - Product range (Sash, Casement, Doors)
  - Project gallery (6 images)
  - Testimonials (3 quotes)
  - Quote form with validation
  - Accreditations
  - Footer with contact info
- **No AppShell:** Renders outside the main app navigation

## 🐛 Troubleshooting

### Form submission fails with CORS error
- Check `WEB_ORIGIN` in API .env matches your web domain
- Ensure API is running and accessible

### No email notifications
- Check all SMTP_* env vars are set correctly
- Test with Gmail: use App Password, not regular password
- Check `SALES_NOTIFY_EMAIL` is valid

### reCAPTCHA errors
- Set `RECAPTCHA_ENABLED=false` to disable
- If enabled, ensure `RECAPTCHA_SECRET` matches your reCAPTCHA v3 key
- Frontend needs to include reCAPTCHA script and get token

### Database migration fails
- Ensure `DATABASE_URL` is set and accessible
- Run `pnpm prisma generate` before migrate
- Check Prisma schema syntax

### Images not loading
- Replace placeholder files in `web/public/images/wealden/`
- Ensure filenames are `p1.jpg` through `p6.jpg`
- Check file permissions

## 📝 TODOs for Production

- [ ] Run database migration in production
- [ ] Add real joinery images (6 photos)
- [ ] Configure SMTP for email notifications
- [ ] Set up Google reCAPTCHA v3 (optional)
- [ ] Configure GA4, Meta Pixel, Hotjar IDs (optional)
- [ ] Test form submission end-to-end
- [ ] Update footer contact details (phone, email, address)
- [ ] Point Google Ads to `/wealden-landing` URL
- [ ] Set up lead notification workflow (email → CRM)

## 🚀 Next Steps

1. **Local Testing:**
   ```bash
   # Terminal 1: Start API
   cd api && pnpm dev
   
   # Terminal 2: Start Web
   cd web && pnpm dev
   
   # Visit http://localhost:3000/wealden-landing
   ```

2. **Deploy to Production:**
   ```bash
   git add -A
   git commit -m "feat: add wealden landing page with lead capture"
   git push origin main
   ```

3. **Verify in Production:**
   - Visit production URL: `https://your-domain.com/wealden-landing`
   - Submit test lead
   - Check database for new `LandingLead` record
   - Confirm email notification received

## 📞 Support

For issues or questions:
- Check logs: `pnpm --filter api logs` or Render dashboard
- Database queries: `pnpm prisma studio`
- Email test: Use [Mailtrap](https://mailtrap.io) for SMTP testing

---

**Last Updated:** November 7, 2025
**Status:** ✅ Ready for local testing, ⏳ Pending production database migration
