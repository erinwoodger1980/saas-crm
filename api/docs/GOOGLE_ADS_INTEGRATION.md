# Google Ads MCC Integration

Complete Google Ads API integration using a single MCC (Manager) account to manage multiple tenant sub-accounts. Each tenant gets their own Google Ads customer account with fully bootstrapped Search campaigns.

## Architecture

- **Single MCC OAuth token** stored in environment variables
- **Per-tenant sub-accounts** stored in `TenantAdsConfig` table
- **Campaign bootstrap** with location targeting, responsive ads, sitelinks, and negative keywords
- **REST API** for programmatic management
- **CLI scripts** for operational tasks

## Environment Variables

Set these on your Render API service:

```bash
# Google Ads API credentials
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token_here
GOOGLE_ADS_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=your_client_secret_here

# MCC-level OAuth refresh token (obtain via OAuth flow)
GOOGLE_ADS_REFRESH_TOKEN=1//your_mcc_refresh_token

# MCC customer ID (digits only, no dashes)
LOGIN_CUSTOMER_ID=1234567890
```

### Getting the MCC Refresh Token

1. Create OAuth 2.0 credentials in Google Cloud Console
2. Enable Google Ads API
3. Use OAuth playground or custom flow to obtain refresh token with these scopes:
   - `https://www.googleapis.com/auth/adwords`
4. Ensure the OAuth app has access to your MCC account

## Database Setup

```bash
# Generate Prisma client with new TenantAdsConfig model
pnpm --filter api prisma generate

# Run migration to add TenantAdsConfig table
pnpm --filter api prisma migrate dev --name ads_config
```

## Files Created

### Core Library
- `api/src/lib/googleAds.ts` - Google Ads API client wrapper
  - `getAdsClient(customerId)` - Get authenticated client
  - `listAccessibleCustomers()` - List MCC sub-accounts
  - `createCustomerClient({ name, currency, timeZone })` - Create sub-account
  - Utility functions: `stripDashes()`, `digitsOnly()`, `formatCustomerId()`

### Services
- `api/src/services/ads/constants.ts` - Default settings
  - `DEFAULT_NEGATIVE_KEYWORDS` - 60+ negative keywords
  - `DEFAULT_CAMPAIGN_SETTINGS` - Budget, radius, tracking template
  - `DEFAULT_AD_HEADLINES/DESCRIPTIONS` - Ad copy templates
  - `DEFAULT_KEYWORDS` - Starting keyword list
  - `DEFAULT_SITELINKS` - 4 sitelink extensions

- `api/src/services/ads/tenants.ts` - Tenant operations
  - `createSubAccount(tenantId, name)` - Create Google Ads account for tenant
  - `ensureNegativeList(customerId, listName)` - Attach shared negative list
  - `getTenantCustomerId(tenantId)` - Lookup tenant's customer ID

- `api/src/services/ads/bootstrap.ts` - Campaign creation
  - `bootstrapSearchCampaign(options)` - Full campaign setup
    - Creates budget, campaign, ad group
    - Adds location targeting (proximity radius)
    - Creates 2 responsive search ads
    - Adds 7 keywords with {city} substitution
    - Creates 4 sitelink extensions
    - Attaches negative keyword list
  - `gbpToMicros(gbp)` - Currency conversion

### REST API
- `api/src/routes/ads.ts` - HTTP endpoints (mounted at `/ads`)
  - `POST /ads/tenant/:slug/create-subaccount` - Create sub-account
  - `POST /ads/tenant/:slug/bootstrap` - Bootstrap campaign
  - `POST /ads/tenant/:slug/negatives/attach` - Attach negatives
  - `GET /ads/tenant/:slug/config` - Get tenant ads config

### CLI Scripts
- `api/scripts/test_google_ads.ts` - Test API connectivity
- `api/scripts/make_subaccount.ts` - Create sub-account
- `api/scripts/bootstrap_campaign.ts` - Bootstrap campaign

## Usage

### 1. Test API Connectivity

Validates environment variables and lists accessible customers:

```bash
pnpm --filter api tsx scripts/test_google_ads.ts
```

Expected output:
```
Testing Google Ads API connectivity...

Environment variables:
  ✓ GOOGLE_ADS_DEVELOPER_TOKEN: 12345678...
  ✓ GOOGLE_ADS_CLIENT_ID: 123456789.apps.googleusercontent.com
  ✓ GOOGLE_ADS_CLIENT_SECRET: GOCSPX-...
  ✓ GOOGLE_ADS_REFRESH_TOKEN: 1//0gF5n...
  ✓ LOGIN_CUSTOMER_ID: 1234567890

✓ All environment variables set

MCC Customer ID: 1234567890

Fetching accessible customer accounts...
  Found 3 accessible customer(s):

  1. 1234567890
  2. 9876543210
  3. 5556667777

✓ Google Ads API test successful!
```

