# Google Ads Manual Customer Linking - Implementation Summary

## Overview
Complete admin flow for managing Google Ads per tenant when programmatic customer creation is disabled. Admins can manually link existing Google Ads customer IDs, verify access, and bootstrap campaigns with one click.

---

## Files Created/Modified

### API Files

**`api/src/lib/googleAds.ts`** (Modified)
- Added `checkMccEnv()`: Validates all 5 required Google Ads environment variables
- Added `canAccessCustomer(customerIdWithDashes: string)`: Tests if MCC can access a specific customer account
- Returns `{ ok: boolean, notes: string[] }` for status reporting

**`api/src/routes/ads.ts`** (Modified)
- Added `POST /ads/tenant/:slug/link`: Save/link customer ID to tenant
- Added `GET /ads/tenant/:slug/verify`: Readiness verification endpoint
- Updated `POST /ads/tenant/:slug/bootstrap`: Added Zod validation and improved error handling
- All endpoints use Zod schemas for request validation
- Customer IDs stored with dashes, converted to digits-only for API calls

### Web Files

**`web/src/app/admin/tenants/[slug]/ads-link/page.tsx`** (Created)
- Complete admin UI for Google Ads customer linking workflow
- Three-step process: Link ID → Verify → Bootstrap
- Real-time verification checklist with status indicators
- Bootstrap form with sensible defaults
- Displays created campaign resource names on success

**`web/src/app/admin/tenants/page.tsx`** (Modified)
- Added "Ads Setup" button to tenant actions column
- Renamed "Ads" link to "Insights" for clarity

---

## API Endpoints

### POST `/ads/tenant/:slug/link`
Link an existing Google Ads customer ID to a tenant.

**Request:**
```json
{
  "customerId": "123-456-7890"
}
```

**Validation:**
- Customer ID must match regex: `^\d{3}-\d{3}-\d{4}$`
- Tenant must exist

**Response:**
```json
{
  "ok": true,
  "customerId": "123-456-7890",
  "message": "Linked customer 123-456-7890 to tenant Wealden Joinery"
}
```

**Curl Example:**
```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/link \
  -H "Content-Type: application/json" \
  -d '{"customerId":"123-456-7890"}'
```

---

### GET `/ads/tenant/:slug/verify`
Verify readiness for campaign bootstrap.

**Response:**
```json
{
  "mccOk": true,
  "customerId": "123-456-7890",
  "accessOk": true,
  "ga4IdPresent": false,
  "notes": [
    "All Google Ads environment variables are set",
    "✓ MCC has access to customer 123-456-7890",
    "⚠ GA4 tracking ID not set (optional for tracking)"
  ],
  "ready": true
}
```

**Checklist:**
- ✅ **mccOk**: All 5 environment variables present
- ✅ **customerId**: Customer ID linked in database
- ✅ **accessOk**: MCC can query this customer account
- ⚠️ **ga4IdPresent**: GA4 measurement ID configured (optional)
- ✅ **ready**: All checks pass (mccOk && customerId && accessOk)

**Curl Example:**
```bash
curl http://localhost:4000/ads/tenant/wealden/verify
```

---

### POST `/ads/tenant/:slug/bootstrap`
Bootstrap a complete Search campaign.

**Request:**
```json
{
  "landingUrl": "https://www.joineryai.app/tenant/wealden-joinery/landing",
  "postcode": "TN22 1AA",
  "radiusMiles": 50,
  "dailyBudgetGBP": 10
}
```

**Validation (Zod):**
- `landingUrl`: Must be valid URL
- `postcode`: Required, non-empty string
- `radiusMiles`: Optional number (default: 50)
- `dailyBudgetGBP`: Optional number (default: 10)

**Response:**
```json
{
  "success": true,
  "customerId": "123-456-7890",
  "budget": "customers/1234567890/campaignBudgets/987654321",
  "campaign": "customers/1234567890/campaigns/987654322",
  "adGroup": "customers/1234567890/adGroups/987654323",
  "ads": [
    "customers/1234567890/adGroupAds/987654324~111",
    "customers/1234567890/adGroupAds/987654324~112"
  ],
  "keywords": [
    "customers/1234567890/adGroupCriteria/987654325~222",
    "customers/1234567890/adGroupCriteria/987654325~223"
  ],
  "message": "Campaign bootstrapped successfully. Review in Google Ads and enable when ready."
}
```

**Curl Example:**
```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "landingUrl": "https://www.joineryai.app/tenant/wealden-joinery/landing",
    "postcode": "TN22 1AA",
    "radiusMiles": 50,
    "dailyBudgetGBP": 10
  }'
```

---

## Web UI Flow

### Access Path
1. Navigate to **Admin** → **Landing Pages** (`/admin/tenants`)
2. Click **"Ads Setup"** button for any tenant
3. Opens `/admin/tenants/[slug]/ads-link`

### Three-Step Workflow

#### Step 1: Link Customer ID
- Input field with format validation: `123-456-7890`
- Click **"Save Customer ID"** to store in database
- Automatically triggers verification after save

#### Step 2: Verify Access
- Click **"Verify Access"** to run checks
- Real-time checklist with ✓/✗ indicators:
  - [✓] MCC environment configured
  - [✓] Customer ID stored
  - [✓] MCC has access to customer
  - [⚠] GA4 tracking ID configured (optional)
- Shows detailed notes from API

#### Step 3: Bootstrap Campaign
- **Disabled** until all verification checks pass (ready = true)
- Form fields:
  - **Landing URL**: Pre-filled with tenant landing page
  - **Postcode**: Required (e.g., "TN22 1AA")
  - **Radius (miles)**: Default 50
  - **Daily Budget (£)**: Default 10
