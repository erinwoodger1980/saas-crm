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
```

### Clearing the historical Prisma migration failure

Render (and other deploy shells) may still record the failed `20251020150829_reinit` migration. The deployment helper now drops and recreates the `public` schema before applying migrations so empty environments reset automatically. To mirror that behaviour locally:

```bash
PRISMA_RESET_BEFORE_DEPLOY=1 npm --prefix api run prisma:deploy
```

If you prefer to reset manually, you can run the one-off cleanup script from the repo root and then deploy:

```bash
npm run prisma:resolve-reinit
PRISMA_RESET_BEFORE_DEPLOY=1 npm --prefix api run prisma:deploy
```

> **Heads up:** dropping the schema erases all data. This is safe today because production has no tenants yet. Remove the `PRISMA_RESET_BEFORE_DEPLOY` variable once a persistent dataset exists.
