# Google Ads Keyword Optimization System

## Overview

Automated keyword learning loop that syncs Google Ads performance data with landing pages to continuously optimize SEO and ad campaigns for each tenant's locality.

## Architecture

```
┌─────────────────┐
│  Google Ads API │
│   (Keyword Data)│
└────────┬────────┘
         │
         │ Weekly Cron Job
         │ (update_keywords_from_ads.ts)
         │
         ▼
┌─────────────────────────────┐
│ KeywordPerformance Table    │
│ - impressions, clicks, CTR  │
│ - conversions, CPL          │
│ - quality score             │
│ - isUnderperforming flag    │
└────────┬────────────────────┘
         │
         │ AdsOptimizer
         │ (analyzes top/underperformers)
         │
         ▼
┌─────────────────────────────┐
│ KeywordSuggestion Table     │
│ - headline variations       │
│ - subhead variations        │
│ - meta title/description    │
│ - status (pending/approved) │
└────────┬────────────────────┘
         │
         │ Admin Approval
         │
         ▼
┌─────────────────────────────┐
│ LandingTenantContent Table  │
│ - headline, subhead updated │
│ - published to live site    │
└────────┬────────────────────┘
         │
         │ Dynamic Rendering
         │
         ▼
┌─────────────────────────────┐
│ Landing Page                │
│ - ?kw=Sash+Windows         │
│ - {keyword} placeholders   │
│ - Schema.org areaServed    │
└─────────────────────────────┘
```

## Database Schema

### Extended Tenant Model
```prisma
model Tenant {
  keywords             String[]   @default([])      // Top 50 keywords from Google Ads
  serviceAreas         String[]   @default([])      // ["Kent", "East Sussex", "West Sussex"]
  homeUrl              String?                      // Original website URL
  googleAdsCustomerId  String?                      // Google Ads account ID
  googleAdsRefreshToken String?                     // OAuth refresh token
  targetCPL            Decimal?   @default(50)      // Target cost per lead (£)
  
  keywordPerformance   KeywordPerformance[]
  keywordSuggestions   KeywordSuggestion[]
}
```

### KeywordPerformance Model
```prisma
model KeywordPerformance {
  id              String   @id @default(cuid())
  tenantId        String
  keyword         String
  weekStartDate   DateTime                         // Monday of the week
  
  impressions     Int      @default(0)
  clicks          Int      @default(0)
  conversions     Float    @default(0)
  cost            Decimal  @default(0)             // In £
  
  ctr             Decimal  @default(0)             // Click-through rate (%)
  conversionRate  Decimal  @default(0)             // Conversion rate (%)
  cpl             Decimal?                         // Cost per lead (£)
  
  qualityScore    Int?                             // Google Ads Quality Score (1-10)
  isUnderperforming Boolean @default(false)        // CTR < 1% OR CPL > targetCPL
  
  @@unique([tenantId, keyword, weekStartDate])
  @@index([tenantId, isUnderperforming])
}
```

### KeywordSuggestion Model
```prisma
model KeywordSuggestion {
  id             String   @id @default(cuid())
  tenantId       String
  keyword        String
  suggestedFor   String                            // "headline", "subhead", "meta_title", "meta_description"
  
  oldText        String?                           // Current content
  newText        String                            // Suggested replacement
  reason         String?                           // Why this suggestion was made
  conversionRate Decimal  @default(0)             // Conversion rate of keyword (for sorting)
  
  status         String   @default("pending")      // "pending", "approved", "rejected", "applied"
  appliedAt      DateTime?
  
  @@index([tenantId, status])
}
```

## API Routes

### GET `/keywords/:tenantId/report`
Get comprehensive optimization report with:
- Top 10 performing keywords
- Underperforming keywords
- Recent suggestions (pending/approved)

