# SEO Marketplace Network Architecture

## Overview

Transform multi-tenant landing pages into an SEO powerhouse that builds aggregate domain authority while serving individual tenants.

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    joineryai.app                            │
│           (High Authority Root Domain)                       │
└────────────┬────────────────────────────────────────────────┘
             │
             │ ISR (Incremental Static Regeneration)
             │
         ┌───┴───────────────────────────────────────────┐
         │                                               │
         ▼                                               ▼
┌─────────────────────┐                    ┌─────────────────────┐
│ /[tenantSlug]/      │                    │ /[tenantSlug]/      │
│ [cityOrKeyword]     │                    │ [cityOrKeyword]     │
│                     │                    │                     │
│ Examples:           │                    │ Examples:           │
│ /wealden/kent       │                    │ /wealden/sash-      │
│ /wealden/east-      │                    │        windows      │
│    sussex           │                    │ /wealden/casement-  │
│ /wealden/brighton   │                    │        windows      │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                          │
           │ Internal Linking                         │
           └────────────┬─────────────────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │  Nearby Tenants  │
              │  Component       │
              │  (3 links each)  │
              └──────────────────┘
```

## URL Structure

### Pattern
```
/{tenantSlug}/{cityOrKeyword}
```

### Examples
```
/wealden-joinery/kent                    # Service area page
/wealden-joinery/sash-windows           # Keyword page
/wealden-joinery/casement-windows       # Keyword page
/heritage-windows/east-sussex           # Service area page
/heritage-windows/front-doors           # Keyword page
```

### Generation Strategy
For each tenant:
1. **Service Area Pages:** Create page for each area in `tenant.serviceAreas[]`
2. **Keyword Pages:** Create page for top 10 keywords in `tenant.keywords[]`
3. **Base Page:** Primary landing page (first service area)

Result: **15-30 unique URLs per tenant**

## SEO Data Builder

**File:** `web/src/lib/seo-builder.ts`

### Key Functions

#### `buildSeoData(tenant, location, locationSlug)`
Generates comprehensive SEO metadata:

**Inputs:**
- `tenant`: Tenant object with name, slug, serviceAreas, keywords, reviews
- `location`: Display name ("Kent", "Sash Windows")
- `locationSlug`: URL-safe slug ("kent", "sash-windows")

**Outputs:**
```typescript
{
  title: "Sash Windows in Kent | Wealden Joinery",
  description: "Looking for sash windows? Wealden Joinery provides expert...",
  keywords: ["Sash Windows", "Kent", "Joinery", ...],
  canonical: "https://joineryai.app/wealden-joinery/sash-windows",
  schema: { /* JSON-LD structured data */ }
}
```

### Schema.org Structured Data

Injects multiple schema types on each page:

1. **LocalBusiness** - NAP, reviews, service areas, offers
2. **WebPage** - Breadcrumbs, language, description
3. **Product** - Sash windows, casement windows, doors with pricing
4. **FAQPage** - 4 relevant Q&As with rich snippets

**Benefits:**
- Rich snippets in Google search results
- Star ratings visible in SERPs
- FAQ accordion in search results
- Enhanced CTR (click-through rate)

## Dynamic Sitemap

**File:** `web/src/app/sitemap.ts`

### Features
- Queries all published tenants via API
- Generates URLs for all service area + keyword combinations
- Sets appropriate priorities:
  - Root: 1.0
  - Base tenant pages: 0.9
  - Service area pages: 0.8
  - Keyword pages: 0.7
- Includes `lastModified` timestamps for each URL
- Revalidates daily via ISR

### XML Output Structure
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://joineryai.app/</loc>
    <lastmod>2025-01-15</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://joineryai.app/wealden-joinery/kent</loc>
    <lastmod>2025-01-10</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <!-- ... hundreds more URLs ... -->
</urlset>
```

### Submission
Sitemap automatically available at:
```
https://joineryai.app/sitemap.xml
```

Submit to:
- Google Search Console: https://search.google.com/search-console
- Bing Webmaster Tools: https://www.bing.com/webmasters

## Internal Linking Network

**Component:** `web/src/components/NearbyTenants.tsx`

### Strategy
Each landing page shows 3 nearby tenants in the same service area.

**Benefits:**
1. **Link Juice Distribution:** Pages pass authority to each other
2. **User Experience:** Visitors can compare multiple options
3. **Crawl Depth:** Search engines discover all pages faster
4. **Dwell Time:** Users explore more of the site

### Example Output
```
┌────────────────────────────────────────┐
│  More Joiners Near Kent                │
├────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐   │
│  │ Heritage     │  │ Classic      │   │
│  │ Windows      │  │ Joinery      │   │
│  │ ⭐⭐⭐⭐⭐ 4.8  │  │ ⭐⭐⭐⭐⭐ 4.9  │   │
│  │ View Profile →│  │ View Profile →│  │
│  └──────────────┘  └──────────────┘   │
└────────────────────────────────────────┘
```

