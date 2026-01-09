# Lookup Table Columns Fix - Deployment Instructions

## What Was Done

1. **Added Schema Fields** (Commit: `4e5ceb2f`)
   - Added `columns String[]` field to LookupTable model
   - Added `name String?` field to LookupTable model for display names
   - Both fields are now in production schema after Render migration

2. **Created Population Script** (Commit: `f52f24f2`)
   - Script: `api/scripts/populate-lookup-table-columns.ts`
   - Automatically extracts column names from existing row data
   - Updates lookup tables that have rows but no columns

## Problem Summary

LAJ Joinery lookup tables (e.g., "Fire door core pricing and specifications") show:
- Row count in the header (137 rows)
- But display "No data rows" when expanded

**Root Cause:**
The `columns` field was dropped during the unified lookup tables migration but is required by the UI to render the table data. The recent schema change added it back, but existing tables have empty column arrays.

## Next Steps (After Render Deployment Completes)

### 1. Wait for Render Deployment
Check Render dashboard to confirm:
- ✅ Build succeeded
- ✅ Migration ran successfully  
- ✅ Service is running

### 2. Run Column Population Script

SSH into Render or use Render shell to run:

```bash
cd /opt/render/project/src/api
DATABASE_URL="<your-production-db-url>" pnpm populate-columns
```

Or if DATABASE_URL is already in environment:
```bash
cd /opt/render/project/src/api
pnpm populate-columns
```

**Expected Output:**
```
🔍 Finding lookup tables without columns...
📊 Found 15 total lookup tables
✅ Updated Fire door core pricing: added 8 columns [Material, Density, Thickness, ...]
✅ Updated Glass specifications: added 6 columns [Type, Thickness, Rating, ...]
...
📈 Summary:
   - Total tables: 15
   - Updated: 12
   - Skipped: 3
✨ Done!
```

### 3. Verify in UI

1. Log into LAJ Joinery account
2. Go to Settings → Lookup Tables
3. Click into "Fire door core pricing and specifications"
4. Should now see:
   - Column headers (extracted from data)
   - All 137 rows with data
   - Proper table display

### 4. Alternative: Run via Local Connection

If you have the production DATABASE_URL:

```bash
cd ~/saas-crm/api
DATABASE_URL="postgres://user:pass@host:port/db" pnpm populate-columns
```

## Technical Details

**What the script does:**
1. Finds all LookupTable records
2. For each table with rows but no columns:
   - Fetches the first row
   - Extracts keys from the `data` JSONB field
   - Updates the table's `columns` array with those keys

**Why this works:**
- LAJ lookup table rows store data in JSONB format
- Example row.data: `{"Material": "Oak", "Density": "640", "Thickness": "44mm", ...}`
- Column names are the keys: `["Material", "Density", "Thickness", ...]`

**Safety:**
- Only updates tables with empty/missing columns
- Skips tables that already have columns
- Read-only for existing rows - only updates LookupTable.columns field
- Can be run multiple times safely (idempotent)

## Troubleshooting

### Script fails with "table does not exist"
- Migration hasn't run yet - wait for Render deployment to complete

### Still seeing "No data rows" after running script
- Check browser console for API errors
- Verify API logs show columns being returned: `[lookup-tables] Table "X": 8 columns, 137 rows`
- Hard refresh browser (Cmd+Shift+R)

### Columns are wrong/incomplete
- Some rows may have inconsistent structure
- Script uses first row's keys - verify first row has all expected fields
- Can manually update columns in database if needed:
  ```sql
  UPDATE "LookupTable" 
  SET columns = ARRAY['Material', 'Density', 'Thickness', ...]
  WHERE id = '<table-id>';
  ```

## Files Changed

- `api/prisma/schema.prisma` - Added columns and name fields
- `api/scripts/populate-lookup-table-columns.ts` - Population script
- `api/package.json` - Added `populate-columns` script
- `api/src/routes/flexible-fields.ts` - Already has logging for debugging

## Verification Queries

Check current state in production database:

```sql
-- See which tables need columns populated
SELECT id, "tableName", "name", array_length(columns, 1) as column_count,
       (SELECT COUNT(*) FROM "LookupTableRow" WHERE "lookupTableId" = "LookupTable".id) as row_count
FROM "LookupTable"
WHERE "tenantId" = '<laj-tenant-id>'
ORDER BY "tableName";

-- View sample row data to see what columns should be
SELECT data
FROM "LookupTableRow"
WHERE "lookupTableId" = '<table-id>'
LIMIT 1;
```
