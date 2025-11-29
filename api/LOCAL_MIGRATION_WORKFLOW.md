# Local Prisma Migration Workflow

## Problem
Prisma `migrate dev` fails locally because:
1. Shadow database tries to replay all historical migrations from scratch
2. Historical migrations reference production-only baseline states
3. Local dev DB doesn't have the same baseline as production

## Solution: Manual Migration + DB Push

### Method 1: Manual Migration (Recommended for New Tables)

When adding a new model like `AnalyticsEvent`:

1. **Edit schema**: Add model to `prisma/schema.prisma`

2. **Create migration folder**:
   ```bash
   mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_descriptive_name
   ```

3. **Write migration SQL**: Create `migration.sql` with DDL:
   ```sql
   CREATE TABLE "ModelName" (
     "id" TEXT NOT NULL,
     -- fields...
     CONSTRAINT "ModelName_pkey" PRIMARY KEY ("id")
   );
   
   -- Indexes
   CREATE INDEX "ModelName_field_idx" ON "ModelName"("field");
   
   -- Foreign keys
   ALTER TABLE "ModelName"
     ADD CONSTRAINT "ModelName_tenantId_fkey" 
     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") 
     ON DELETE CASCADE ON UPDATE CASCADE;
   ```

4. **Apply locally**:
   ```bash
   cd api
   source .env.local  # Load DATABASE_URL
   psql "$DATABASE_URL" -f prisma/migrations/TIMESTAMP_name/migration.sql
   ```

5. **Regenerate client**:
   ```bash
   pnpm prisma generate
   ```

6. **Commit**:
   ```bash
   git add prisma/migrations/TIMESTAMP_name
   git commit -m "feat: add ModelName table migration"
   ```

### Method 2: DB Push (Quick Dev)

For rapid iteration without migration files:

```bash
cd api
pnpm prisma db push
```

**Warning**: Skips migration history. Use only for local dev experimentation.

### Method 3: Force Baseline (If Starting Fresh)

If your local DB is empty and you want all existing tables:

```bash
cd api
# Point to production DATABASE_URL temporarily
export DATABASE_URL="postgresql://prod_user:pass@host/db"
pnpm prisma migrate resolve --applied 0_to_20251128_baseline
# Switch back to local
export DATABASE_URL="postgresql://Erin:devpass@localhost:5432/joinery_dev_scopes"
pnpm prisma migrate deploy
```

## Production Deployment

Always use `migrate deploy` (never `migrate dev`) in production:

```bash
# On production server
cd api
export DATABASE_URL="<production_url>"
pnpm prisma migrate deploy
pm2 restart api
```

Or apply individual migration:

```bash
psql "$DATABASE_URL" -f prisma/migrations/TIMESTAMP_name/migration.sql
npx prisma migrate resolve --applied TIMESTAMP_name
```

## Troubleshooting

### "Table does not exist" in shadow DB
**Cause**: Shadow DB tries to replay all migrations from empty state.
**Fix**: Use Method 1 (manual migration) or Method 2 (db push).

### Local/prod schema drift
**Check**: `pnpm prisma migrate status`
**Fix**: Apply missing migrations with `prisma migrate deploy`

### Need to see what Prisma would generate
```bash
pnpm prisma migrate dev --create-only --name test_migration
# Review generated SQL in migrations/TIMESTAMP_test_migration/migration.sql
# Delete folder if not needed
```

## Quick Reference

| Task | Command |
|------|---------|
| Add new table (manual) | Create folder + SQL → `psql -f migration.sql` |
| Quick schema sync | `pnpm prisma db push` |
| Generate client | `pnpm prisma generate` |
| Check migration status | `pnpm prisma migrate status` |
| Apply pending (prod) | `pnpm prisma migrate deploy` |
| Mark as applied | `npx prisma migrate resolve --applied NAME` |

## Environment Files

- **Local**: `api/.env.local` with `DATABASE_URL` pointing to localhost
- **Production**: Use env vars on hosting platform (Render, Railway, etc.)
- **Shadow DB**: Set `SHADOW_DATABASE_URL` to disposable local DB (never prod!)

## Last Updated
2025-11-29: Added after AnalyticsEvent migration workflow clarification.
