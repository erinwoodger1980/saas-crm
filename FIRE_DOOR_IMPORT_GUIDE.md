# Fire Door Spreadsheet Import System

Complete implementation of CSV import for fire door orders from client spreadsheets (LAJ/LWG format).

## Overview

This system allows fire door manufacturers to:
- Upload CSV exports of client fire door orders
- Parse ~200 columns of door specifications
- Store complete door details with traceability
- Calculate pricing totals automatically
- View import history and line items

## Architecture

### Database Models

#### `FireDoorImport`
Parent record for each CSV upload.

Fields:
- `id` - Unique identifier
- `tenantId` - Multi-tenant isolation
- `createdById` - User who uploaded
- `sourceName` - Original filename
- `status` - DRAFT, PROCESSING, COMPLETED, ERROR
- `totalValue` - Sum of all line item totals
- `currency` - Default GBP
- `rowCount` - Number of doors imported
- `projectId` / `orderId` - Optional linkage
- Timestamps

#### `FireDoorLineItem`
One record per door in the CSV.

Stored fields (70+):
- **Core**: itemType, code, quantity
- **Identification**: doorRef, location, doorSetType, fireRating, acousticRatingDb, handing
- **Colors**: internalColour, externalColour, frameFinish
- **Geometry**: leafHeight, masterLeafWidth, slaveLeafWidth, leafThickness, leafConfiguration
- **Finishes**: doorFinishSide1/2, doorFacing, lippingFinish, doorEdgeProtType
- **Glazing**: visionQtyLeaf1/2, aperture dimensions, totalGlazedAreaMaster
- **Ironmongery**: ironmongeryPackRef, closers, hinges, locks, signage, viewers
- **Pricing**: unitValue, labourCost, materialCost, lineTotal
- **Traceability**: rawRowJson (full original row as JSON)

### Backend Components

#### Parser Library (`api/src/lib/fireDoorImport/`)

**`types.ts`**
- TypeScript interfaces for request/response
- `COLUMN_MAPPING` - Maps CSV headers to internal field names
- `ParsedFireDoorRow` - Strongly typed parsed row structure

**`parser.ts`**
- `parseCurrencyToDecimal()` - Handles £1,104.00 → 1104.00
- `parseIntValue()` / `parseFloatValue()` - Type conversions
- `parseFireDoorRow()` - Parses single CSV row
- `parseFireDoorCSV()` - Parses entire CSV, filters Item === "Product"
- `calculateTotalValue()` - Sums all line totals
- `validateCSVHeaders()` - Checks required columns present

#### API Routes (`api/src/routes/fire-doors.ts`)

**POST `/api/fire-doors/import`**
- Multipart file upload (10MB max)
- Auth: Requires `isFireDoorManufacturer === true`
- Validates CSV headers
- Parses all product rows
- Creates import + line items in transaction
- Returns preview of first 10 items
- Response:
  ```json
  {
    "import": {
      "id": "...",
      "totalValue": 3854.00,
      "currency": "GBP",
      "status": "COMPLETED",
      "rowCount": 3,
      "createdAt": "2025-11-24T..."
    },
    "lineItems": [
      {
        "id": "...",
        "doorRef": "DR-001",
        "location": "Ground Floor",
        "fireRating": "FD30S",
        "quantity": 1,
        "lineTotal": 1104.00
      }
    ],
    "totalValue": 3854.00,
    "rowCount": 3
  }
  ```

**GET `/api/fire-doors/imports`**
- Lists all imports for tenant
- Pagination: `?limit=20&offset=0`
- Returns summary (no line items)

**GET `/api/fire-doors/imports/:id`**
- Full import details with all line items
- Tenant-isolated (enforced in query)

### Frontend Component

**`web/src/components/FireDoorImport.tsx`**

Features:
- Drag-and-drop CSV upload
- Real-time upload progress
- Error handling with clear messages
- Success notification with preview table
- "Show previous imports" toggle
- Formatted currency and dates
- Mobile responsive

