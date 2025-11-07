# Multi-Tenant Landing Page System - Onboarding Guide

## 🚀 Add a New Tenant in Under 60 Seconds

This system allows you to create high-conversion, personalized landing pages for new tenants with minimal manual effort.

---

## Quick Start

### Step 1: Create Tenant JSON (30 seconds)

Create `/web/src/data/tenants/[slug].json`:

```json
{
  "name": "Your Business Name",
  "slug": "your-slug",
  "phone": "01234 567890",
  "email": "contact@yourbusiness.com",
  "address": "City, Country",
  "homeUrl": "https://yourbusiness.com",
  "logo": "/images/your-slug/logo.png",
  "brand": {
    "primary": "#18332F",
    "accent": "#C9A14A"
  },
  "gallery": [],
  "reviews": [
    {
      "text": "Exceptional service!",
      "author": "John Smith",
      "location": "Kent",
      "stars": 5
    }
  ],
  "serviceAreas": ["Kent", "Sussex", "Surrey"],
  "priceAnchor": {
    "fromText": "From £850 per window",
    "rangeText": "Typical projects: £3,500 - £15,000"
  },
  "guarantees": {
    "bullets": [
      "50-year anti-rot guarantee",
      "10-year installation warranty",
      "Price match promise",
      "Full insurance coverage"
    ],
    "riskReversal": "No deposit required. Pay only when 100% satisfied."
  },
  "urgencyBanner": {
    "text": "Book this month and save 15%",
    "sub": "Limited slots available"
  },
  "leadMagnet": {
    "title": "Download Our Free Buyer's Guide",
    "cta": "Get Free Guide",
    "url": "/brochure.pdf"
  }
}
```

**Fields Explained:**

- **Required**: `name`, `slug`, `gallery`, `reviews`
- **Optional but Recommended**: `phone`, `email`, `homeUrl` (for enrichment), `brand`, `serviceAreas`, `priceAnchor`, `guarantees`, `urgencyBanner`, `leadMagnet`
- **Auto-populated**: If you provide `homeUrl`, the system will automatically fetch:
  - OG image (added to gallery)
  - Site name (fallback for `name`)
  - Theme color (fallback for `brand.primary`)

---

### Step 2: Import Images (15 seconds - optional)

Two options:

#### Option A: Automated Import (Recommended)
1. Go to **Settings > Integrations > Tenant Image Import**
2. Enter:
   - **Tenant Slug**: `your-slug`
   - **Website URL**: `https://yourbusiness.com`
   - **Max Images**: `20`
3. Click **Import Images**
4. System will:
   - Scrape website for images
   - Filter by resolution (≥800px)
   - Optimize (WebP conversion, responsive sizes)
   - Deduplicate (perceptual hashing)
   - Update `gallery` array automatically

#### Option B: Manual Images
Add image URLs to the `gallery` array in your JSON:
```json
"gallery": [
  {
    "src": "/images/your-slug/project1.jpg",
    "alt": "Beautiful windows",
    "caption": "Sash window restoration in Kent"
  },
  {
    "before": "/images/your-slug/before.jpg",
    "after": "/images/your-slug/after.jpg",
    "beforeAlt": "Old window",
    "afterAlt": "Restored window"
  }
]
```

---

### Step 3: Access Landing Page (5 seconds)

Your landing page is now live at:

**Primary URL**: `https://yourapp.com/tenant/your-slug/landing`

**Features Included:**

✅ Sticky header with CTAs (scroll-triggered at 80px)  
✅ Mobile dock (Call/WhatsApp/Quote buttons)  
✅ Hero section with A/B tested headline variants  
✅ Trust strip (FENSA, Trustpilot, PAS24, Accoya logos)  
✅ Reviews carousel with 5-star ratings  
✅ Guarantees section (4 bullets + risk reversal)  
✅ Price anchoring (from text + range text)  
✅ Urgency banner (time-limited offers)  
✅ Photo gallery with before/after sliders  
✅ Lead magnet (free download CTA)  
✅ Enhanced quote form (GDPR, file upload, callback toggle)  
✅ FAQ section with Schema.org markup  
✅ Exit-intent modal (captures abandoning visitors)  
✅ **Tracking**: GA4 (7 custom events) + Meta Pixel (3 events) + Hotjar  
✅ **SEO**: Schema.org markup (LocalBusiness, 3×Product, FAQPage)  
✅ **Performance**: Optimized images, CSS modules, lazy loading

---

## Advanced Features

### Auto-Enrichment from Website

The system automatically enriches tenant data by fetching Open Graph tags:

**Fetched Fields:**
- `og:image` → Prepended to gallery
- `og:site_name` → Fallback for `name`
- `theme-color` → Fallback for `brand.primary`
- `tel:` links → Auto-detected phone
- `mailto:` links → Auto-detected email

**Configuration:**
```typescript
// In /web/src/data/tenants/index.ts
const enrichment = await getTenantEnrichment(staticData.homeUrl);
const merged = mergeTenantData(staticData, enrichment, galleryOverride);
```

