# Order Flow Map (Enquiry → Quote → Order → Workshop → ML)

## Sequence (dev trace prefix: [ORDER_FLOW])
```
Email (M365/Gmail) -> /mail/ingest -> Lead (status NEW) -> lead status transitions
  -> Quote create (/quotes) -> Questionnaire fill (/questionnaire-fill, /questionnaire-responses)
  -> Quote lines + attachments -> SceneState (3D) -> Pricing (ML or supplier parse)
  -> Quote status SENT -> customer -> Quote status ACCEPTED (or Opportunity WON)
  -> Workshop time/process logs (/workshop/time) -> Actuals recorded
  -> ML feedback (MLTrainingEvent/Estimate) -> training
```

## Step-by-step checkpoints

1) Email ingestion & classification
- UI: none (background); review in `web/src/app/leads/page.tsx` inbox list.
- API: `POST /mail/ingest` (`api/src/routes/mail.ts`); Gmail/MS365 routers also mount in `server.ts`.
- DB: `EmailIngest`, `EmailMessage`, `EmailThread` linked to `Lead`.
- State: creates/updates `EmailIngest` (aiPredictedIsLead); may create Lead when classified lead.
- Attachments: handled in Gmail/MS365 routes; stored as files referenced by messageId.

2) Accept enquiry → Lead
- UI: Leads board `web/src/app/leads/page.tsx`; lead detail in `web/src/components/leads/*` (check `use-lead-activity.ts`).
- API: `PATCH /leads/:id` status (in `api/src/routes/leads.ts`).
- DB: `Lead.status` (+ `Lead.custom` for metadata), `EmailIngest.leadId` back-reference.
- Transition: status change NEW → READY_TO_QUOTE/ESTIMATE etc.; logs `[ORDER_FLOW] lead_status_transition` with tenantId/leadId.

3) Questionnaire send/collect
- UI: questionnaire sender in settings/email templates; public form demo `web/src/app/questionnaire/demo/page.tsx`.
- API: `POST /questionnaire-fill` + `questionnaire-responses` router; uploads via `questionnaire-photos`.
- DB: `Questionnaire`, `QuestionnaireField`, `QuestionnaireResponse`, `QuestionnaireAnswer`, `QuestionnairePhoto`.
- Attachments: stored as `QuestionnairePhoto.storagePath`; answers persisted to `QuestionnaireResponse` (linked to `Quote` when applicable).

4) Quote builder (lines, attachments, 3D scene)
- UI: Quotes list `web/src/app/quotes/page.tsx`; quote detail `web/src/app/quotes/[id]/page.tsx`; configurator `web/src/app/configurator-demo/page.tsx` and fire-door layout pages.
- API: `POST /quotes` (create), `PATCH /quotes/:id` (meta/status), `POST /quotes/:id/files` (supplier PDFs), `POST /quotes/:id/lines`, `POST /quotes/:id/parse` etc. in `api/src/routes/quotes.ts`; `SceneState` via `web/src/app/api/scene-state/route.ts`.
- DB: `Quote`, `QuoteLine`, `UploadedFile` (supplier/client PDFs), `SceneState` (3D config), `QuoteQuestionnaireMatch`.
- Transition: quote create logs `[ORDER_FLOW] quote_created`; status changes log `[ORDER_FLOW] quote_status_changed` (includes leadId).

5) 3D builder/config state
- UI: `web/src/components/configurator/ProductConfigurator3D.tsx` driven by SceneState; demo at `/configurator-demo`.
- API: `POST /api/scene-state` (Next route), uses `SceneState` model.
- DB: `SceneState` keyed by tenantId/entityType/entityId.

6) Pricing (ML or supplier quote import)
- UI: quote detail pricing section; supplier import flows.
- API: ML estimate `POST /api/ai/estimate-components`; supplier parse `POST /quotes/:id/parse`; pricing defaults `quote-defaults` router; `ml-training-events` route for training examples.
- DB: `Estimate`, `InferenceEvent`, `ParsedSupplierLine` (within quotes router), `MLTrainingEvent`, `MLTrainingSample`.
- State: Quote.meta pricingMode, QuoteLine totals; supplier files in `UploadedFile`.