Usage:
```tsx
import FireDoorImportSection from "@/components/FireDoorImport";

// In a page that needs fire door import
<FireDoorImportSection />
```

## CSV Format

### Required Headers
- `Item` (must be "Product" for data rows)
- `Code`
- `Door Ref`
- `Location`
- `Fire Rating`
- `Value`

### Supported Headers (200+)
Full list in `COLUMN_MAPPING` including:
- Leaf dimensions (height, width, thickness)
- Vision panel specifications (quantities, aperture sizes)
- Ironmongery details (closers, locks, handles, signage)
- Finishes (internal/external colors, edge protection)
- Additional notes and quantities

### Example CSV
```csv
Item,Code,Quantity,Door Ref,Location,Fire Rating,Leaf Height,M Leaf Width,Value
Product,FD001,1,DR-001,Ground Floor,FD30S,2100,926,£1104.00
Product,FD002,2,DR-002,First Floor,FD60,2100,826,£950.00
```

## Tenant Access Control

### Feature Flag
`TenantSettings.isFireDoorManufacturer` must be `true`.

### Enforcement Points
1. API route checks flag before allowing upload
2. UI component only visible to fire door manufacturers
3. All queries filter by `tenantId`

### Enable for Tenant
```sql
UPDATE "TenantSettings"
SET "isFireDoorManufacturer" = true
WHERE "tenantId" = '<tenant-id>';
```

## Pricing Logic

### Line Total Calculation
```
lineTotal = unitValue × quantity
```

If quantity is missing, defaults to 1.

### Total Value
```
totalValue = SUM(lineTotal) for all line items
```

### Currency Parsing
Handles:
- £1,104.00 (GBP)
- $1,104.00 (USD)
- 1,104.00 (plain)
- Removes commas and spaces
- Returns null for empty/invalid values

## Migration

### Apply Migration
```bash
cd api
npx prisma migrate deploy
```

Migration file: `api/prisma/migrations/20251124200000_add_fire_door_import_system/migration.sql`

Creates:
- `FireDoorImport` table with indexes
- `FireDoorLineItem` table with indexes
- Foreign key constraint (CASCADE delete)

## Testing

### Unit Tests
`api/tests/fireDoorParser.test.ts`

Tests:
- Currency parsing (£1,104.00 → 1104.00)
- Integer/float parsing
- Row parsing with complete data
- CSV validation (required headers)
- Total value calculation
- Filtering non-Product rows

Run:
```bash
cd api
npm test fireDoorParser.test.ts
```

### Integration Tests
`api/tests/fireDoorImport.test.ts`

Tests:
- Full import workflow (create import + line items)
- Database persistence
- Tenant isolation
- Fire rating filtering
- Query with line items

Run:
```bash
cd api
npm test fireDoorImport.test.ts
```

## Manual Testing

### 1. Enable Feature
```bash
# Via API (requires admin auth)
curl -X PATCH https://api.joineryai.app/tenant/settings \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "Content-Type: application/json" \
  -d '{"isFireDoorManufacturer": true}'
```

### 2. Create Test CSV
Save as `test-fire-doors.csv`:
```csv
Item,Code,Quantity,Door Ref,Location,Fire Rating,Leaf Height,M Leaf Width,Value,Cost of Labour,Cost of Materials
Product,FD001,1,DR-001,Ground Floor,FD30S,2100,926,£1104.00,£200.00,£800.00
Product,FD002,2,DR-002,First Floor,FD60,2100,826,£950.00,£180.00,£700.00
Product,FD003,1,DR-003,Second Floor,NFR,2100,726,£750.00,£150.00,£550.00
```

### 3. Upload via UI
1. Navigate to quotes or fire door page
2. Look for "Import Fire Door Orders from Spreadsheet" section
3. Click "Click to upload CSV"
4. Select `test-fire-doors.csv`
5. Verify success message shows:
   - "Imported 3 doors"
   - "total value of £3,854.00" (1104 + 1900 + 750)
   - Preview table with 3 rows

### 4. Upload via API
```bash
curl -X POST https://api.joineryai.app/fire-doors/import \
  -H "Authorization: Bearer YOUR_JWT" \
  -F "file=@test-fire-doors.csv"
```

