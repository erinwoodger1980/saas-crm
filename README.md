# saas-crm

Mono-repo with:

- `api/` — Express + Prisma + Postgres
- `web/` — Next.js 15 (App Router, Turbopack, Tailwind + shadcn/ui)

---

## Quick start (local)

> Requires: Node 20+, npm, Postgres 14+ (or Docker), and **Prisma** (installed via `devDependencies`).

### 1) API

```bash
cd api
cp .env.example .env

# Install deps
npm i

# Create DB & run migrations (Point DATABASE_URL in .env at your local Postgres)
npx prisma migrate dev

# (Optional) open Prisma Studio
npx prisma studio

# Start the API (port 4000 by default)
npm run dev
# -> http://localhost:4000/healthz   should return "ok"
# -> POST http://localhost:4000/seed  returns a { jwt, user, tenant }

### Deploying Prisma migrations to a main database

To apply the Prisma migrations against your production database:

1. Make sure the environment provides both connection strings:
   - `DATABASE_URL` should point at the production database that should receive the schema updates.
   - `SHADOW_DATABASE_URL` should point at an empty database Render can create and destroy while it runs migrations.
     - If the shadow database variable is temporarily missing, the deploy script will fall back to `DATABASE_URL` and print a warning so the migration can still run. Configure the dedicated shadow database as soon as you can to keep Render deployments conflict-free.
2. Run the deploy script from the `api` workspace (the script automatically checks for the previously failed migration and marks it as rolled back before running `prisma migrate deploy`):

   ```bash
   cd api
   npm run prisma:deploy
   ```

When Render runs this script in its build step, Prisma will read from `DATABASE_URL`, run the migrations against the main database, and use the `SHADOW_DATABASE_URL` for the shadow database required by the migration engine.