**Response:**
```json
{
  "topKeywords": [
    {
      "keyword": "Sash Windows",
      "impressions": 1250,
      "clicks": 45,
      "conversions": 3.5,
      "ctr": "3.60",
      "cpl": "42.50",
      "qualityScore": 8
    }
  ],
  "underperforming": [
    {
      "keyword": "Cheap Windows",
      "ctr": "0.5",
      "cpl": "85.00",
      "reason": "Low CTR and high CPL"
    }
  ],
  "suggestions": [
    {
      "keyword": "Sash Windows",
      "suggestedFor": "headline",
      "newText": "Sash Windows Specialists in Kent | Wealden Joinery",
      "conversionRate": "7.78",
      "status": "pending"
    }
  ]
}
```

### GET `/keywords/:tenantId/suggestions?status=pending`
List keyword suggestions with optional filtering.

### PATCH `/keywords/:tenantId/suggestions/:id/approve`
Approve a suggestion (changes status to `approved`).

### PATCH `/keywords/:tenantId/suggestions/:id/reject`
Reject a suggestion (changes status to `rejected`).

### POST `/keywords/:tenantId/apply`
Apply all approved suggestions to `LandingTenantContent` table.

**Response:**
```json
{
  "success": true,
  "appliedCount": 4,
  "updatedContent": {
    "headline": "Sash Windows Specialists in Kent | Wealden Joinery",
    "subhead": "Expert sash windows for homes and businesses in Kent, East Sussex, West Sussex"
  }
}
```

### GET `/keywords/:tenantId/performance?limit=50&underperformingOnly=false`
Get raw keyword performance data.

### POST `/keywords/:tenantId/sync`
Manually trigger Google Ads sync (fetches latest data and generates suggestions).

## Cron Script

**File:** `api/scripts/update_keywords_from_ads.ts`

**Schedule:** Weekly (every Monday at 2 AM)

**Usage:**
```bash
# Sync all tenants with Google Ads configured
pnpm keywords:sync

# Sync single tenant
pnpm keywords:sync --tenant-id <id>
```

**What it does:**
1. Fetches all tenants with `googleAdsCustomerId` and `googleAdsRefreshToken`
2. For each tenant:
   - Calls `GoogleAdsClient.updateTenantKeywordPerformance()` to fetch last 7 days from Ads API
   - Upserts `KeywordPerformance` records with metrics
   - Calculates CTR, CPL, conversionRate
   - Flags underperformers (CTR < 1% OR CPL > targetCPL)
   - Updates `tenant.keywords` with top 50 keywords
   - Calls `AdsOptimizer.generateOptimizationSuggestions()` to create content variations
   - Saves suggestions to `KeywordSuggestion` table
3. Logs summary report

## Landing Page Integration

**File:** `web/src/app/tenant/[slug]/landing/page.tsx`

### Query Parameter Handling

URL structure:
```
https://app.com/tenant/wealden-joinery/landing?kw=Sash+Windows
```

Dynamic content:
```tsx
// Extract keyword from query param
const keyword = searchParams.get('kw') ? decodeURIComponent(searchParams.get('kw')!) : null;

// Generate keyword-optimized headline
const finalHeadline = keyword 
  ? `${keyword} Specialists in ${tenantData.serviceAreas[0]} | ${tenantData.name}`
  : heroHeadline; // fallback to A/B test variant

// Generate keyword-optimized subheadline
const finalSubheadline = keyword
  ? `Expert ${keyword.toLowerCase()} for homes and businesses in ${tenantData.serviceAreas.join(', ')}`
  : `Bespoke timber windows and doors for ${tenantData.serviceAreas.join(', ')}`;
```

### Meta Tags
```tsx
<head>
  <title>
    {keyword 
      ? `${keyword} in ${serviceAreas[0]} | ${tenantName}` 
      : `${tenantName} - Expert Craftsmanship`}
  </title>
  <meta name="description" content={
    keyword 
      ? `Looking for ${keyword}? ${tenantName} provides expert ${keyword} services in ${serviceAreas.join(', ')}. Get a free quote today!`
      : `${tenantName} provides bespoke timber windows and doors.`
  } />
</head>
```

