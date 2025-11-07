# Multi-Tenant Landing Page - Quick Reference

## 🚀 What Was Built

A complete **multi-tenant, high-conversion landing page system** with:
- ✅ Dynamic routing: `/tenant/[slug]/landing`
- ✅ JSON-based personalization (89-line config per tenant)
- ✅ Auto-enrichment from client websites (OG tags)
- ✅ Gallery override from image importer
- ✅ 15+ CRO features (A/B testing, exit-intent, lead magnets, etc.)
- ✅ Comprehensive tracking (GA4: 7 events, Meta Pixel: 3 events)
- ✅ SEO optimization (Schema.org: 4 types)
- ✅ Full accessibility (ARIA, keyboard nav)

---

## 📁 Key Files

### Data Layer
- **`/web/src/data/tenants/wealden.json`** - Sample tenant config (89 lines)
- **`/web/src/data/tenants/index.ts`** - Type definitions + helper functions (155 lines)

### API
- **`/web/src/app/api/tenant-og/route.ts`** - OG tag enrichment endpoint (86 lines)

### Components
- **`/web/src/app/tenant/[slug]/landing/page.tsx`** - Main landing page (543 lines)
- **`/web/src/app/tenant/[slug]/landing/page.module.css`** - Styles (565 lines)
- **`/web/src/components/BeforeAfter.tsx`** - Image comparison slider (147 lines)
- **`/web/src/components/StickyBar.tsx`** - Scroll-triggered header (82 lines)
- **`/web/src/components/MobileDock.tsx`** - Mobile CTA bar (62 lines)

### Alias Route
- **`/web/src/app/wealden-landing-new/page.tsx`** - Redirect to multi-tenant (11 lines)

### Documentation
- **`/TENANT_ONBOARDING_GUIDE.md`** - Step-by-step onboarding (<60s)
- **`/MULTI_TENANT_LANDING_SUMMARY.md`** - Implementation details

---

## 🎯 Add a New Tenant (60 seconds)

### Step 1: Create JSON (30s)
```bash
nano /web/src/data/tenants/your-slug.json
```

```json
{
  "name": "Your Business",
  "slug": "your-slug",
  "phone": "01234 567890",
  "email": "contact@yourbusiness.com",
  "homeUrl": "https://yourbusiness.com",
  "gallery": [],
  "reviews": [
    {"text": "Great service!", "author": "John", "stars": 5}
  ],
  "serviceAreas": ["Kent", "Sussex"],
  "priceAnchor": {"fromText": "From £850 per window"},
  "guarantees": {
    "bullets": ["50-year warranty", "Price match", "No deposit"]
  }
}
```

### Step 2: Import Images (15s - optional)
Go to **Settings > Integrations > Tenant Image Import**:
- Slug: `your-slug`
- URL: `https://yourbusiness.com`
- Click **Import**

### Step 3: Access Page (5s)
Visit: `http://localhost:3000/tenant/your-slug/landing`

---

## 🧪 Testing Checklist

### Local Development
```bash
cd web
pnpm dev
# Visit: http://localhost:3000/tenant/wealden/landing
```

### Build Test
```bash
cd web
npm run build
# Should see: ƒ /tenant/[slug]/landing (8.25 kB)
```

### Manual Testing
- [ ] Page loads without errors
- [ ] Hero displays with correct brand name
- [ ] Reviews carousel shows all reviews
- [ ] Gallery displays images (or placeholders)
- [ ] Form submits (check console for tracking events)
- [ ] Mobile responsive (test at 375px, 768px, 1200px)
- [ ] Exit-intent modal triggers on mouse leave
- [ ] All CTAs track events (check browser console)

### SEO Validation
- [ ] Schema.org: https://search.google.com/test/rich-results
- [ ] Meta tags: View source, check `<script type="application/ld+json">`
- [ ] Accessibility: Run Lighthouse audit (aim for >90)

---

## 📊 Tracking Events

### GA4 (7 events)
```javascript
// Track manually in browser console:
gtag('event', 'generate_lead', {
  method: 'quote_form',
  tenant_slug: 'wealden',
  lead_type: 'quote_request'
});
```

### Check Tracking
1. Open browser DevTools > Console
2. Click any CTA button
3. Should see: `gtag('event', ...)` calls

---

## 🐛 Common Issues

### "Tenant Not Found" Error
**Cause**: JSON file missing or incorrect slug

**Fix**:
```bash
# Check file exists
ls -la /web/src/data/tenants/your-slug.json

# Verify slug matches URL
grep '"slug"' /web/src/data/tenants/your-slug.json
```

### Images Not Displaying
**Cause**: Invalid paths or missing files

**Fix**:
```bash
# Ensure images are in public/
ls -la /web/public/images/your-slug/

# Update JSON with correct paths
"gallery": [
  {"src": "/images/your-slug/photo.jpg", "alt": "Description"}
]
```

### Build Errors
**Cause**: TypeScript errors

**Fix**:
```bash
# Check for errors
cd web
npx tsc --noEmit

# Restart dev server
pkill -f "pnpm dev"
pnpm dev
```

---

## 🔧 Customization

### Brand Colors
```json
"brand": {
  "primary": "#18332F",  // Hero background, buttons
  "accent": "#C9A14A"    // Highlights, CTAs
}
```

### A/B Test Variants
Edit `/web/src/app/tenant/[slug]/landing/page.tsx`:
```typescript
const heroHeadline = variant === 'A' 
  ? `${tenantData.name} - Expert Craftsmanship Since 1960`
  : `Transform Your Home with ${tenantData.name}`;
```

### FAQ Questions
Replace default questions in page.tsx (line ~429):
```typescript
[
  { q: 'Your question?', a: 'Your answer.' },
  { q: 'Another question?', a: 'Another answer.' },
]
```

---

## 📦 Deployment

### Before Production
1. **Replace placeholders**:
   ```bash
   # Add real assets
   cp ~/Downloads/logo.png /web/public/placeholder-logo.png
   cp ~/Downloads/trust-*.png /web/public/
   cp ~/Downloads/brochure.pdf /web/public/
   ```

2. **Add tracking codes** in `/web/src/app/layout.tsx`:
   ```tsx
   <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
   <Script id="fb-pixel">...</Script>
   ```

3. **Test on staging**:
   ```bash
   npm run build
   npm run start
   ```

### Deploy to Production
```bash
# Render, Vercel, or your platform
git push origin main
```

---

## 📞 Support

**Documentation**:
- Full guide: `/TENANT_ONBOARDING_GUIDE.md`
- Implementation: `/MULTI_TENANT_LANDING_SUMMARY.md`

**Debugging**:
- Check browser console for errors
- Check Network tab for failed API calls
- Check Next.js terminal for build errors

**Questions?**
- See existing docs above
- Review `/web/src/app/tenant/[slug]/landing/page.tsx` for implementation details

---

## ✅ Status

**Build**: ✅ Passing (no TypeScript errors)  
**Routes**: ✅ `/tenant/[slug]/landing` registered  
**Components**: ✅ BeforeAfter, StickyBar, MobileDock ready  
**Tracking**: ✅ GA4 (7 events) + Meta Pixel (3 events)  
**SEO**: ✅ Schema.org (LocalBusiness, Product×3, FAQPage)  
**Documentation**: ✅ Complete (onboarding + implementation)  

**Next**: Manual testing + add tracking codes + replace placeholder assets

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Time to Add Tenant**: <60 seconds  
**Lines of Code**: ~2,000 (components + docs)
