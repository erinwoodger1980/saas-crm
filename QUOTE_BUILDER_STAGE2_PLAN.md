# Quote Builder – Stage 2 Plan

Stage 1 delivered: supplier PDF ingestion + ML parsing, questionnaire capture, ML estimate, proposal PDF render, basic line editing UI shell (now backed by PATCH endpoint), mapping quote lines to questionnaire.

Stage 2 Goals (Pricing + Collaboration + Accuracy):
1. Interactive pricing refinements (margin overrides, manual sell price, line-level adjustments, delivery & surcharge allocation).
2. Questionnaire → specification enrichment (auto-populate proposal sections; allow editing scope/specs before render).
3. Quote status workflow (READY_TO_QUOTE → QUOTE_SENT) with automation events & timestamps.
4. Enhanced exports (branded PDF v2, CSV improvements, optional JSON payload for downstream systems).
5. Supplier comparison & multi-source cost merging (when >1 supplier PDF uploaded).
6. Audit & training signals (capture manual edits for ML retraining / feedback loops).
7. Performance & caching (smarter estimate cache invalidation on significant questionnaire or cost changes).

## Detailed Tasks

### 1. Pricing & Line Editing
- [ ] Support manual override of sellUnitGBP & margin per line (retain both + note override flag).
- [ ] Auto-recompute lineTotalGBP on qty/unit change with existing margin.
- [ ] Implement bulk margin update endpoint: POST /quotes/:id/price { method: "margin", margin } (already present) – extend to skip lines with manual override.
- [ ] Delivery allocation: add endpoint /quotes/:id/delivery { amountGBP, method: "spread"|"single" } distributing to lines (store deliveryShareGBP and reflect in proposal subtotal).
- [ ] Surcharge handling: meta.surchargeGBP per line; total surcharge summary in proposal.

### 2. Questionnaire & Specifications Integration
- [ ] Add PATCH /quotes/:id/specifications to store structured specs (timber, finish, glazing, etc.) already partially in proposal template.
- [ ] UI section for editing specs separate from questionnaire raw answers.
- [ ] Auto-suggest specs from questionnaire answers (mapping rules file).

### 3. Workflow & Automation
- [ ] When proposal rendered, optionally mark quote status QUOTE_SENT and set dateQuoteSent.
- [ ] Emit automation event { type: "QUOTE_SENT", quoteId } (service already has type).
- [ ] Add endpoint PATCH /quotes/:id/status { status } with validation (READY_TO_QUOTE, QUOTE_SENT, WON, LOST?).
- [ ] UI toast & timeline entry on status transitions.

### 4. Export / Presentation
- [ ] Proposal PDF v2: optional hide amounts per line, show margin %, show delivery & surcharge breakdown, include revision number.
- [ ] Add CSV export with additional columns: margin, deliveryShareGBP, surchargeGBP, predictedTotal.
- [ ] JSON export endpoint /quotes/:id/export.json (machine-friendly).

### 5. Multi-Supplier & Comparison
- [ ] When >1 supplier file parsed, group lines by supplier; show supplier column.
- [ ] Offer comparison view (cheapest unit cost, recommended supplier tag).
- [ ] Mark lines chosen for client proposal (meta.included = true/false).

### 6. ML Feedback & Audit
- [ ] Capture edit deltas (original vs new qty/unitPrice/sellUnit) into a quoteLineRevision table.
- [ ] Nightly job aggregates adjustments → training signals (e.g., average markup chosen vs model suggestion).
- [ ] Add /quotes/:id/lines/:lineId/revisions GET.

### 7. Estimate Cache Invalidation
- [ ] Invalidate cached Estimate when >10% of total base cost changes or key questionnaire feature fields mutate.
- [ ] Track lastEstimate.inputHash vs new flattened questionnaire hash.

### 8. DX / Reliability
- [ ] Add integration tests for new endpoints (line patch, delivery allocation, status transitions).
- [ ] Seed data fixtures for quotes with multiple supplier PDFs.

## Endpoint Additions Summary
- PATCH /quotes/:id/lines/:lineId (added) – extend to support override flags.
- POST  /quotes/:id/delivery
- PATCH /quotes/:id/specifications
- PATCH /quotes/:id/status
- GET   /quotes/:id/export.json
- GET   /quotes/:id/lines/:lineId/revisions (future)

## Data Model Adjustments (Prisma)
- quoteLine: add fields overrideSellUnitGBP (Decimal?), surchargeGBP (Decimal?), included (Boolean?).
- quote: add status enum extension (READY_TO_QUOTE, QUOTE_SENT, WON, LOST), specifications JSON, revision counter.
- quoteLineRevision: { id, quoteLineId, changedAt, prevValues JSON, nextValues JSON }.

## Risks & Mitigations
- Heavy PDF parsing latency → keep async parse path; surface progress state (already in meta.lastParse).
- Margin overrides conflicting with ML distribution → store pricingMethod granularly per line (already meta.pricingMethod) and ignore overridden lines in ML redistribution.
- Puppeteer availability → fallback already implemented; consider pre-warming container or using @sparticuz/chromium only.

## Success Criteria
- Inline edits persist & immediately reflected in totals.
- Rendering proposal after ML pricing sets status & timestamp automatically (configurable).
- Delivery & surcharge appear in exported PDF & CSV.
- Multiple supplier file uploads show supplier grouping & selection.
- Editing questionnaire crucial fields triggers re-estimate prompt.

---
Incremental execution recommended: implement endpoints + minimal UI toggles, then expand presentation and ML feedback.