### 2. Create Sub-Account for Tenant

Creates a Google Ads customer account under the MCC:

```bash
pnpm --filter api tsx scripts/make_subaccount.ts -- \
  --slug wealden \
  --name "Wealden Joinery Ads"
```

Expected output:
```
Creating Google Ads sub-account for tenant: wealden

Found tenant: Wealden Joinery (clxxx123)

Creating sub-account: "Wealden Joinery Ads"

✓ Sub-account created successfully!
  Customer ID: 448-935-8197
  Tenant ID: clxxx123

Next steps:
  1. Bootstrap a campaign:
     pnpm --filter api tsx scripts/bootstrap_campaign.ts -- --slug wealden --url <landing-url> --postcode <postcode>
  2. View in Google Ads UI:
     https://ads.google.com/aw/accounts?account=4489358197
```

### 3. Bootstrap Campaign

Creates a complete Search campaign with all settings:

```bash
pnpm --filter api tsx scripts/bootstrap_campaign.ts -- \
  --slug wealden \
  --url https://www.joineryai.app/tenant/wealden-joinery/landing \
  --postcode "TN22 1AA" \
  --radius 50 \
  --budget 10 \
  --city "Sussex"
```

Parameters:
- `--slug` - Tenant slug (required)
- `--url` - Landing page URL (required)
- `--postcode` - UK postcode for location targeting (required)
- `--radius` - Radius in miles (default: 50)
- `--budget` - Daily budget in GBP (default: 10)
- `--city` - City name for ad copy substitution (default: Sussex)

Expected output:
```
Bootstrapping Google Ads campaign...

  Tenant slug: wealden
Landing URL: https://www.joineryai.app/tenant/wealden-joinery/landing
  Postcode: TN22 1AA
  Radius: 50 miles
  Daily budget: £10
  City: Sussex

Found tenant: Wealden Joinery (clxxx123)
Google Ads customer ID: 448-935-8197

Creating campaign resources...
Created budget: customers/4489358197/campaignBudgets/123456
Created campaign: customers/4489358197/campaigns/234567
Added proximity targeting: TN22 1AA, 50 miles
Created ad group: customers/4489358197/adGroups/345678
Added 7 keywords
Created 2 responsive search ads
Added 4 sitelink extensions

✓ Campaign bootstrap complete!

Resources created:
  Budget: customers/4489358197/campaignBudgets/123456
  Campaign: customers/4489358197/campaigns/234567
  Ad Group: customers/4489358197/adGroups/345678
  Ads: 2 responsive search ads
  Keywords: 7 keywords
  Sitelinks: 4 sitelink extensions

⚠️  Campaign is PAUSED by default
   Enable it in the Google Ads UI after review:

   https://ads.google.com/aw/campaigns?account=4489358197

Next steps:
  1. Review campaign settings in Google Ads UI
  2. Add conversion tracking if needed
  3. Enable the campaign when ready
  4. Monitor performance and adjust bids
```

## REST API Usage

### Create Sub-Account

```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/create-subaccount \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Wealden Joinery Ads"}'
```

Response:
```json
{
  "success": true,
  "tenantId": "clxxx123",
  "customerId": "448-935-8197",
  "message": "Created Google Ads sub-account: 448-935-8197"
}
```

### Bootstrap Campaign

```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/bootstrap \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "landingUrl": "https://www.joineryai.app/tenant/wealden-joinery/landing",
    "postcode": "TN22 1AA",
    "radiusMiles": 50,
    "dailyBudgetGBP": 10,
    "city": "Sussex"
  }'
```

Response:
```json
{
  "success": true,
  "tenantId": "clxxx123",
  "customerId": "448-935-8197",
  "campaign": "customers/4489358197/campaigns/234567",
  "adGroup": "customers/4489358197/adGroups/345678",
  "budget": "customers/4489358197/campaignBudgets/123456",
  "ads": ["customers/4489358197/adGroupAds/456789", "..."],
  "sitelinks": ["customers/4489358197/campaignExtensionSettings/567890", "..."],
  "keywords": ["customers/4489358197/adGroupCriteria/678901", "..."],
  "message": "Campaign bootstrap complete. Campaign is PAUSED - enable in Google Ads UI."
}
```

### Attach Negative Keywords

```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/negatives/attach \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"listName": "Joinery AI Default Negatives"}'
```

### Get Tenant Config

```bash
curl http://localhost:4000/ads/tenant/wealden/config \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "tenantId": "clxxx123",
  "hasAdsAccount": true,
  "customerId": "448-935-8197",
  "status": "active",
  "createdAt": "2025-01-15T10:30:00.000Z",
  "updatedAt": "2025-01-15T10:30:00.000Z"
}
```

