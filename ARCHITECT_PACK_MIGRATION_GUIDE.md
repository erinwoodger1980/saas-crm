# Running the Architect Pack Migration on Live Database

Since the Prisma shadow database is causing issues, we'll run the migration directly on the production database using SQL.

## Option 1: Using the Migration Script (Recommended)

### Step 1: Set Database URL

```bash
export DATABASE_URL='postgresql://joineryai_db_user:YOUR_PASSWORD@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db'
```

### Step 2: Run the Migration Script

```bash
cd /Users/Erin/saas-crm
./run_architect_pack_migration.sh
```

This will:
- ✅ Create the 3 new tables (ArchitectPack, ArchitectPackAnalysis, ArchitectOpening)
- ✅ Add all indexes
- ✅ Add all foreign key constraints
- ✅ Use `IF NOT EXISTS` to be idempotent (safe to run multiple times)

### Step 3: Generate Prisma Client

After migration succeeds, regenerate the Prisma client:

```bash
cd api
npx prisma generate
```

This will add the new models to your TypeScript types.

### Step 4: Add Migration Record (Optional)

To track this migration in Prisma's system:

```bash
psql "$DATABASE_URL" << EOF
INSERT INTO "_prisma_migrations" 
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES 
  (gen_random_uuid(), '', NOW(), '20251221_add_architect_pack_ingestion', NULL, NULL, NOW(), 1);
EOF
```

---

## Option 2: Manual SQL Execution

If you prefer to run SQL manually:

### Step 1: Connect to Database

```bash
psql postgresql://joineryai_db_user:YOUR_PASSWORD@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db
```

### Step 2: Run Migration SQL

Copy and paste the contents of `architect_pack_migration.sql` into the psql prompt.

Or run it from file:

```sql
\i /Users/Erin/saas-crm/architect_pack_migration.sql
```

### Step 3: Verify Tables

```sql
-- Check tables exist
\dt ArchitectPack

-- Check table structure
\d "ArchitectPack"
\d "ArchitectPackAnalysis"
\d "ArchitectOpening"

-- Check indexes
\di ArchitectPack*

-- Check foreign keys
SELECT 
    conname AS constraint_name,
    conrelid::regclass AS table_name,
    confrelid::regclass AS referenced_table
FROM pg_constraint
WHERE conname LIKE 'Architect%';
```

### Step 4: Generate Prisma Client

```bash
cd api
npx prisma generate
```

---

## Option 3: Using Prisma Migrate Deploy (If Shadow DB Fixed)

If shadow database issues are resolved:

```bash
cd api
npx prisma migrate deploy
```

This will apply all pending migrations including the architect pack tables.

---

## Verification Checklist

After migration, verify:

- [ ] Tables created:
  ```sql
  SELECT tablename FROM pg_tables WHERE tablename LIKE 'Architect%';
  ```

- [ ] Indexes created:
  ```sql
  SELECT indexname FROM pg_indexes WHERE tablename LIKE 'Architect%';
  ```

- [ ] Foreign keys created:
  ```sql
  SELECT conname FROM pg_constraint WHERE conname LIKE 'Architect%';
  ```

- [ ] Prisma client generated:
  ```bash
  cd api
  npx tsc --noEmit
  # Should show no errors about ArchitectPack not existing
  ```

- [ ] TypeScript compilation works:
  ```bash
  cd api
  pnpm build
  # Should compile successfully
  ```

---

## Rollback (If Needed)

If something goes wrong, rollback the migration:

```sql
-- Drop tables (cascade will remove all dependent objects)
DROP TABLE IF EXISTS "ArchitectOpening" CASCADE;
DROP TABLE IF EXISTS "ArchitectPackAnalysis" CASCADE;
DROP TABLE IF EXISTS "ArchitectPack" CASCADE;

-- Remove migration record
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251221_add_architect_pack_ingestion';
```

Then regenerate Prisma client:

```bash
cd api
npx prisma generate
```

---

## Troubleshooting

### Error: "permission denied"

Make sure your database user has CREATE TABLE permissions:

```sql
GRANT CREATE ON SCHEMA public TO joineryai_db_user;
```

### Error: "relation already exists"

Tables already exist. This is safe - the migration uses `IF NOT EXISTS`.

Verify existing tables:

```sql
\d "ArchitectPack"
```

If structure matches, just regenerate Prisma client:

```bash
cd api
npx prisma generate
```

### Error: "foreign key constraint"

Referenced tables don't exist. Check:

```sql
-- These must exist:
\d "Tenant"
\d "QuoteLine"
```

---

## Files Created

1. **architect_pack_migration.sql** - SQL migration file
2. **run_architect_pack_migration.sh** - Automated migration script
3. **ARCHITECT_PACK_MIGRATION_GUIDE.md** - This guide

---

## Next Steps After Migration

1. **Install Dependencies:**
   ```bash
   cd api
   pnpm add pdfjs-dist canvas openai
   ```

2. **Regenerate Prisma Client:**
   ```bash
   npx prisma generate
   ```

3. **Restart API Server:**
   ```bash
   pnpm dev
   ```

4. **Test Endpoints:**
   ```bash
   curl http://localhost:3000/api/architect-packs/upload \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -X POST
   ```

---

**Migration prepared for live database deployment**  
**Safe to run - uses IF NOT EXISTS for idempotency**  
**Date:** December 21, 2025