### API Endpoint
**GET** `/api/landing-tenants/nearby?location=Kent&exclude=<id>&limit=3`

Returns tenants with:
- Same service area
- Published landing pages
- Aggregate ratings
- Sorted by rating or recency

## Aggregate Reviews System

**API:** `api/src/routes/aggregate-reviews.ts`

### Endpoints

#### GET `/api/aggregate-reviews`
Computes site-wide aggregate rating across all tenants.

**Response:**
```json
{
  "averageRating": 4.7,
  "totalReviews": 324,
  "ratingDistribution": {
    "5": 220,
    "4": 80,
    "3": 15,
    "2": 5,
    "1": 4
  },
  "schema": {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Joinery AI",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.7",
      "reviewCount": 324
    }
  }
}
```

#### GET `/api/aggregate-reviews/:tenantId`
Returns tenant-specific rating data.

### Benefits
- **Trust Signals:** Show "4.7★ from 324 reviews" on homepage
- **Rich Snippets:** Star ratings in Google search results
- **Organization Schema:** Builds domain-level trust

## Powered-By Backlink System

**File:** `web/src/lib/backlink-generator.ts`

### Strategy
Encourage tenants to link back to their Joinery AI profile from their own websites.

**Benefits:**
1. **External Backlinks:** High-quality dofollow links
2. **Referral Traffic:** Drives qualified leads
3. **Domain Authority:** Increases DR/DA scores
4. **Brand Awareness:** Positions Joinery AI as industry leader

### Snippet Generation

#### HTML Badge (Styled)
```html
<a href="https://joineryai.app/wealden-joinery" rel="dofollow">
  <div style="/* badge styles */">
    See Wealden Joinery on Joinery AI
  </div>
</a>
```

#### Markdown (for blogs)
```markdown
[See Wealden Joinery on Joinery AI](https://joineryai.app/wealden-joinery)
```

#### Plain Text (for email signatures)
```
Wealden Joinery - See our profile on Joinery AI: https://joineryai.app/wealden-joinery
```

### Dashboard Integration
Add "Copy Link Snippet" button to tenant dashboard:

**UI Location:** `/admin/tenants/[id]/seo-tools`

**Features:**
- One-click copy to clipboard
- Preview of rendered snippet
- Track which tenants have added backlinks
- Measure referral traffic from each backlink

## Search Console & GA4 Integration

### Setup

#### 1. Google Search Console
```bash
# Add property
https://search.google.com/search-console
→ Add property: "joineryai.app"
→ Verify via DNS TXT record

# Submit sitemap
→ Sitemaps → Add new sitemap
→ URL: https://joineryai.app/sitemap.xml
```

#### 2. Google Analytics 4
```bash
# Create property
https://analytics.google.com
→ Admin → Create Property
→ Property name: "Joinery AI Marketplace"
→ Install tracking code in web/src/app/layout.tsx
```

### Tracking Implementation

**File:** `web/src/app/layout.tsx`

```tsx
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXX', {
    page_path: window.location.pathname,
    tenant_slug: '{tenantSlug}',
    location: '{location}'
  });
</script>
```

### Custom Events

Track key user actions:
```typescript
gtag('event', 'view_listing', {
  tenant_slug: 'wealden-joinery',
  location: 'kent',
  keyword: 'sash-windows'
});

gtag('event', 'generate_lead', {
  tenant_slug: 'wealden-joinery',
  lead_type: 'quote_request',
  value: 100 // estimated lead value
});
```

### Weekly Reporting Script

**Goal:** Log impressions, CTR, conversions per tenant weekly.

**Implementation:**
```typescript
// api/scripts/weekly_seo_report.ts
import { google } from 'googleapis';

async function generateWeeklyReport() {
  const webmasters = await getSearchConsoleClient();
  
  // Fetch data for each tenant
  for (const tenant of tenants) {
    const data = await webmasters.searchanalytics.query({
      siteUrl: 'sc-domain:joineryai.app',
      requestBody: {
        startDate: '2025-01-01',
        endDate: '2025-01-07',
        dimensions: ['page'],
        dimensionFilterGroups: [{
          filters: [{ 
            dimension: 'page',
            operator: 'contains',
            expression: tenant.slug
          }]
        }]
      }
    });
    
    // Store in database
    await prisma.seoMetrics.create({
      data: {
        tenantId: tenant.id,
        weekStartDate: '2025-01-01',
        impressions: data.impressions,
        clicks: data.clicks,
        ctr: data.ctr,
        position: data.position
      }
    });
  }
}
```

