# Copilot Project Setup Prompt: Joinery SaaS ML Architecture

> You are my AI pair-engineer. Design and implement a multi-layer ML system for a multi-tenant joinery SaaS (Next.js + Node/Express + Prisma/Postgres) that integrates Gmail + Microsoft 365, generates quotes from supplier PDFs, learns from user actions, and optimises sales/marketing. Follow the brief below and propose data schemas, pipeline steps, model choices, evaluation metrics, and minimal API surfaces. Ensure strict tenant isolation, GDPR-safe processing, and transparent user control.

---

## Goal

Implement four cooperating ML modules with online learning loops and human-in-the-loop corrections — each with a visible “AI Training” section in the user interface where users can view what the AI is learning, fine-tune sensitivity thresholds, override predictions, and provide corrective feedback that retrains the models in real time.

---

## Core ML Layers

### 1) Lead Classifier (Email Ingest)

- Input: Gmail/365 messages (subject, body, headers, minimal metadata)
- Task: Classify as (enquiry|not_enquiry) for joinery businesses
- Learning Loop: Refine model continuously from user actions: Rejected, Info requested, Ready to quote
- Output: If enquiry → create a Lead entity; otherwise ignore
- UI: “AI Training” panel
  - Sensitivity to enquiries slider (threshold)
  - Last 20 decisions with thumbs up/down, manual reclassify
  - Show model confidence per decision
- API:
  - POST /ml/ingest-email
  - POST /ml/feedback/lead-label

### 2) Quotation Builder (Supplier PDF → Client Proposal)

- Input: Supplier quotes (often EUR PDFs)
- Tasks: Extract line items, convert EUR→GBP, allocate delivery, apply markups, generate proposal PDF
- Output: Branded proposal (project details, T&Cs, reviews)
- UI: “AI Training” panel
  - Show extracted PDF data and conversions
  - Editable markups, delivery allocations, description accuracy
  - Re-train extraction model button (per supplier)
- API:
  - POST /ml/quote/build
  - GET /quotes/{id}/pdf

### 3) Estimator (Learn From Sent Quotes)

- Input: Sent proposal PDFs (Gmail/365)
- Task: Learn pricing; suggest questionnaire prompts; estimate new jobs within ±3% (goal)
- UI: “AI Training” panel
  - Accuracy graph (MAPE, R²) over time
  - Top contributing variables table with weight sliders
  - “Relearn from sent quotes” button; confidence per prediction
- API:
  - POST /ml/estimator/suggest-questions
  - POST /ml/estimator/estimate

### 4) Sales Assistant (Follow-ups + Budget Optimiser)

- Tasks: Suggest/send follow-ups, schedule calls, A/B test copy, optimise ad spend
- UI: “AI Training” panel
  - Editable follow-up templates & cadences
  - A/B test dashboard (open %, reply %, conversion %)
  - Budget optimiser: cost-per-lead vs conversion, spend sliders
- API:
  - POST /ml/sales/next-actions
  - POST /ml/ab/record
  - POST /ml/budget/recommend

---

## Technical & Transparency Requirements

- Strict tenant isolation across all tables, queues, cache keys, and models
- GDPR-safe processing: PII minimised; retention policies; export/delete per tenant
- Each ML module writes interpretable metadata to TrainingInsights
- “AI Training Dashboard” under /settings/ai-training aggregates:
  - Recent training samples
  - Confidence charts
  - User-adjustable parameters (thresholds, weightings)
  - “Reset Model” per module
  - Last trained timestamps + count of feedback samples incorporated
- All overrides/feedback versioned for audit + rollback

---

## Data Schemas (Prisma additions)

> Copilot: When editing `api/prisma/schema.prisma`, add the following models and indexes (use snake_case columns only where required by Postgres JSON ops; otherwise keep camelCase). Ensure tenantId on all rows and add helpful composite indexes.