### Schema.org Structured Data
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Wealden Joinery",
  "areaServed": [
    { "@type": "City", "name": "Kent" },
    { "@type": "City", "name": "East Sussex" },
    { "@type": "City", "name": "West Sussex" }
  ]
}
```

### Google Analytics Tracking
```tsx
track('experiment_impression', {
  experiment_id: 'hero_headline_test',
  variant_id: variant,
  tenant_slug: slug,
  keyword: keyword || 'organic', // Track keyword source
});
```

## Google Ads Setup

### Prerequisites

1. **Google Ads Account**
   - Create ads account at https://ads.google.com
   - Link to Google Analytics for conversion tracking

2. **Google Cloud Project**
   - Create project at https://console.cloud.google.com
   - Enable Google Ads API
   - Create OAuth 2.0 credentials

3. **Developer Token**
   - Apply for developer token in Google Ads Manager Account
   - Token required for API access

### Environment Variables

```bash
# Google Ads API Configuration
GOOGLE_ADS_CLIENT_ID=123456789-abc.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=GOCSPX-AbCdEfGhIjKlMnOpQrStUvWx
GOOGLE_ADS_DEVELOPER_TOKEN=ABcdeFGHijKLmNOpqrs

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
```

### Per-Tenant Configuration

Each tenant needs:

1. **Google Ads Customer ID**
   - 10-digit account ID (e.g., `123-456-7890`)
   - Store in `tenant.googleAdsCustomerId`

2. **OAuth Refresh Token**
   - Generate via OAuth flow
   - Store in `tenant.googleAdsRefreshToken`

3. **Target CPL** (optional)
   - Target cost per lead in £
   - Store in `tenant.targetCPL` (default: £50)

4. **Service Areas**
   - Geographic targeting areas
   - Store in `tenant.serviceAreas` (e.g., `["Kent", "East Sussex"]`)

### Google Ads → Analytics Conversion Import

To track conversions from GA4 → Google Ads:

1. **Link Accounts:**
   - In Google Ads: Tools → Linked accounts → Google Analytics 4
   - Link the GA4 property

2. **Import Conversions:**
   - In Google Ads: Tools → Conversions
   - Click "+ New conversion action" → Import
   - Select "Google Analytics 4 properties"
   - Choose events to import (e.g., `generate_lead`, `begin_checkout`)

3. **Configure Events:**
   - Ensure landing page tracks events with `track()` helper
   - Events automatically flow to GA4 → Google Ads

4. **Wait for Data:**
   - Conversions appear in Ads within 24-48 hours
   - Quality Score updates within 2-3 weeks

## Optimization Workflow

### 1. Weekly Sync (Automated)
- Cron job runs every Monday
- Fetches last 7 days of keyword performance from Google Ads
- Flags underperforming keywords (CTR < 1% OR CPL > targetCPL)
- Generates 4 suggestions per top keyword (headline, subhead, meta_title, meta_description)
- Saves suggestions with `status='pending'`

### 2. Admin Review (Manual)
- Admin logs into CRM
- Navigates to "SEO & Keywords" tab for tenant
- Reviews suggestions:
  - **Green:** High-converting keywords (CTR ≥ 2%, conversions > 0)
  - **Yellow:** Average performance
  - **Red:** Underperforming (flagged for pause/optimization)
- Clicks "Approve" on good suggestions
- Clicks "Reject" on bad suggestions

### 3. Apply to Landing Page (Manual)
- Admin clicks "Apply Top Performers to Landing Page" button
- System calls `POST /keywords/:tenantId/apply`
- Updates `LandingTenantContent.headline` and `.subhead` with approved suggestions
- Marks suggestions as `status='applied'` with `appliedAt` timestamp
- Changes publish immediately to live site

### 4. Monitor Quality Score (Automated)
- Google Ads Quality Score tracked in `KeywordPerformance.qualityScore`
- Expected improvement within 2-3 weeks after applying suggestions
- Admin dashboard shows trend over time

## Business Logic

### Underperforming Keyword Criteria
A keyword is flagged as underperforming if:
- **CTR < 1%** (low engagement), OR
- **CPL > targetCPL** (too expensive per lead)

### Top Keyword Criteria
A keyword qualifies for suggestions if:
- **CTR ≥ 2%** (good engagement), AND
- **Conversions > 0** (proven to convert), AND
- **Minimum 20 clicks** (statistically significant)

### Content Generation Templates

**Headlines:**
1. `{keyword} Specialists in {area} | {tenant}`
2. `Expert {keyword} Services - {tenant}`
3. `{area}'s Trusted {keyword} Company | {tenant}`
4. `Premium {keyword} in {area} - {tenant}`
5. `{tenant} | Professional {keyword} Services`