**Priority Order:**
1. **Gallery Override** (from image importer) - highest priority
2. **Static JSON** (manual data) - medium priority
3. **OG Enrichment** (scraped data) - lowest priority

---

### A/B Testing

The landing page includes built-in A/B testing:

**Current Test**: Hero headline variants
- **Variant A**: "Expert Craftsmanship Since 1960"
- **Variant B**: "Transform Your Home with [Brand]"

**Tracking:**
```javascript
track('experiment_impression', {
  experiment_id: 'hero_headline_test',
  variant_id: variant, // 'A' or 'B'
  tenant_slug: slug,
});
```

**Storage**: Variant stored in `localStorage` for persistence across sessions.

**Add New Tests:**
1. Define variants in page component
2. Add localStorage persistence
3. Track with `experiment_impression` event
4. Analyze in GA4 under Events > Conversions

---

### Tracking Events

**GA4 Events (7 total):**

| Event | Trigger | Parameters |
|-------|---------|------------|
| `view_item_list` | Gallery scroll into view | `item_list_id`, `tenant_slug` |
| `select_content` | CTA clicks, slider interactions | `content_type`, `item_id` |
| `click_contact_phone` | Phone link clicks | `tenant_slug`, `location` |
| `click_whatsapp` | WhatsApp link clicks | `tenant_slug`, `location` |
| `begin_checkout` | Form start | `tenant_slug`, `form_location` |
| `generate_lead` | Form submit, downloads | `method`, `lead_type`, `tenant_slug` |
| `experiment_impression` | A/B test exposure | `experiment_id`, `variant_id` |

**Meta Pixel Events (3 total):**
- `ViewContent` → `begin_checkout`
- `Lead` → `generate_lead`
- `Contact` → `click_contact_phone`, `click_whatsapp`

**Hotjar:** Automatically tracks all user interactions (heatmaps, recordings, surveys).

---

### Schema.org Markup

**Included Schemas:**

1. **LocalBusiness** (1×)
   - Name, phone, email, address
   - Service areas
   - Aggregate rating (from reviews)

2. **Product** (3×)
   - Sash Windows
   - Casement Windows
   - Front Doors
   - Each with brand, pricing

3. **FAQPage** (1×)
   - 4 pre-populated Q&As
   - Customizable per tenant

**Validation**: Test at https://search.google.com/test/rich-results

---

## Customization

### Brand Colors

Override in tenant JSON:
```json
"brand": {
  "primary": "#18332F", // Background colors, buttons
  "accent": "#C9A14A"   // Highlights, CTAs
}
```

CSS automatically applies via inline styles.

### Service Areas

Update for local SEO:
```json
"serviceAreas": [
  "Kent", "East Sussex", "West Sussex",
  "Surrey", "London", "Hampshire"
]
```

Displayed in:
- Hero subheadline (first 3 areas)
- Schema.org `areaServed`
- FAQ answer ("What areas do you cover?")

### Review Sources

The system supports both field names for flexibility:
```json
"reviews": [
  {
    "text": "Great service!", // or "quote"
    "author": "Jane Doe",      // optional
    "location": "Brighton",    // optional
    "stars": 5                 // optional (default: 5)
  }
]
```

---

## Troubleshooting

### Landing Page Not Loading

**Symptom**: "Tenant Not Found" error

**Solution:**
1. Check file exists: `/web/src/data/tenants/[slug].json`
2. Verify slug matches URL: `/tenant/[slug]/landing`
3. Restart Next.js dev server (dynamic imports cached)

### Gallery Images Not Displaying

**Causes:**
1. **Invalid paths**: Images must be in `/web/public/`
2. **Missing alt text**: Required for accessibility
3. **Wrong format**: Use `src` for single images, `before`/`after` for sliders

**Fix:**
```json
// Single image
{ "src": "/images/project.jpg", "alt": "Description" }

// Before/after slider
{
  "before": "/images/before.jpg",
  "after": "/images/after.jpg",
  "beforeAlt": "Before",
  "afterAlt": "After"
}
```

### Tracking Not Firing

**Checklist:**
1. Add GA4 tracking code to `/web/src/app/layout.tsx`:
   ```html
   <Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX" />
   <Script id="gtag-init">
     {`window.dataLayer = window.dataLayer || [];
       function gtag(){dataLayer.push(arguments);}
       gtag('js', new Date());
       gtag('config', 'G-XXXXXXXXXX');`}
   </Script>
   ```

2. Add Meta Pixel to layout:
   ```html
   <Script id="fb-pixel">
     {`!function(f,b,e,v,n,t,s)
       {...fbq initialization...}
       fbq('init', 'YOUR_PIXEL_ID');`}
   </Script>
   ```

3. Test in browser console:
   ```javascript
   window.gtag // Should be defined
   window.fbq  // Should be defined
   ```

### OG Enrichment Failing

**Common Issues:**
1. **Timeout**: Website takes >6s to respond → Graceful fallback to JSON data
2. **Missing tags**: Website lacks OG tags → System uses JSON data
3. **CORS errors**: Some sites block scraping → Use manual JSON data

**Test Enrichment:**
```bash
curl "http://localhost:3000/api/tenant-og?url=https://example.com"
```

