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

Render (and other deploy shells) may still record the failed `20251020150829_reinit` migration. The deploy helper matches `main` and simply runs `prisma migrate deploy`, so you need to clear the failure once before normal deploys succeed.

From the repository root:

```bash
npm run prisma:resolve-reinit
npm --prefix api run prisma:deploy
```

The first command marks the old migration as rolled back using the API schema path; the second applies the current history.