```prisma
model TrainingInsights {
  id           String   @id @default(cuid())
  tenantId     String
  module       String   // lead_classifier | quote_builder | estimator | sales_assistant
  inputSummary String?  // short text or hash describing the input
  decision     String?  // e.g., enquiry / not_enquiry; or chosen followup variant
  confidence   Float?
  userFeedback Json?    // {correctedLabel, reason, overrides}
  lastUpdated  DateTime @updatedAt
  createdAt    DateTime @default(now())

  @@index([tenantId, module, createdAt])
}

model ModelOverride {
  id          String   @id @default(cuid())
  tenantId    String
  module      String // same enum domain as above
  key         String // e.g. "lead.threshold" or supplierId
  value       Json
  reason      String?
  createdById String?
  createdAt   DateTime @default(now())

  @@index([tenantId, module, key])
}

model TrainingEvent {
  id          String   @id @default(cuid())
  tenantId    String
  module      String
  kind        String   // FEEDBACK|RETRAIN|RESET|PARAM_CHANGE
  payload     Json
  actorId     String?
  createdAt   DateTime @default(now())

  @@index([tenantId, module, kind, createdAt])
}
```

> Copilot: Add foreign keys to `Tenant` and `User` if appropriate in your codebase; wire up cascading deletes on tenant removal.

---

## Minimal API Surfaces

> Copilot: Implement these endpoints in `api/src/routes` with Express 5; require `req.auth.tenantId` and log to `TrainingInsights` + `TrainingEvent`.

- Lead Classifier
  - POST /ml/ingest-email
  - POST /ml/feedback/lead-label
- Quotation Builder
  - POST /ml/quote/build
  - GET /quotes/{id}/pdf
- Estimator
  - POST /ml/estimator/suggest-questions
  - POST /ml/estimator/estimate
- Sales Assistant
  - POST /ml/sales/next-actions
  - POST /ml/ab/record
  - POST /ml/budget/recommend
- Training Dashboard
  - GET /ml/insights?module=lead_classifier&limit=100
  - POST /ml/params/set { module, key, value }
  - POST /ml/model/reset { module }
  - POST /ml/model/retrain { module }

All POSTs accept JSON; all GETs return JSON with `{ ok: true }` and payloads.

---

## Pipelines (pseudocode)

### Lead Classifier (online learning)

```
Ingest(email):
  x = {subject, body, from, headers}
  s = sanitize(x)  // tenant-safe, strip PII if configured
  y, p = model.predict(s)  // y ∈ {enquiry, not}
  log TrainingInsights(tenantId, module='lead_classifier', inputSummary, decision=y, confidence=p)
  if p >= threshold: create Lead

Feedback(leadId, label):
  upsert TrainingInsights(..., userFeedback={correctedLabel: label})
  queue RetrainJob(tenantId, module='lead_classifier')

RetrainJob:
  D = recent TrainingInsights with userFeedback
  fine-tune classifier (few-shot / lightweight model)
  write TrainingEvent(kind='RETRAIN')
  update lastTrained timestamp
```

### Quotation Builder

```
BuildQuote(pdfUrl, params):
  text, tables = parse_pdf(pdfUrl)
  lines = extract_lines(tables, text)
  lines_gbp = convert(lines, fx=EUR→GBP)
  lines_alloc = allocate_delivery(lines_gbp, method=params.deliveryMethod)
  total = apply_markups(lines_alloc, params.markups)
  store(Quote, Lines)
  export PDF(brand, T&Cs, reviews)
  log TrainingInsights(module='quote_builder', inputSummary=supplier, decision='generated', confidence=null)

Feedback(extract_corrections):
  store ModelOverride(module='quote_builder', key=supplierId, value=corrections)
  queue RetrainJob(module='quote_builder')
```

### Estimator

```
Collect(sentPdfs):
  features, target = parse_sent_quotes(sentPdfs)
  train model: regress(valueGBP ~ features)
  metrics = {MAPE, R2}
  log TrainingInsights(module='estimator', decision='train', confidence=null)

Estimate(formData):
  x = featurize(formData)
  y_hat, conf = model.predict(x)
  return {estimate: y_hat, confidence: conf}
```

### Sales Assistant

```
NextActions(context):
  variants = generate_followups(context)
  choose via bandit (e.g., Thompson Sampling)
  schedule send
  log TrainingInsights(module='sales_assistant', decision='variant_A', confidence=bandit_conf)

ABRecord(result):
  update bandit stats (open/reply/convert)
  log TrainingEvent(kind='AB_RESULT')

BudgetRecommend(spendHistory):
  fit response curves per source
  recommend allocation under budget
  return chart points + suggested spend per source
```

---

## Evaluation Metrics