### 5. List Imports
```bash
curl https://api.joineryai.app/fire-doors/imports \
  -H "Authorization: Bearer YOUR_JWT"
```

### 6. Get Import Details
```bash
curl https://api.joineryai.app/fire-doors/imports/IMPORT_ID \
  -H "Authorization: Bearer YOUR_JWT"
```

Expected response includes all 3 line items with full details.

## Error Handling

### Common Errors

**401 Unauthorized**
- Missing or invalid JWT token
- Solution: Ensure user is logged in

**403 Forbidden**
```json
{
  "error": "Fire door import is only available for fire door manufacturers",
  "message": "This feature requires fire door manufacturer access..."
}
```
- Solution: Enable `isFireDoorManufacturer` flag

**400 Invalid CSV format**
```json
{
  "error": "Invalid CSV format",
  "message": "CSV file is missing required columns",
  "missingHeaders": ["Location", "Fire Rating", "Value"]
}
```
- Solution: Ensure CSV has all required headers

**400 No valid product rows**
```json
{
  "error": "No valid product rows found",
  "message": "CSV must contain rows with Item = \"Product\""
}
```
- Solution: Check CSV has rows where Item column = "Product"

## Performance

### Scalability
- Tested with 200+ door orders (typical client export)
- Transaction ensures atomicity (all or nothing)
- Indexes on:
  - `tenantId, status` (list imports)
  - `tenantId, fireDoorImportId` (line items by import)
  - `tenantId, fireRating` (filter by rating)
  - `fireDoorImportId, rowIndex` (ordered line items)

### Optimization Opportunities
- Batch insert for line items (currently sequential)
- Background processing for very large files (500+ doors)
- Async status updates (PROCESSING → COMPLETED)

## Future Enhancements

### Planned Features
1. **Edit Imported Data**
   - UI to view and edit line item details
   - Bulk update pricing or specifications

2. **Export to Quote**
   - Convert import to internal quote format
   - Map to questionnaire fields

3. **Template Matching**
   - Support multiple CSV formats
   - Auto-detect format and apply correct mapping

4. **Analytics**
   - Dashboard showing import trends
   - Common fire ratings, sizes, finishes
   - Pricing variance over time

5. **Validation Rules**
   - Check fire certification compliance
   - Flag unusual dimensions or configurations
   - Suggest alternatives based on stock

## Files Changed

### Backend
- `api/prisma/schema.prisma` - Added FireDoorImport & FireDoorLineItem models
- `api/prisma/migrations/20251124200000_add_fire_door_import_system/migration.sql` - New migration
- `api/src/lib/fireDoorImport/types.ts` - Type definitions
- `api/src/lib/fireDoorImport/parser.ts` - CSV parsing logic
- `api/src/lib/fireDoorImport/index.ts` - Library exports
- `api/src/routes/fire-doors.ts` - API endpoints
- `api/src/server.ts` - Registered fire-doors route

### Frontend
- `web/src/components/FireDoorImport.tsx` - Import UI component

### Tests
- `api/tests/fireDoorParser.test.ts` - Unit tests
- `api/tests/fireDoorImport.test.ts` - Integration tests

### Documentation
- `FIRE_DOOR_IMPORT_GUIDE.md` - This file

## Support

### Troubleshooting

**Import succeeds but totalValue is 0**
- Check CSV Value column format
- Ensure currency symbols are present (£) or values are valid numbers
- Verify quantity is set (defaults to 1 if missing)

**Some doors missing from import**
- Only rows with Item = "Product" are imported
- Check row filtering in `parseFireDoorCSV()`
- Look for empty/header rows in CSV

**Database connection errors**
- Verify DATABASE_URL environment variable
- Check network connectivity to PostgreSQL
- Ensure migrations have been applied

### Contact
For issues or questions:
1. Check console logs in browser and API server
2. Review test cases for expected behavior
3. Verify tenant settings and feature flags
4. Contact development team with import ID and error details
