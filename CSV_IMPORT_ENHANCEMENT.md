# CSV Import Enhancement - Production Data Support

## Overview
Enhanced the CSV import functionality to support bulk importing of won opportunities with production data (start dates, delivery dates, quoted values).

## Features Added

### 1. Default Status Selection
- Added `defaultStatus` parameter to import endpoint
- Frontend UI includes status dropdown with all available statuses:
  - New Enquiry
  - Info Requested
  - Ready to Quote
  - Quote Sent
  - Won
  - Lost
  - Rejected
- Enhanced status mapping to handle variations (won, Won, WON, etc.)

### 2. Automatic Opportunity Creation
- Added `createOpportunities` parameter to enable auto-creation of opportunities
- When enabled and status is "Won", automatically creates an Opportunity record for each imported lead
- Opportunity includes:
  - Title (formatted as "Number - Description" or fallback to description/contact name)
  - Number and description from lead
  - Start date and delivery date from production fields
  - Quoted value as valueGBP
  - Stage set to 'QUALIFY'
  - wonAt timestamp set to import time

### 3. Production Fields Support
Enhanced CSV import to include production-related fields:
- **number**: Lead/project number
- **startDate**: Production start date
- **deliveryDate**: Production delivery/completion date
- **quotedValue**: Final quoted value
- **estimatedValue**: Initial estimated value
- **dateQuoteSent**: Date quote was sent to customer

### 4. Date Format Support
The import system supports multiple date formats via `parseFlexibleDate`:
- **DD/MM/YYYY** (e.g., 24/12/2025)
- **DD-MM-YYYY** (e.g., 24-12-2025)
- **YYYY-MM-DD** (ISO format)
- Month name formats (e.g., 24-Dec-2025)
- Two-digit years with smart century detection

### 5. Currency Parsing
Handles various currency formats:
- £1,234.56
- GBP 1234.56
- 1234.56
- Removes commas, currency symbols, and whitespace automatically

## Backend Changes

### Files Modified
- **api/src/routes/leads.ts**
  - Added `number`, `startDate`, `deliveryDate`, `quotedValue`, `estimatedValue`, `dateQuoteSent` to available fields
  - Updated import execute endpoint to accept `defaultStatus` and `createOpportunities` parameters
  - Enhanced status mapping with more variations
  - Implemented opportunity creation logic for Won leads
  - Opportunity pulls production dates from customData (where they're stored by CSV import)

### Endpoint Updates
**POST /api/leads/import/execute**
- New parameters:
  - `defaultStatus`: UiStatus enum value (default: "NEW_ENQUIRY")
  - `createOpportunities`: boolean (default: false)
- Creates Opportunity records when:
  - `createOpportunities` is true
  - Status is "WON"
  - No existing opportunity for the lead

## Frontend Changes

### Files Modified
- **web/src/components/leads/CsvImportModal.tsx**
  - Added "Import Options" section with:
    - Default Status selector (Step 1)
    - "Auto-create Opportunities for Won Leads" checkbox
  - Updated help text to document production fields
  - Passes `defaultStatus` and `createOpportunities` to backend

### User Experience
1. Upload CSV file
2. Select default status (e.g., "Won")
3. Toggle "Auto-create Opportunities" if desired
4. Map CSV columns to lead fields
5. Import executes with selected options
6. For Won leads with auto-create enabled:
   - Lead created with Won status
   - Opportunity automatically created with production data
   - Production dates (start/delivery) copied to opportunity
   - Quoted value set as opportunity value

## CSV Field Mapping

### Standard CSV Headers Recognized
| CSV Header | Maps To | Transform |
|------------|---------|-----------|
| Number | Lead.number | None |
| Name / Contact Name | Lead.contactName | None |
| Description | Lead.description | None |
| Total Price / Quoted Value | Lead.quotedValue | Currency (£) |
| Estimated Value | Lead.estimatedValue | Currency (£) |
| Start Date / Prod. Date | custom.startDate | Date (DD/MM/YYYY) |
| Delivery Date / Deliv. Date | custom.deliveryDate | Date (DD/MM/YYYY) |
| Created / Enquiry Date | Lead.capturedAt | Date |
| Date Quote Sent | Lead.dateQuoteSent | Date |
| Status | Lead.status | Status mapping |

### Example CSV Format
```csv
Number,Name,Total Price,Status,Prod. Date,Deliv. Date,Created
1472,John Smith Doors,£12,345.00,Won,01/02/2025,15/03/2025,15/01/2025
1474,ABC Company,£8,500.50,Won,10/02/2025,20/03/2025,18/01/2025
```

## Use Cases

### Bulk Import of Won Projects
**Scenario**: Import 37 won opportunities from old system
**Steps**:
1. Export data to CSV with columns: Number, Name, Total Price, Prod. Date, Deliv. Date
2. Open Leads page → Import CSV
3. Select "Won" as default status
4. Enable "Auto-create Opportunities"
5. Map columns appropriately
6. Import completes with all opportunities created and ready for production

### Historical Data Migration
**Scenario**: Migrate historical project data with production timelines
**Benefit**: All won projects automatically get opportunity records with correct dates and values for reporting and tracking

## Technical Details

### Database Schema
- **Lead**: number (String?), description (String), quotedValue (Decimal?), estimatedValue (Decimal?), dateQuoteSent (DateTime?)
- **Lead.custom**: Stores startDate and deliveryDate as ISO strings
- **Opportunity**: number (String?), description (String?), startDate (DateTime?), deliveryDate (DateTime?), valueGBP (Decimal?)

### Migration Status
- Migration `20251202083545_add_number_description` ready to deploy
- Uses IF NOT EXISTS clauses for safety
- Only adds `number` to Lead (description already existed)
- Adds `number` and `description` to Opportunity

### Validation
- Date validation ensures valid day/month ranges
- Currency parsing handles multiple formats
- Status mapping case-insensitive with fallback to default
- Opportunity creation wrapped in try-catch to prevent import failure

## Testing Checklist
- [ ] Import CSV with Won status and production dates
- [ ] Verify opportunities created automatically
- [ ] Confirm dates parsed correctly (DD/MM/YYYY format)
- [ ] Verify currency values stripped of £ and commas
- [ ] Test with various status values (won, Won, WON)
- [ ] Confirm number and description appear in UI
- [ ] Check workshop schedule shows production dates

## Deployment Notes
1. Backend changes compile successfully (TypeScript)
2. Frontend changes compile successfully (Next.js)
3. Migration will run automatically on Render deployment
4. No breaking changes - all new features are opt-in
5. Backward compatible with existing CSV imports

## Related Files
- `api/src/routes/leads.ts` - Import endpoints
- `api/src/lib/leads/fieldMap.ts` - CSV field mappings and date parsing
- `web/src/components/leads/CsvImportModal.tsx` - Import UI
- `api/prisma/migrations/20251202083545_add_number_description/migration.sql` - Database migration