- Lead Classifier: Precision@k, Recall, F1 by tenant; alert on drift
- Quotation Builder: Line-item extraction accuracy, edit distance of descriptions, FX error impact
- Estimator: MAPE, R², monotonicity constraints where sensible
- Sales: Open %, Reply %, Conversion %, incremental lift per variant, CPL vs CVR frontier

---

## UI (Next.js + shadcn/ui)

> Copilot: Add an “AI Training” area under `/settings/ai-training` with tabs per module. Show:

- Recent samples table (from TrainingInsights)
- Confidence sparkline
- Controls: threshold sliders, weight sliders, per-supplier overrides
- Buttons: Retrain, Reset
- “Last trained” and number of feedback samples

Use optimistic updates; call APIs above. Ensure only early adopters or admins see the panel initially via feature flag.

---

## Security & Privacy

- All rows keyed by tenantId + access checks on every route
- Optional PII stripping for TrainingInsights inputSummary
- Signed URLs for attachments; expire aggressively
- Export/Delete endpoints per tenant for GDPR

---

## Acceptance Criteria

- Users can clearly see what the AI is learning at any time
- Each AI layer provides manual overrides and fine adjustments
- Each module logs feedback loops visible in the AI Training dashboard
- Retraining accuracy improves measurably within 14 days of user feedback

---

## Notes for Copilot

- Prefer lightweight models with few-shot adapters and per-tenant overrides before full fine-tuning
- Log everything to TrainingInsights/TrainingEvent first; wire models second
- Add small, idempotent migrations; keep API surfaces minimal and versionable
- Write integration tests for each route happy path + 401, 403, and basic validation

---

## Implementation status (2025-10-24)

The following ML transparency and training features are implemented and live in the repo:

- TrainingInsights / ModelOverride / TrainingEvent tables with tenant relations and indexes.
- Endpoints under `/ml`:
  - `GET /ml/insights?module=…&limit=…` returns items + params; resilient if tables are missing.
  - `POST /ml/params/set` to set per-module parameters (e.g., `lead.threshold`).
  - `POST /ml/model/reset`, `POST /ml/model/retrain` log TrainingEvents (placeholders for real jobs).
  - `POST /ml/feedback` accepts `{ module, insightId, correct?, correctedLabel?, reason?, isLead? }` and merges userFeedback; for `lead_classifier` also maps to `EmailIngest.userLabelIsLead` and persists a `LeadTrainingExample`.

- Gmail ingest and classification:
  - `POST /gmail/import` pulls recent messages, classifies with OpenAI + heuristics, creates Leads and Tasks when appropriate, upserts `EmailThread`/`EmailMessage`/`EmailIngest`.
  - Logs `TrainingInsights` with `inputSummary = email:gmail:<messageId>` and `decision = accepted|rejected`.
  - `GET /gmail/message/:id` and attachments endpoints provide normalized JSON and signed content for previews.

- Microsoft 365 (Outlook) parity:
  - `POST /ms365/import` fetches Inbox via Microsoft Graph, mirrors Gmail flow (classification, persistence, lead creation).
  - Logs `TrainingInsights` with `inputSummary = email:ms365:<messageId>` and `decision = accepted|rejected`.
  - `GET /ms365/message/:id` returns normalized JSON for previews; attachments supported via `/ms365/message/:id/attachments/:attachmentId`.

- Web UI (Next.js): `/settings/ai-training`
  - Module tabs, threshold control, retrain/reset actions.
  - Recent decisions list with thumbs feedback (persists to TrainingInsights + training examples for lead classifier).
  - Source link + inline preview for Gmail and MS365 messages (subject/from/date/body and attachments).
  - Filters (provider/decision), limit selector (50/100/200), and a summary pill (✓ accepted / ✕ rejected / total).

### Operational notes

- The API is resilient when ML tables are not yet migrated: it returns empty arrays or friendly errors instead of 500.
- Background inbox watcher triggers `/gmail/import` and `/ms365/import` per-tenant according to `TenantSettings.inbox.intervalMinutes`.
- Use `POST /seed` locally to get a demo tenant and JWT quickly.

### Quick checks

1) Visit `/settings/ai-training` in the web app; you should see the dashboard (EA-gated).
2) Trigger Gmail/MS365 imports; watch new insights appear with correct providers.
3) Click 👍/👎 on a decision; refresh to verify persistence and that the corresponding `EmailIngest.userLabelIsLead` and `LeadTrainingExample` are updated for lead classifier.
