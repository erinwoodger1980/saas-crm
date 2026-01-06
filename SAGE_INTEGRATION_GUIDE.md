# Sage Business Cloud Accounting Integration - Setup Guide

## Environment Variables

Add these to your `.env` file (API):

```bash
# Sage Business Cloud Accounting OAuth
SAGE_CLIENT_ID=your_sage_client_id_here
SAGE_CLIENT_SECRET=your_sage_client_secret_here
SAGE_REDIRECT_URI=http://localhost:4000/accounting/sage/callback

# Production:
# SAGE_REDIRECT_URI=https://your-domain.com/accounting/sage/callback
```

## Sage Developer Setup

1. Go to https://developer.sage.com/
2. Create a new application
3. Set redirect URI to match your `SAGE_REDIRECT_URI`
4. Select scopes: `full_access` (or minimal: `sales`, `purchases`)
5. Copy Client ID and Secret to your `.env`

## Database Migration

The Prisma schema has been updated with two new models:
- `TenantAccountingConnection` - Stores OAuth tokens and connection status
- `AccountingDocument` - Stores synced invoices/bills with auto-linking

To apply the migration:

```bash
cd api
npx prisma migrate dev --name add_sage_accounting_integration
# OR if shadow database issues:
npx prisma db push
npx prisma generate
```

## API Routes

All routes are under `/accounting/sage`:

- `GET /accounting/sage/connect` - Initiates OAuth flow
- `GET /accounting/sage/callback` - OAuth callback (automatic)
- `POST /accounting/sage/disconnect` - Disconnect integration
- `GET /accounting/sage/status` - Check connection status
- `POST /accounting/sage/sync` - Sync documents (last 90 days by default)
- `GET /accounting/sage/unlinked?type=sales|purchase` - Get unlinked documents
- `POST /accounting/sage/link` - Link document to opportunity
- `GET /accounting/sage/wip/:opportunityId` - Get WIP data for project

## Order Reference Patterns

Documents are auto-linked using these patterns in Sage invoice references:

1. `JOB:1234` or `ORDER:1234`
2. `#1234`
3. Plain alphanumeric (e.g., `MJS-2024-001`)

The reference must match an Opportunity's `number` field.

## UI Components

### Settings Page
- Added "Accounting Integration" section under Suppliers tab
- Shows connection status, last sync time
- Connect/Disconnect/Sync buttons

### Unlinked Documents Page
- URL: `/settings/accounting/unlinked`
- Lists all Sage documents without linked projects
- Manual link to opportunities via dropdown

### WIP Card (for Opportunities)
Import and use in opportunity detail pages:

```tsx
import { WIPCard } from "@/components/accounting/WIPCard";

<WIPCard 
  opportunityId={opportunity.id}
  percentComplete={75} // Your existing % complete logic
  contractValue={50000} // From opportunity.valueGBP
/>
```

Shows:
- Invoiced to Date (sales invoices - credits)
- Materials Cost (purchase invoices - credits)
- Margin to Date (invoiced - materials)
- Under/Over Billed (invoiced vs earned value)

## Testing Checklist

1. **OAuth Flow**
   - [ ] Click "Connect Sage" in Settings
   - [ ] Redirects to Sage login
   - [ ] Callback returns to `/settings/accounting?connected=sage`
   - [ ] Status shows "Connected"

2. **Sync**
   - [ ] Click "Sync Now"
   - [ ] Check server logs for document counts
   - [ ] Verify `AccountingDocument` records in database

3. **Auto-Linking**
   - [ ] Create Sage invoice with reference "JOB:MJS-001"
   - [ ] Create Opportunity with number "MJS-001"
   - [ ] Run sync
   - [ ] Check document has `linkedEntityId` set

4. **Manual Linking**
   - [ ] Go to `/settings/accounting/unlinked`
   - [ ] Select opportunity from dropdown
   - [ ] Verify document disappears from list

5. **WIP Display**
   - [ ] Add WIPCard to opportunity page
   - [ ] Should show 4 metrics with correct values
   - [ ] Click refresh to update

## Files Changed/Created

### API (Backend)
- `api/prisma/schema.prisma` - Added 2 models + relations
- `api/src/lib/accounting/sage-client.ts` - Sage API wrapper
- `api/src/routes/accounting-sage.ts` - API routes
- `api/src/server.ts` - Registered route

### Web (Frontend)
- `web/src/components/settings/AccountingIntegrationSection.tsx` - Settings UI
- `web/src/components/accounting/WIPCard.tsx` - WIP display
- `web/src/app/settings/accounting/unlinked/page.tsx` - Unlinked docs page
- `web/src/app/settings/page.tsx` - Added accounting section

## Build Commands

```bash
# Generate Prisma client
cd api && npx prisma generate

# Build API
cd api && pnpm build

# Build Web
cd web && pnpm build

# Run locally
cd api && pnpm dev &
cd web && pnpm dev
```

## Deployment Notes

1. Set production `SAGE_REDIRECT_URI` in environment
2. Run migration on production database
3. Update Sage developer app with production redirect URI
4. Test OAuth flow end-to-end

## Known Limitations (MVP)

- Only reads data from Sage (no write operations)
- Auto-link only works with Opportunity.number (not Lead)
- Syncs last 90 days by default (configurable via API body)
- No scheduled background sync (manual only)
- Token refresh tested but may need production validation
- Business ID detection may need refinement based on Sage API version

## Future Enhancements

- Background scheduled sync (daily/hourly)
- Link to Lead entities in addition to Opportunities
- Configurable auto-link patterns per tenant
- Multi-currency support improvements
- Export WIP reports
- Sage invoice creation from JoineryAI quotes