- Click **"Bootstrap Campaign"** to create
- Displays created resource IDs on success

---

## Environment Variables Required

### API (Already Set on Render)
```bash
GOOGLE_ADS_DEVELOPER_TOKEN=your_dev_token
GOOGLE_ADS_CLIENT_ID=your_oauth_client_id
GOOGLE_ADS_CLIENT_SECRET=your_oauth_client_secret
GOOGLE_ADS_REFRESH_TOKEN=your_refresh_token
LOGIN_CUSTOMER_ID=123-456-7890  # Your MCC account ID
```

### Optional (for GA4 tracking)
```bash
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
# or
GA4_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## How It Works

### Customer ID Management
1. **Storage**: Customer IDs stored in `TenantAdsConfig` table with dashes (e.g., "123-456-7890")
2. **API Calls**: Converted to digits-only format (e.g., "1234567890") before calling Google Ads API
3. **Validation**: Regex pattern ensures correct format: `^\d{3}-\d{3}-\d{4}$`

### Verification Logic
```typescript
// Check environment
const { ok: mccOk, notes } = checkMccEnv();

// Test customer access
const accessOk = await canAccessCustomer(customerId);

// Ready if all pass
const ready = mccOk && !!customerId && accessOk === true;
```

### Campaign Bootstrap
- Uses existing `bootstrapSearchCampaign()` service
- Creates campaign in **PAUSED** state for review
- Includes:
  - Campaign budget
  - Search campaign with location targeting
  - Ad group with default keywords
  - 2 responsive search ads
  - Negative keyword list (60+ terms)

---

## Testing Checklist

### 1. Environment Setup
```bash
# Verify API can see env vars
curl http://localhost:4000/ads/tenant/wealden/verify
# Should show mccOk: true
```

### 2. Link Customer ID
```bash
# Create customer manually in Google Ads UI first!
# Then link it:
curl -X POST http://localhost:4000/ads/tenant/wealden/link \
  -H "Content-Type: application/json" \
  -d '{"customerId":"123-456-7890"}'
```

### 3. Verify Access
```bash
curl http://localhost:4000/ads/tenant/wealden/verify
# Should show:
# - mccOk: true
# - customerId: "123-456-7890"  
# - accessOk: true
# - ready: true
```

### 4. Bootstrap Campaign
```bash
curl -X POST http://localhost:4000/ads/tenant/wealden/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "landingUrl": "https://www.joineryai.app/tenant/wealden-joinery/landing",
    "postcode": "TN22 1AA",
    "radiusMiles": 50,
    "dailyBudgetGBP": 10
  }'
```

### 5. Verify in Google Ads UI
1. Open Google Ads: https://ads.google.com
2. Select customer account "123-456-7890"
3. Check Campaigns → Should see new paused campaign
4. Review ads, keywords, settings
5. Enable campaign when ready

---

## Error Handling

### Common Errors

**"Customer ID must be in format 123-456-7890"**
- Solution: Ensure dashes are included: `123-456-7890`

**"Tenant does not have a Google Ads account linked"**
- Solution: Use POST `/ads/tenant/:slug/link` first

**"MCC cannot access customer"**
- Solution: In Google Ads UI, ensure customer is linked to your MCC account

**"Missing environment variables"**
- Solution: Set all 5 required Google Ads env vars on Render

**"Failed to bootstrap campaign"**
- Check API logs for Google Ads API errors
- Verify customer account is not suspended
- Ensure MCC has standard access (not read-only)

---

## Next Steps

1. **Deploy to Render**: Push triggers automatic deployment
2. **Create Customer**: Manually create customer in Google Ads UI
3. **Link Customer**: Use web UI or API to link customer ID
4. **Verify**: Ensure all checks pass
5. **Bootstrap**: Create campaign with one click
6. **Review**: Check campaign in Google Ads UI
7. **Enable**: Turn on campaign when ready

---

## Production Checklist

- [x] API routes implemented with Zod validation
- [x] Environment variable checking
- [x] Customer access verification
- [x] Web UI with three-step workflow
- [x] Error handling with user-friendly messages
- [x] Success feedback with resource IDs
- [x] Customer ID format validation
- [x] Readiness checklist display
- [x] Campaign creation in PAUSED state
- [ ] Create first customer in Google Ads UI
- [ ] Test full flow end-to-end
- [ ] Enable first campaign

---

## Architecture Notes

### Why Manual Customer Creation?
- Google Ads API customer creation requires special "Create customer" permission
- Most standard API tokens don't have this access
- Safer approach: Create in UI, link via API

### Customer ID Format
- **Stored**: `123-456-7890` (with dashes)
- **API calls**: `1234567890` (digits only)
- **Display**: `123-456-7890` (with dashes)

### Security
- Customer IDs are not sensitive (publicly visible in Google Ads)
- No OAuth tokens stored in database
- All API calls use server-side MCC refresh token
- Admin routes should be protected with authentication middleware

---

## Files Summary

### Created
- `web/src/app/admin/tenants/[slug]/ads-link/page.tsx` (450 lines)

### Modified
- `api/src/lib/googleAds.ts` (+60 lines)
- `api/src/routes/ads.ts` (+150 lines)
- `web/src/app/admin/tenants/page.tsx` (+10 lines)

### Total Changes
- 4 files changed
- 610 insertions
- 23 deletions

---

**Status**: ✅ All changes committed and pushed to GitHub (commit 901c3e0)