Add to `package.json`:
```json
{
  "scripts": {
    "seo:report": "tsx scripts/weekly_seo_report.ts"
  }
}
```

Schedule via cron: Every Monday at 9 AM

## ML SEO Tuning Script

**File:** `api/scripts/seo_tune.ts`

### Purpose
Automatically optimize tenant keywords and meta titles based on Search Console data.

### Process

1. **Fetch Top Queries** (last 30 days)
   - Filter by tenant slug
   - Return top 50 queries with clicks, impressions, CTR, position

2. **Identify Opportunities**
   - **Good queries:** Position ≤ 20, clicks ≥ 5 (already ranking well)
   - **Emerging queries:** Position 21-50, impressions ≥ 100 (potential to improve)

3. **Update Tenant Data**
   - Add new keywords to `tenant.keywords[]`
   - Limit to top 50 keywords
   - Create draft landing page content with optimized headline

4. **Generate Optimized Headlines**
   ```
   Original: "Wealden Joinery - Expert Craftsmanship Since 1960"
   Optimized: "Sash Windows in Kent | Wealden Joinery | Free Quote"
   ```

### Usage

```bash
# Analyze all tenants
pnpm seo:tune

# Analyze single tenant
pnpm seo:tune --tenant-id <id>

# Dry run (preview changes)
pnpm seo:tune --dry-run
```

### Example Output

```
🔍 SEO Tuning from Search Console Data
========================================

📈 Analyzing: Wealden Joinery
────────────────────────────────────────
   📊 SEO Updates for Wealden Joinery:
      - Added 12 new keywords
      - Top query: "sash windows kent" (Position: 8)
   ✅ Created draft with optimized headline

📊 Summary
========================================
Total tenants: 15
✅ Updated: 12
⊘ Skipped: 3

✅ SEO tuning complete!
```

### Environment Variables Required

```bash
# Google Service Account for Search Console API
GOOGLE_SERVICE_ACCOUNT_EMAIL=seo-bot@joineryai.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Search Console property URL
SEARCH_CONSOLE_SITE_URL=sc-domain:joineryai.app
```

### Schedule
Run weekly after `keywords:sync`:
- Monday 2:00 AM: `pnpm keywords:sync` (Google Ads data)
- Monday 3:00 AM: `pnpm seo:tune` (Search Console data)

## ISR (Incremental Static Regeneration)

### Configuration

**File:** `web/src/app/[tenantSlug]/[cityOrKeyword]/page.tsx`

```typescript
// Revalidate pages every hour
export const revalidate = 3600;

// Force static rendering
export const dynamic = 'force-static';

// Allow new params at runtime
export const dynamicParams = true;
```

### Benefits
1. **Fast Load Times:** Pre-rendered HTML served instantly
2. **Fresh Content:** Pages regenerate hourly automatically
3. **Scalability:** Handles thousands of pages efficiently
4. **SEO-Friendly:** Fully crawlable static HTML

### Cache Strategy
```
First Request → Generate static HTML → Cache for 1 hour
Next Request (< 1 hour) → Serve cached HTML (instant)
Next Request (> 1 hour) → Serve cached HTML + trigger regeneration in background
Background → Regenerate HTML → Update cache
```

## Performance Targets

### PageSpeed Insights Goals
- **Mobile:** ≥ 90
- **Desktop:** ≥ 95

### Core Web Vitals
- **LCP (Largest Contentful Paint):** < 2.5s
- **FID (First Input Delay):** < 100ms
- **CLS (Cumulative Layout Shift):** < 0.1

### Optimization Techniques
1. **Image Optimization:** Next.js Image component with WebP
2. **Code Splitting:** Dynamic imports for heavy components
3. **CSS Inline:** Critical CSS inlined in `<head>`
4. **Font Optimization:** next/font with font-display: swap
5. **Lazy Loading:** Defer non-critical content
6. **CDN:** Serve static assets from CDN (Vercel/Cloudflare)

## Duplicate Content Prevention

### Canonical URLs
Every page sets canonical URL:
```html
<link rel="canonical" href="https://joineryai.app/wealden-joinery/kent" />
```

### Unique Content Strategy
1. **Dynamic Headlines:** Include location/keyword in H1
2. **Unique Meta Descriptions:** Template with location/keyword variables
3. **Service Area Lists:** Show relevant nearby locations
4. **FAQ Variations:** Customize FAQ answers per location

### Example Variations

**Kent Page:**
```html
<h1>Wealden Joinery - Joinery Services in Kent</h1>
<meta name="description" content="Wealden Joinery provides professional joinery services in Kent. Sash windows, casement windows, doors & more.">
```