**Subheads:**
1. `Expert {keyword} for homes and businesses in {areas}`
2. `Premium {keyword} covering {areas}`
3. `{area} based {keyword} specialists serving {areas}`
4. `Transform your property with professional {keyword}`

**Meta Titles:**
1. `{keyword} in {area} | {tenant} | Free Quote`
2. `{area} {keyword} Specialists - {tenant}`
3. `Professional {keyword} Services in {area}`

**Meta Descriptions:**
1. `Looking for {keyword}? {tenant} provides expert services in {areas}. Get a free quote today!`
2. `{tenant} specializes in {keyword} across {areas}. Quality craftsmanship, competitive prices.`
3. `Professional {keyword} in {areas}. Contact {tenant} for a free consultation and quote.`

## Testing

### Manual Test Flow

1. **Setup Test Tenant:**
```bash
cd api
pnpm prisma migrate dev --name test_keyword_optimization
```

2. **Add Test Data:**
```sql
UPDATE "Tenant"
SET 
  "googleAdsCustomerId" = '123-456-7890',
  "googleAdsRefreshToken" = 'test_refresh_token',
  "targetCPL" = 50,
  "serviceAreas" = ARRAY['Kent', 'East Sussex', 'West Sussex'],
  "keywords" = ARRAY['Sash Windows', 'Casement Windows', 'Front Doors']
WHERE "slug" = 'wealden-joinery';
```

3. **Run Manual Sync:**
```bash
cd api
pnpm keywords:sync --tenant-id <tenant-id>
```

4. **Check API Response:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/keywords/<tenant-id>/report
```

5. **Test Landing Page:**
```
http://localhost:3001/tenant/wealden-joinery/landing?kw=Sash+Windows
```

Expected:
- Headline: "Sash Windows Specialists in Kent | Wealden Joinery"
- Subhead: "Expert sash windows for homes and businesses in Kent, East Sussex, West Sussex"
- Meta title: "Sash Windows in Kent | Wealden Joinery"

### Unit Tests (Future)

```typescript
// api/tests/google-ads.test.ts
describe('GoogleAdsClient', () => {
  it('should fetch keyword performance from Ads API', async () => {
    const client = createGoogleAdsClient();
    const data = await client.fetchKeywordPerformance(
      '123-456-7890',
      'refresh_token',
      '2025-01-01',
      '2025-01-07'
    );
    expect(data).toHaveLength(10);
    expect(data[0]).toHaveProperty('keyword');
    expect(data[0]).toHaveProperty('impressions');
  });
});

