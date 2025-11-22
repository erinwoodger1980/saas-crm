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

> Requires: Node 20+, npm, Postgres 14+ (or Docker), and **Prisma** (installed via `devDependencies`).

---

## Environment Variables

### Web (Next.js)
- **`NEXT_PUBLIC_API_BASE`** (required in production): Public API endpoint URL (e.g., `https://api.joineryai.app`). In local dev, defaults to `http://localhost:4000` if unset.
- `NEXT_PUBLIC_WEB_ORIGIN`: Public web origin (e.g., `https://joineryai.app`).
- `NEXT_PUBLIC_FOUNDERS_PROMO_CODE`: Optional promo code for early access.
- `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_HOTJAR_ID`: Optional analytics trackers.
- `NEXT_PUBLIC_MATERIAL_MIN_CHANGE_PERCENT`: Minimum absolute % change to surface a material cost alert (default: `3`).
- `NEXT_PUBLIC_MATERIAL_FUZZY_THRESHOLD`: Levenshtein similarity (0–1) threshold for fuzzy material token matching (default: `0.82`). Lower to catch more OCR misspellings.

### API
- **`DATABASE_URL`** (required): PostgreSQL connection string.
- `ML_URL`: FastAPI ML service endpoint (default: `http://localhost:8000`).
- `FOLLOWUPS_ENABLED`: Enable follow-up scheduling features (default: `false`).
- Additional follow-up tuning: `FOLLOWUPS_DEFAULT_DELAY_DAYS`, `FOLLOWUPS_BUSINESS_HOURS`, `FOLLOWUPS_LOCAL_TZ`, `FOLLOWUPS_COST_PENCE`, `FOLLOWUPS_MIN_SENDS_FOR_TEST`, `FOLLOWUPS_AB_DELTA_PROMOTE`.

### Material Cost Alerts Configuration

The quote builder surfaces real‑time supplier material cost movements captured from purchase order uploads. Alerts are prioritized with severity bands:

| Severity | Criteria |
|----------|---------|
| minor | <5% change (or very small code match) |
| moderate | 5–14% change (or code match ≥5%) |
| major | ≥15% change (or absolute change ≥20%) |

Environment variables let you tune noise vs sensitivity:

| Variable | Default | Effect |
|----------|---------|-------|
| `NEXT_PUBLIC_MATERIAL_MIN_CHANGE_PERCENT` | 3 | Suppresses small movements unless direct code match. |
| `NEXT_PUBLIC_MATERIAL_FUZZY_THRESHOLD` | 0.82 | Controls tolerance for near‑miss tokens (e.g. OCR typos). |

Tuning tips:
- Raise `MIN_CHANGE_PERCENT` if volatile commodities flood alerts.
- Lower `FUZZY_THRESHOLD` (e.g. 0.75) to capture more misspellings; raise (≥0.85) to reduce false positives.
- After changes, restart `web` to apply.

### Photo-Based Auto-Fill (Estimator)

Users can upload a project photo (door/window/opening) on the public estimator page. The API performs vision analysis (OpenAI) to estimate dimensions and extract descriptive attributes (material, glazing, colour, ironmongery, style tags, product type) then suggests questionnaire answers for any blank matching fields.

Endpoints:
- `POST /public/estimator-ai/photo-fill` (multipart) — returns `{ measurement, suggestedAnswers, reasoning }`.
- Existing low-level dimension route: `POST /measurements/from-photo` for raw width/height only.

Client Flow:
1. User selects an image; front-end posts the photo and current field schema.
2. Server invokes vision model (requires `OPENAI_API_KEY`).
3. Suggestions map some field keys (width, height, material, glazing, finish, style, description) to inferred values — only blanks are pre-filled when the user clicks “Apply Suggestions”.
4. User reviews/edits remaining fields and submits as normal.

Environment:
- Requires `OPENAI_API_KEY` for vision; without it the endpoint returns `visionAvailable:false` and an empty suggestion set.

Notes:
- Dimensions are clamped to 300–3000mm and rounded to nearest 10 for consistency.
- Confidence score (<0.4) indicates low reliability; dimension fields may remain unfilled.
- Style tags are joined with commas when mapped to simple text fields.
- Existing answers are never overwritten automatically.

---

### 1) API
## ML service (FastAPI) setup

The API forwards parse/predict/train calls to a separate FastAPI service.

- Local: the API defaults to `http://localhost:8000` for ML. Run the ML service from `ml/` and ensure it listens on port 8000.
- Production: set `ML_URL` in the API environment to your deployed ML URL (for example `https://ml-yourservice.onrender.com`) and redeploy the API.

Verify wiring:

- From the API: `GET /ml/health` should return `{ ok: true, target: "<your ML_URL>" }`.
- In the app: open Settings → AI Training; the header shows an ML status badge.

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

If ML tables are not present in your DB yet, the API responds gracefully with empty sets; run migrations or deploy the provided SQL migration to enable full functionality.# Trigger deployment

## Follow-ups & A/B Testing

- Set `FOLLOWUPS_ENABLED=true` in `api/.env` to expose scheduling, reporting, and AI planning endpoints. When set to `false`, the routes below return `403 followups_disabled` (and the tracking pixel returns `404`).
- Additional tuning comes from `FOLLOWUPS_DEFAULT_DELAY_DAYS`, `FOLLOWUPS_BUSINESS_HOURS`, `FOLLOWUPS_LOCAL_TZ`, `FOLLOWUPS_COST_PENCE`, `FOLLOWUPS_MIN_SENDS_FOR_TEST`, and `FOLLOWUPS_AB_DELTA_PROMOTE`.

Example cURL calls (replace `$API_ORIGIN`, `$JWT`, and IDs with your values):

```bash
# Summarise performance over the last 28 days
curl -H "Authorization: Bearer $JWT" \
  "$API_ORIGIN/followups/summary?days=28"

# Schedule new follow-up events for leads ready to quote
curl -X POST -H "Authorization: Bearer $JWT" \
  "$API_ORIGIN/followups/schedule"

# Generate an AI follow-up suggestion
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"leadId":"<lead-id>","status":"QUOTE_SENT","history":[],"context":{"brand":"Acme Kitchens"}}' \
  "$API_ORIGIN/ai/followup/suggest"

# Advance to the next experiment variant for a specific opportunity
curl -X POST -H "Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  -d '{"variant":"B"}' \
  "$API_ORIGIN/opportunities/<lead-id>/next-followup"
```

## Inbox auto-filing (Enquiries)

When an inbound email is classified as an accepted lead, the API performs a small post-classification side effect to keep inboxes tidy:

- Gmail: removes the INBOX label and applies a label named "Enquiries" (created on demand)
- Microsoft 365: moves the message into a folder named "Enquiries" (created on demand)

Controls (TenantSettings.inbox):

- `autoFileAcceptedLeads` (boolean, default true) — enable/disable auto-filing
- `enquiriesName` (string, default "Enquiries") — label/folder display name

Requirements:

- Gmail scopes must include `https://www.googleapis.com/auth/gmail.modify`
- Microsoft 365 must be connected with delegated scopes that include `offline_access` and `Mail.ReadWrite`

If MS365 was connected previously with only `Mail.Read`, moving messages will be skipped and an activity log entry will suggest reconnecting with the proper scope.