## Campaign Details

### Location Targeting
- **Proximity targeting** around specified postcode
- **Radius** configurable (default: 50 miles)
- **Country** hardcoded to GB
- **Target type** set to "Presence" (people in or regularly in the area)

### Keywords
Default keywords with {city} substitution:
- `+timber +windows +{city}` (Broad)
- `+sash +windows +{city}` (Broad)
- `"heritage windows"` (Phrase)
- `[timber doors {city}]` (Exact)
- `+timber +joinery +{city}` (Broad)
- `"period windows"` (Phrase)
- `+sash +window +restoration` (Broad)

### Responsive Search Ads
Two ads created with dynamic headlines and descriptions:

**Ad 1 - Location Focused:**
- Headlines: Timber Windows {City}, Sash Windows {City}, Heritage Window Specialists, PAS 24 Security Windows, Free Quote - Fast Install
- Descriptions: Expert installation, conservation approved, free surveys

**Ad 2 - Quality Focused:**
- Headlines: Bespoke Timber Doors, 50-Year Guarantee, Expert Craftsmen, Premium Quality Joinery
- Descriptions: Heritage specialists, handcrafted products, free quotes

### Sitelink Extensions
Links to landing page anchors:
- **View Gallery** → `{landingUrl}#gallery`
- **Get a Quote** → `{landingUrl}#quote`
- **Customer Reviews** → `{landingUrl}#reviews`
- **Our Guarantees** → `{landingUrl}#guarantees`

### Tracking Template
UTM parameters for analytics:
```
{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&utm_term={keyword}&utm_content={creative}&gclid={gclid}
```

### Negative Keywords (60+)
Automatically attached shared list includes:
- Price terms: free, cheap, cheapest, budget, discount
- DIY terms: DIY, kit, how to make, plans
- Materials: uPVC, plastic, aluminium, vinyl
- Jobs: jobs, career, vacancy, hiring, apprentice
- Competitors: B&Q, Wickes, Homebase, IKEA
- Furniture: staircase, kitchen, table, chair, desk
- Locations: USA, Australia, Canada, India
- And 40+ more...

## Bidding Strategy

Campaigns use **Maximize Conversions** bidding:
- No manual CPC management required
- Google automatically adjusts bids to get most conversions within budget
- Requires conversion tracking setup in Google Ads
- Initial ad group CPC bid set to £2.00 as baseline

## Campaign Status

All campaigns created as **PAUSED** by default:
1. Review settings in Google Ads UI
2. Verify conversion tracking
3. Check budget and targeting
4. Enable campaign when ready

## Error Handling

All API operations include detailed error logging:
- Partial failure details from Google Ads API
- Environment variable validation
- Tenant lookup verification
- Customer ID validation

Example error response:
```json
{
  "error": "Tenant does not have a Google Ads account",
  "message": "Create sub-account first using POST /ads/tenant/:slug/create-subaccount"
}
```

## Development

Start API server:
```bash
cd api
pnpm dev
```

Server runs on port 4000 (configurable via `PORT` env var).

Routes mounted at:
- `/ads/tenant/:slug/*` - Tenant operations
- Protected by `requireAuth` middleware

## Troubleshooting

### "Missing required Google Ads environment variables"
- Check all 5 env vars are set on Render
- Redeploy after setting env vars
- Run `test_google_ads.ts` to validate

### "INVALID_REFRESH_TOKEN"
- Refresh token expired or revoked
- Re-run OAuth flow to get new token
- Ensure token has correct scopes

### "PERMISSION_DENIED"
- MCC account doesn't have API access
- Check developer token status
- Verify OAuth app has access to MCC

### "Zero keywords found"
- New account may take time to populate
- Verify campaigns are enabled
- Check Google Ads UI for campaign status

### TypeScript errors about `tenantAdsConfig`
- Run `pnpm --filter api prisma generate` after schema changes
- Restart TypeScript server in editor

## Production Checklist

- [ ] Set all 5 env vars on Render API service
- [ ] Run database migration (`prisma migrate deploy`)
- [ ] Test connectivity with `test_google_ads.ts`
- [ ] Create sub-account for first tenant
- [ ] Bootstrap campaign and verify in Google Ads UI
- [ ] Set up conversion tracking
- [ ] Enable campaign after review
- [ ] Monitor spend and performance
- [ ] Consider scheduled sync for keyword performance data

## Related Documentation

- [Google Ads API Docs](https://developers.google.com/google-ads/api/docs/start)
- [OAuth 2.0 Setup](https://developers.google.com/google-ads/api/docs/oauth/overview)
- [Manager Account Guide](https://support.google.com/google-ads/answer/6139186)