// api/tests/ads-optimizer.test.ts
describe('AdsOptimizer', () => {
  it('should generate headline variations', () => {
    const optimizer = createAdsOptimizer();
    const variations = optimizer.generateHeadlineVariations(
      'Sash Windows',
      'Wealden Joinery',
      ['Kent', 'East Sussex']
    );
    expect(variations).toHaveLength(5);
    expect(variations[0]).toContain('Sash Windows');
    expect(variations[0]).toContain('Kent');
  });
});
```

## Deployment Checklist

### Database Migration
```bash
cd api
pnpm prisma migrate deploy
```

### Environment Variables (Production)
```bash
# Render.com → Dashboard → Environment
GOOGLE_ADS_CLIENT_ID=<from Google Cloud Console>
GOOGLE_ADS_CLIENT_SECRET=<from Google Cloud Console>
GOOGLE_ADS_DEVELOPER_TOKEN=<from Google Ads Manager>
DATABASE_URL=<production Postgres URL>
```

### Cron Job (Render.com)
1. Go to Render Dashboard
2. Select your API service
3. Click "Cron Jobs" tab
4. Add new cron job:
   - **Name:** Sync Google Ads Keywords
   - **Command:** `pnpm keywords:sync`
   - **Schedule:** `0 2 * * 1` (every Monday at 2 AM UTC)

Alternative (Node cron):
```typescript
// api/src/scheduler.ts
import cron from 'node-cron';
import { exec } from 'child_process';

// Every Monday at 2 AM
cron.schedule('0 2 * * 1', () => {
  console.log('Running keyword sync...');
  exec('tsx scripts/update_keywords_from_ads.ts', (error, stdout, stderr) => {
    if (error) console.error('Keyword sync failed:', error);
    else console.log('Keyword sync complete:', stdout);
  });
});
```

### Verify Production
1. Check cron logs in Render Dashboard
2. Query `KeywordPerformance` table:
```sql
SELECT * FROM "KeywordPerformance" 
WHERE "weekStartDate" >= NOW() - INTERVAL '7 days'
ORDER BY "conversionRate" DESC
LIMIT 10;
```
3. Test landing page: `https://app.com/tenant/wealden-joinery/landing?kw=Sash+Windows`

## Admin UI (Future Enhancement)

**File:** `web/src/app/admin/seo-keywords/[tenantId]/page.tsx`

**Features:**
- **Keyword Performance Table:**
  - Columns: Keyword, Impressions, Clicks, CTR, Conversions, CPL, Quality Score
  - Color coding: Green (top), Yellow (average), Red (underperforming)
  - Sort by any column
  - Filter: Show only underperforming

- **Suggestions Panel:**
  - Tabs: Pending (5) | Approved (2) | Applied (12) | Rejected (1)
  - Each suggestion card shows:
    - Keyword
    - Suggestion type (headline/subhead/meta)
    - Old text → New text
    - Conversion rate
    - Approve/Reject buttons

- **Actions:**
  - "Sync Google Ads Now" button (calls `POST /keywords/:tenantId/sync`)
  - "Apply Top Performers" button (calls `POST /keywords/:tenantId/apply`)
  - Preview modal showing before/after landing page

**Wireframe:**
```
┌─────────────────────────────────────────────────┐
│ SEO & Keywords - Wealden Joinery               │
├─────────────────────────────────────────────────┤
│ [Sync Google Ads Now] [Apply Top Performers]   │
├─────────────────────────────────────────────────┤
│                                                  │
│ Keyword Performance (Last 7 Days)               │
│ ┌──────────┬─────┬───────┬─────┬──────┬────┐  │
│ │ Keyword  │ Imp │ Clicks│ CTR │  CPL │ QS │  │
│ ├──────────┼─────┼───────┼─────┼──────┼────┤  │
│ │ Sash Win │1250 │  45   │3.6% │£42.50│ 8  │🟢│
│ │ Casement │ 890 │  28   │3.1% │£35.00│ 7  │🟢│
│ │ Cheap Win│ 450 │   2   │0.4% │£85.00│ 3  │🔴│
│ └──────────┴─────┴───────┴─────┴──────┴────┘  │
│                                                  │
│ Optimization Suggestions                        │
│ ┌─────────────────────────────────────────────┐│
│ │ 📝 Pending (5) | ✅ Approved (2) | Applied  ││
│ ├─────────────────────────────────────────────┤│
│ │ 🔑 Sash Windows (Conv: 7.8%)                ││
│ │ Type: Headline                               ││
│ │ Old: "Wealden Joinery - Expert Craftsmanship"│
│ │ New: "Sash Windows Specialists in Kent"     ││
│ │ [Approve] [Reject]                          ││
│ └─────────────────────────────────────────────┘│
└─────────────────────────────────────────────────┘
```

