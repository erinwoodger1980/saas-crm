# saas-crm

Mono-repo with:

- `api/` — Express + Prisma + Postgres
- `web/` — Next.js 15 (App Router, Turbopack, Tailwind + shadcn/ui)

> Includes a post-Stripe onboarding flow that issues signup tokens, prompts new admins to set a password immediately, and redirects them into the app once complete.

---

## Copilot project setup prompt (architecture)

This repository includes a multi-layer ML design across Gmail/MS365 ingest, quotation building, estimation, and sales assistance. For GitHub Copilot and other AI tools, use the architecture brief in `docs/architecture.md` as the single source of truth when generating code, schemas, and APIs.

• Start here: docs/architecture.md

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