**Sash Windows Page:**
```html
<h1>Sash Windows in Kent | Wealden Joinery</h1>
<meta name="description" content="Looking for sash windows? Wealden Joinery provides expert sash windows services in Kent and surrounding areas.">
```

## Monitoring & Analytics

### KPIs to Track

#### Domain Level
- **Organic Traffic:** Monthly visitors from Google
- **Domain Rating (DR):** Ahrefs score (target: 40+)
- **Referring Domains:** Number of unique backlinks
- **Indexed Pages:** Total pages in Google index
- **Average Position:** Across all keywords

#### Tenant Level
- **Impressions:** Monthly search impressions
- **Clicks:** Monthly organic clicks
- **CTR:** Click-through rate
- **Average Position:** Per tenant
- **Conversions:** Leads generated from SEO

### Dashboard Mockup

```
┌─────────────────────────────────────────────────────────────┐
│  SEO Marketplace Dashboard                                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🌐 Domain Authority: 42 DR (+3 this month)                │
│  📊 Total Organic Traffic: 45,230 (+12%)                   │
│  📄 Indexed Pages: 487 / 520                               │
│  🔗 Referring Domains: 38 (+5)                             │
│                                                             │
│  Top Performing Pages:                                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Page                              | Clicks | Position│  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ /wealden/sash-windows             | 1,245  |  5.2   │  │
│  │ /heritage/kent                    |   890  |  8.1   │  │
│  │ /classic/casement-windows         |   756  | 12.3   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  Tenant Performance:                                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Tenant            | Impressions | Clicks | CTR      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Wealden Joinery   | 12,450      | 1,892  | 15.2%   │  │
│  │ Heritage Windows  |  8,920      | 1,203  | 13.5%   │  │
│  │ Classic Joinery   |  6,780      |   945  | 13.9%   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Deployment Checklist

### Phase 1: Foundation (Week 1)
- [x] Create `/[tenantSlug]/[cityOrKeyword]` dynamic route
- [x] Build `buildSeoData()` utility with Schema.org
- [x] Implement ISR with 1-hour revalidation
- [x] Create `sitemap.ts` generator
- [x] Deploy and verify sitemap.xml accessible

### Phase 2: Internal Linking (Week 2)
- [x] Create `NearbyTenants` component
- [x] Add `/api/landing-tenants/nearby` endpoint
- [x] Integrate internal linking on all pages
- [x] Verify link juice distribution

### Phase 3: Reviews & Backlinks (Week 3)
- [ ] Create `/api/aggregate-reviews` endpoint
- [ ] Add Organization schema to homepage
- [ ] Build backlink snippet generator
- [ ] Add "Copy Link Snippet" to tenant dashboard
- [ ] Send email campaign to tenants about backlinks

### Phase 4: Analytics Setup (Week 4)
- [ ] Setup Google Search Console
- [ ] Setup Google Analytics 4
- [ ] Implement custom event tracking
- [ ] Create weekly SEO report script
- [ ] Schedule cron jobs

### Phase 5: ML Tuning (Week 5)
- [ ] Create `seo_tune.ts` script
- [ ] Setup Google Service Account
- [ ] Test with dry-run mode
- [ ] Schedule weekly execution
- [ ] Monitor keyword updates

### Phase 6: Optimization (Week 6)
- [ ] Audit all pages with PageSpeed Insights
- [ ] Optimize images (WebP, lazy loading)
- [ ] Minify CSS/JS
- [ ] Setup CDN (Cloudflare/Vercel)
- [ ] Verify Core Web Vitals ≥ 90

### Phase 7: Monitoring (Ongoing)
- [ ] Submit sitemap to Search Console
- [ ] Monitor indexation rate
- [ ] Track DR/DA growth
- [ ] A/B test headlines
- [ ] Iterate based on Search Console data

## Success Metrics (6-Month Target)

### Domain Level
- **Domain Rating:** 30 → 45+
- **Organic Traffic:** 0 → 50,000/month
- **Indexed Pages:** 0 → 500+
- **Referring Domains:** 0 → 50+
- **Average Position:** N/A → Top 10 for 100+ keywords

### Tenant Level
- **Average CTR:** Baseline → 15%+
- **Leads per Tenant:** Baseline → 20+/month
- **Conversion Rate:** Baseline → 5%+

### Business Impact
- **Tenant Acquisition:** Higher close rate (show SEO value)
- **Tenant Retention:** Tenants stay longer (ROI proven)
- **Brand Authority:** Recognized as industry leader
- **Backlink Value:** £10,000+ in link juice (if purchased)

---

**Status:** ✅ Ready to Deploy  
**Priority:** High (Core Growth Strategy)  
**Timeline:** 6 weeks to full implementation  
**ROI:** 10x in 12 months (estimated)
