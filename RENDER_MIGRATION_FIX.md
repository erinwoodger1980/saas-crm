# Render Migration Fix Instructions

The Render dashboard isn't picking up the render.yaml changes. You need to manually fix the migration in the database.

## Option 1: Run SQL directly in Render Dashboard

1. Go to Render Dashboard → Database (dpg-d3mfk6mr433s73ajvdg0)
2. Click "Shell" tab
3. Run this SQL:

```sql
-- Mark the failed migration as rolled back
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251205163731_add_performed_by_name';
```

4. Then manually trigger a new deploy for the API service

## Option 2: Update Render Service Configuration Manually

1. Go to Render Dashboard → API Service
2. Click "Settings"
3. Scroll to "Build & Deploy"
4. Find "Pre-Deploy Command"
5. Change from: `npx prisma migrate deploy`
6. Change to: `pnpm run prisma:deploy:safe && pnpm tsx scripts/update-wealden-landing-prod.ts || true`
7. Click "Save Changes"
8. Trigger a new manual deploy

## What This Fixes

The migration `20251205163731_add_performed_by_name` failed because it tried to `ALTER TABLE` a table that didn't exist yet. The new migration `20251205170000_add_fire_door_qr_tables` creates all tables with `CREATE TABLE IF NOT EXISTS`, so it will work once we clear the failed migration marker.

The `prisma:deploy:safe` script automatically resolves failed migrations before running `migrate deploy`.
