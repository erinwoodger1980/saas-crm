# Migration Failure Resolution Guide

## Problem
The migration `20251202083545_add_number_description` started but failed to complete in Render's production database. This blocks all future migrations.

## Root Cause
The migration likely failed during execution but was marked as "started" in the `_prisma_migrations` table, putting it in a failed state.

## Solution Steps

### Step 1: Connect to Render PostgreSQL Database

Go to Render Dashboard → Your PostgreSQL service → Connect

Or use the connection string:
```bash
psql postgresql://joineryai_db_user:password@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db
```

### Step 2: Check Current Migration Status

```sql
-- Check if the failed migration exists in the migrations table
SELECT migration_name, started_at, finished_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20251202083545_add_number_description';
```

### Step 3: Check if Columns Already Exist

```sql
-- Check Lead table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Lead' AND column_name IN ('number', 'description');

-- Check Opportunity table
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'Opportunity' AND column_name IN ('number', 'description');
```

### Step 4: Mark Failed Migration as Rolled Back

```sql
-- Delete the failed migration record to allow fresh migration
DELETE FROM "_prisma_migrations"
WHERE migration_name = '20251202083545_add_number_description';
```

**Note:** This is safe because:
1. The migration uses IF NOT EXISTS clauses
2. The new migration (20251202090000_add_number_description_v2) will check for existing columns
3. No data is lost, only the migration tracking record

### Step 5: Deploy to Render

After running the SQL commands above, push the new migration:

```bash
git add -A
git commit -m "fix: replace failed migration with v2"
git push
```

Render will now run the new migration `20251202090000_add_number_description_v2` which:
- Uses PostgreSQL DO blocks for conditional column creation
- Checks if columns exist before adding them
- Will work regardless of partial migration state

## Alternative: Prisma migrate resolve

If you prefer using Prisma's built-in tool (requires local access to production DB):

```bash
# Mark migration as rolled back
npx prisma migrate resolve --rolled-back "20251202083545_add_number_description"

# Or mark as applied if columns already exist
npx prisma migrate resolve --applied "20251202083545_add_number_description"
```

## What Changed

1. **Deleted:** `prisma/migrations/20251202083545_add_number_description/`
2. **Created:** `prisma/migrations/20251202090000_add_number_description_v2/`
3. **New migration uses:** PostgreSQL DO blocks with IF NOT EXISTS checks instead of just ALTER TABLE IF NOT EXISTS

## Verification

After deployment, verify in Render logs:

```
✓ Applying migration `20251202090000_add_number_description_v2`
✓ Migrations complete
```

Then check in database:

```sql
-- Should show both migrations (if you marked old one as applied) or just the new one
SELECT migration_name, finished_at
FROM "_prisma_migrations"
ORDER BY started_at DESC
LIMIT 5;
```