---

## Performance Optimization

### Image Loading

**Automatic Optimizations:**
- Next.js Image component (lazy loading, responsive sizes)
- WebP conversion (if source is JPEG/PNG)
- Perceptual deduplication (via imghash)

**Manual Control:**
```json
"gallery": [
  {
    "src": "/images/photo.jpg",
    "width": 1600,  // Original width
    "height": 1200  // Original height
  }
]
```

Next.js generates:
- 640w, 750w, 828w, 1080w, 1200w, 1920w, 2048w, 3840w

### CSS Modules

All styles in `/web/src/app/tenant/[slug]/landing/page.module.css`:
- Scoped to component (no global conflicts)
- Tree-shaken (unused styles removed)
- Minified in production

### Tracking Scripts

Load tracking asynchronously:
```html
<Script src="..." strategy="lazyOnload" />
```

---

## Migration from Single-Tenant

### Before (Old System)
- `/web/src/app/wealden-landing/page.tsx` (518 lines)
- Hardcoded data
- No multi-tenancy

### After (New System)
- `/web/src/data/tenants/wealden.json` (89 lines)
- `/web/src/app/tenant/[slug]/landing/page.tsx` (reusable)
- Add tenants in <60s

### Backward Compatibility

Original route preserved via redirect:
```typescript
// /web/src/app/wealden-landing-new/page.tsx
export default function WealdenLandingAlias() {
  redirect('/tenant/wealden/landing');
}
```

---

## Deployment Checklist

Before going live:

- [ ] Create tenant JSON with all required fields
- [ ] Import/upload gallery images
- [ ] Add real trust logos (`/public/trust-*.png`)
- [ ] Upload lead magnet PDFs (`/public/brochure.pdf`)
- [ ] Configure GA4 tracking code
- [ ] Configure Meta Pixel ID
- [ ] Test form submission (integrate with CRM)
- [ ] Validate Schema.org markup
- [ ] Test on mobile devices
- [ ] Run Lighthouse audit (aim for >90 performance score)
- [ ] Set up A/B test in GA4 Experiments

---

## Support

**Issues?** Check:
1. Browser console for errors
2. Network tab for failed requests
3. Next.js terminal for build errors

**Questions?** See:
- `LANDING_PAGE_UPGRADE_SUMMARY.md` - Technical specification
- `COMPREHENSIVE_ML_REDESIGN.md` - ML feature integration
- `USER_MANUAL.md` - General system documentation

---

## Examples

### Example 1: Minimal Tenant

```json
{
  "name": "Quick Builders",
  "slug": "quick-builders",
  "homeUrl": "https://quickbuilders.com",
  "gallery": [],
  "reviews": []
}
```

**Result**: 
- Auto-enrichment pulls OG image, theme color
- Default guarantees, pricing, FAQs applied
- Landing page generated in <30s

### Example 2: Full Tenant

```json
{
  "name": "Premium Windows",
  "slug": "premium-windows",
  "phone": "020 1234 5678",
  "email": "info@premiumwindows.co.uk",
  "address": "London, UK",
  "homeUrl": "https://premiumwindows.co.uk",
  "logo": "/images/premium/logo.png",
  "brand": {
    "primary": "#1a2b3c",
    "accent": "#d4af37"
  },
  "gallery": [
    { "src": "/images/premium/project1.jpg", "alt": "Victorian sash restoration" },
    {
      "before": "/images/premium/before.jpg",
      "after": "/images/premium/after.jpg",
      "beforeAlt": "Dated windows",
      "afterAlt": "Modern upgrade",
      "caption": "Complete transformation in 3 days"
    }
  ],
  "reviews": [
    { "text": "Flawless installation!", "author": "Sarah J.", "location": "Chelsea", "stars": 5 },
    { "text": "Worth every penny.", "author": "Mark T.", "location": "Kensington", "stars": 5 },
    { "text": "Highly professional team.", "author": "Emma L.", "location": "Westminster", "stars": 5 }
  ],
  "serviceAreas": ["London", "Surrey", "Kent", "Essex", "Hertfordshire", "Berkshire"],
  "priceAnchor": {
    "fromText": "From £1,200 per window",
    "rangeText": "Most projects: £5,000 - £25,000"
  },
  "guarantees": {
    "bullets": [
      "Lifetime timber guarantee (Accoya wood)",
      "15-year installation warranty",
      "Full project insurance",
      "Conservation area approved"
    ],
    "riskReversal": "Try before you buy - we'll replace any window you're not 100% happy with, no questions asked."
  },
  "urgencyBanner": {
    "text": "Spring Sale: Save up to 20% on full-house projects",
    "sub": "Book your survey by March 31st"
  },
  "leadMagnet": {
    "title": "The Ultimate Guide to Heritage Windows",
    "cta": "Download Free Guide (PDF)",
    "url": "/premium-brochure.pdf"
  }
}
```

**Result**: 
- Fully customized landing page
- Brand-matched colors
- 3 reviews in carousel
- 6 service areas in SEO
- Custom urgency banner
- Premium lead magnet

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Maintainer**: SaaS CRM Team