7) Send quote
- UI: quote detail send action (PDF/email) `web/src/app/quotes/[id]/page.tsx`.
- API: PDF/email generation inside `quotes.ts` (routes around PDF build); follow-up scheduling via `followups` router.
- DB: `Quote.status` → SENT, `FollowUpEvent`, `FollowUpLog`, `ProposalPdfUrl`.

8) Convert to order (Opportunity WON)
- UI: Orders board `web/src/app/orders/page.tsx` (opportunities), workshop view `web/src/app/workshop/page.tsx`.
- API: opportunities router (`api/src/routes/opportunities.ts`) and workshop router expose WON projects; quote status ACCEPTED should drive Opportunity.stage=WON (verify in opportunities update flow).
- DB: `Opportunity` (projectId on `Project`), `ProjectProcessAssignment` seeded per process; BOM lines in `BOMLineItem`/`BOMVariantLineItem`.
- Gap: explicit quote→opportunity WON endpoint not obvious in `quotes.ts`; confirm flow or add a dedicated conversion route that sets Opportunity.stage=WON and backfills Project/BOM.

9) Workshop tracking (hours + materials)
- UI: `/workshop` and `/workshop/team-activity` pages.
- API: `POST /workshop/time` (time entries), `workshop-processes`, timers; BOM via `component`/`purchase-order` routes.
- DB: `TimeEntry`, `WorkshopTimer`, `ProjectProcessAssignment`, `PurchaseOrder`, `ShoppingList`, `BOMLineItem`.
- Logging: `[ORDER_FLOW] workshop_time_logged` with tenantId/orderId/process/hours/userId.

10) ML feedback loop
- UI: ML training dashboards `web/src/app/ml-training/page.tsx` and `web/src/app/settings/ai-training/page.tsx`.
- API: `ml-actuals`, `ml-training-events`, `ml-samples`, `ml-insights`, `ml-status` routers.
- DB: `MLTrainingEvent`, `MLTrainingSample`, `TrainingInsights`, `Estimate` (actualAcceptedPrice fields), `ProcessTimingPrediction` fed by `TimeEntry`.
- Gap: ensure accepted quote totals feed `Estimate.actualAcceptedPrice` consistently; verify `ml-actuals` router ingest.

## Auth/tenant scoping
- Express API uses JWT middleware (server.ts) and `requireAuth` per router; tenantId pulled from `req.auth` headers. Dev-only fallbacks exist in quotes router (`getTenantId`) that default to LAJ tenant—safe for dev but ensure production auth enforced.
- Next app routes expect session cookies; check settings/preview screens to ensure tenant-scoped fetches (ProductConfigurator3D uses SceneState per tenant/entity).

## Current dev logging
- [ORDER_FLOW] ingest_recorded / ingest_classified_non_lead / ingest_promoted_to_lead (mail ingestion)
- [ORDER_FLOW] lead_status_transition (lead status patch)
- [ORDER_FLOW] quote_created / quote_status_changed (quote create/update)
- [ORDER_FLOW] workshop_time_logged (time entry)

## Punch list (smallest fixes)
1. Add explicit quote→order conversion endpoint updating Opportunity.stage=WON, seeding Project + process assignments, and log `[ORDER_FLOW] order_converted` with leadId/quoteId/orderId.
2. Ensure quote status ACCEPTED or opportunity WON writes `Estimate.actualAcceptedPrice` for ML feedback (check `ml-actuals` and leads status transitions when pulling latest quote).
3. Verify questionnaire send pipeline: add `[ORDER_FLOW] questionnaire_sent` + `[ORDER_FLOW] questionnaire_completed` logs in `questionnaire-fill` and `questionnaire-responses` routers.
4. Confirm attachments storage path for questionnaire photos and supplier PDFs; add retention/backfill check to ensure `UploadedFile.path` and `QuestionnairePhoto.storagePath` are accessible for ML.
5. Audit dev fallback in quotes `getTenantId`: guard with env flag to avoid unintended tenant spoofing in shared environments.

## How to trace a real enquiry (dev)
- Watch server logs for `[ORDER_FLOW]` entries; capture tenantId + leadId from ingest.
- Move lead through UI; observe `lead_status_transition`.
- Create quote from lead; check `quote_created` and SceneState saved.
- Send quote and mark accepted; (pending gap) update opportunity/order.
- Log workshop time on the order; see `workshop_time_logged`.
- Verify ML events in `ml-training-events` table for that quote/order.
