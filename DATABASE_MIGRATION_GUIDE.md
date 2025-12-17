# Database Migration Guide - CRITICAL INSTRUCTIONS

## ⚠️ IMPORTANT: Always Use Production Database

**The `.env` file in the `api` folder points to LOCAL database by default.**  
**Production database connection string is in `.env.local` at the root level.**

## Production Database Connection String

```
postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require
```

---

## How to Run Migrations on Production

### Method 1: Using Prisma Migrate Deploy (RECOMMENDED)

```bash
cd api
DATABASE_URL='postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require' pnpm prisma migrate deploy
```

### Method 2: Using Node.js Script

Create a script file (e.g., `run-migration.js`):

```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require'
});

async function runMigration() {
  try {
    await client.connect();
    console.log('✅ Connected to PRODUCTION database');
    
    // Your SQL here
    const result = await client.query(`
      -- Your migration SQL
    `);
    
    console.log('✅ Migration completed:', result);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

runMigration();
```

Then run:
```bash
node run-migration.js
```

---

## How to Check Database Data on Production

### Method 1: Quick Query Script

```javascript
const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require'
});

async function checkData() {
  try {
    await client.connect();
    console.log('✅ Connected to PRODUCTION database');
    
    const result = await client.query('SELECT * FROM "ComponentLookup" LIMIT 10');
    console.log('Data:', result.rows);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkData();
```

### Method 2: Using Prisma Studio (if psql not available)

**Note: This is slower but works without psql installed**

1. Temporarily update `api/.env` to use production URL
2. Run `cd api && pnpm prisma studio`
3. **IMPORTANT: Change it back to local after!**

---

## Common Mistakes to Avoid

### ❌ WRONG: Running without DATABASE_URL
```bash
cd api
pnpm prisma migrate deploy  # This uses LOCAL database!
```

### ✅ CORRECT: Specify production DATABASE_URL
```bash
cd api
DATABASE_URL='postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require' pnpm prisma migrate deploy
```

---

## Render Deployment Notes

- **Render does NOT automatically run migrations on deploy**
- Migrations must be run manually using the methods above
- Both Web (saas-crm) and API (Joinery AI) are separate services on Render
- If you only change frontend code, only Web service needs to rebuild
- If you change API code or schema, API service needs to rebuild

---

## Quick Reference Commands

### Check what database you're connected to:
```bash
cd api
DATABASE_URL='postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require' pnpm prisma db execute --stdin <<< "SELECT current_database(), current_user;"
```

### Create a new migration (local first, then deploy to prod):
```bash
cd api
pnpm prisma migrate dev --name descriptive_migration_name
# Then deploy to production:
DATABASE_URL='postgresql://joineryai_db_user:prBIH2Iho6o8Q1mMiDzVMoEzQjeJTPkQ@dpg-d3mfk6mr433s73ajvdg0-a.oregon-postgres.render.com/joineryai_db?sslmode=require' pnpm prisma migrate deploy
```

### Update schema and regenerate Prisma client:
```bash
cd api
pnpm prisma generate
```

---

## Environment Variables Summary

| File | Database | Purpose |
|------|----------|---------|
| `api/.env` | Local PostgreSQL | Development/testing |
| `.env.local` (root) | Production on Render | **LIVE DATA - USE FOR MIGRATIONS** |
| Render Dashboard | Production on Render | Same as .env.local |

---

## Troubleshooting

### Migration appears to run but changes not visible in production
- Check you used production DATABASE_URL
- Verify with query script that you're connected to correct database
- Check Render logs to see if API service restarted

### "Migration already applied" message
- This is normal - migration ran successfully before
- Check the `_prisma_migrations` table to see what's applied

### Changes not showing in app after deployment
- **NOT a database issue** - likely browser cache
- Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
- Clear browser cache completely
- Try incognito/private browsing mode
- Check DevTools → Network tab for new bundle hashes