## Expected Results

### Week 1 (Initial Sync)
- 50+ keywords tracked in `KeywordPerformance` table
- 5-10 underperforming keywords flagged
- 20+ suggestions generated (4 per top keyword)
- Admin reviews and approves 10 suggestions

### Week 2-3 (Optimization Applied)
- Landing pages updated with approved headlines/subheads
- Google Ads clicks on optimized keywords increase
- CTR improves by 10-20%
- Quality Score begins to improve (shown in Google Ads UI)

### Week 4-6 (Quality Score Improvement)
- Quality Score increases from 6 → 8 for optimized keywords
- CPC decreases by 15-25% (better Quality Score = lower bids)
- CPL decreases to below targetCPL for most keywords
- Ad rank improves, leading to better ad positions

### Week 8+ (Continuous Optimization)
- Weekly cron job maintains performance
- New high-converting keywords discovered
- Underperforming keywords paused or improved
- Landing page content stays fresh and relevant
- Quality Score stabilizes at 7-9 for all keywords

## Troubleshooting

### Cron Job Not Running
**Check:**
```bash
# Render Dashboard → Logs → Filter by "keyword"
# Should see: "🔄 Google Ads Keyword Performance Update"
```

**Fix:**
- Verify cron schedule in Render Dashboard
- Check environment variables are set
- Run manually: `pnpm keywords:sync --tenant-id <id>`

### No Keywords Fetched
**Check:**
```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/keywords/<tenant-id>/performance
```

**Fix:**
- Verify `googleAdsCustomerId` is correct (10 digits, no dashes in DB)
- Verify `googleAdsRefreshToken` is valid (not expired)
- Check Google Ads API quota (50,000 operations/day)
- Run manual sync with `--tenant-id` flag to see error logs

### Landing Page Not Showing Keywords
**Check:**
```bash
# URL: /tenant/wealden-joinery/landing?kw=Sash+Windows
# View page source: <h1> should contain "Sash Windows"
```

**Fix:**
- Verify `kw` query param is URL-encoded (`%20` for spaces)
- Check `tenant.serviceAreas` is populated
- Inspect browser console for React errors

### Quality Score Not Improving
**Wait:**
- Google Ads needs 2-3 weeks to recalculate Quality Score
- Requires 100+ impressions per keyword for reliable score

**Check:**
- Verify conversions are flowing from GA4 → Google Ads
- Check landing page is fast (Core Web Vitals)
- Ensure ad copy matches landing page headline (relevance)

## Future Enhancements

### Phase 2: A/B Testing
- Create multiple headline variations per keyword
- Rotate variations weekly
- Track conversion rate per variation
- Auto-apply winning variation

### Phase 3: Automated Bidding
- Adjust keyword bids based on CPL performance
- Increase bids for high-converters (CPL < targetCPL)
- Decrease bids for underperformers (CPL > targetCPL)
- Pause keywords with CPL > 2x targetCPL

### Phase 4: Negative Keywords
- Track search terms with 0 conversions and high cost
- Auto-suggest negative keywords
- Admin approves, system adds to Google Ads campaign

### Phase 5: Competitor Analysis
- Scrape competitor landing pages
- Extract headlines, CTAs, guarantees
- Generate suggestions inspired by competitor tactics
- Show "Competitors are using..." insights in admin UI

## Support

For questions or issues:
- **Developer:** Check `/api/src/lib/google-ads.ts` and `/api/src/lib/ads-optimizer.ts` for business logic
- **Admin:** Review suggestions in "SEO & Keywords" tab before applying
- **Google Ads:** Consult Google Ads API documentation at https://developers.google.com/google-ads/api/docs/start

---

**Last Updated:** January 2025  
**Version:** 1.0.0  
**Status:** ✅ Production Ready (pending database migration)
