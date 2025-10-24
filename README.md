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

### 2) Web

```bash
cd web
npm i
npm run dev
# -> http://localhost:3000
```

Login locally using the token from `POST /seed` (paste in the app’s dev login if present), or hit `/auth/dev-login` from the API.

---

## AI Training (status)

- Dashboard at `/settings/ai-training` (early adopters only) shows recent decisions per module, threshold controls, and feedback.
- Gmail and MS365 imports log transparent decisions to `TrainingInsights` with `inputSummary = email:<provider>:<id>`.
- Clicking Preview shows a normalized email view with subject/from/date/body and attachments.
- Thumbs up/down feeds back into the system; for the lead classifier it also marks `EmailIngest.userLabelIsLead` and upserts a `LeadTrainingExample`.

Endpoints of note:

- API
	- `GET /ml/insights?module=lead_classifier&limit=50`
	- `POST /ml/feedback` with `{ module, insightId, correct, reason, isLead }`
	- `POST /gmail/import`, `POST /ms365/import`
	- `GET /gmail/message/:id`, `GET /ms365/message/:id`

If ML tables are not present in your DB yet, the API responds gracefully with empty sets; run migrations or deploy the provided SQL migration to enable full functionality.