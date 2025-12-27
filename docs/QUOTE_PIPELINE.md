# Quote Pipeline Map (Enquiry → Quote → PDF → Email)

> Internal workflow map for the JoineryAI quote pipeline. Keep this file updated when data ownership changes.

## Core models + entry points

- **Enquiry/Lead ingestion**
  - Gmail/M365 ingestion routes: `api/src/routes/gmail.ts`, `api/src/routes/ms365.ts`, `api/src/routes/gmail-attachments.ts`
  - Lead model: `api/prisma/schema.prisma` → `model Lead`
  - Lead APIs: `api/src/routes/leads.ts`
- **Questionnaire + attachments/photos**
  - Questionnaire models: `api/prisma/schema.prisma` → `Questionnaire`, `QuestionnaireResponse`, `QuestionnaireAnswer`, `QuestionnairePhoto`
  - Questionnaire routes: `api/src/routes/questionnaire-responses.ts`, `api/src/routes/questionnaire.ts`
  - UI: `web/src/components/questionnaire/DynamicQuoteForm.tsx`
- **Quote + line items**
  - Quote/QuoteLine models: `api/prisma/schema.prisma` → `Quote`, `QuoteLine`
  - Quote routes: `api/src/routes/quotes.ts`
  - Quote builder UI: `web/src/app/quotes/[id]/page.tsx`
  - Line item editing: `web/src/components/quotes/ParsedLinesTable.tsx`
- **3D Configurator**
  - Configurator UI: `web/src/components/configurator/ProductConfigurator3D.tsx`
  - Parametric pipeline: `web/src/lib/scene/builder-registry.ts`, `web/src/types/parametric-builder.ts`
  - Scene persistence: `web/src/components/configurator/ProductConfigurator3D.tsx` → `/api/scene-state`
- **Pricing**
  - Pricing endpoint: `api/src/routes/quotes.ts` → `POST /quotes/:id/price`
  - Questionnaire-based pricing service: `api/src/services/quoteCosting.ts`
- **PDF generation**
  - PDF renderers: `api/src/routes/quotes.ts` → `POST /quotes/:id/render-pdf` + `/render-proposal`
  - PDF HTML builder: `api/src/routes/quotes.ts` → `buildQuoteProposalHtml`
- **Email send**
  - Email endpoint: `api/src/routes/quotes.ts` → `POST /quotes/:id/send-email`
  - Email sender: `api/src/services/email-sender.ts`, `api/src/services/user-email.ts`

## Source-of-truth fields

- **Client details**
  - Primary: `Lead` (`contactName`, `email`, `phone`, `address`, `location`)
  - Secondary: `Lead.custom` (questionnaire answers) via `web/src/app/quotes/[id]/page.tsx`
- **Project/site address**
  - Primary: `Lead.address` / `Lead.location`
  - Secondary: `Lead.custom.siteAddress` if present
- **Dimensions**
  - Primary: `QuoteLine.lineStandard` (`widthMm`, `heightMm`, `thicknessMm`)
  - Secondary: `QuoteLine.meta` (`widthMm`, `heightMm`, `depthMm`)
- **Configured product**
  - Instance overrides: `QuoteLine.meta.configuredProductParams`
  - Template defaults: `ProductType` template config (via `/api/product-type/template-config`)

## Line item creation & storage

- Manual entry: `POST /quotes/:id/lines` → `api/src/routes/quotes.ts`
- ML estimate: `POST /quotes/:id/price` (method `ml`) → distributes totals across `QuoteLine.meta.sellUnitGBP/sellTotalGBP`
- Supplier/client quote parse:
  - `POST /quotes/:id/parse` → creates `QuoteLine` rows
  - `POST /quotes/:id/lines/save-processed` → persists client-quote totals
- Configurator edits:
  - `ProductConfigurator3D` persists to `/api/scene-state` and patches `QuoteLine.lineStandard` + `QuoteLine.meta.configuredProductParams`

## Totals computation

- Single source: `api/src/services/quote-totals.ts` → `recalculateQuoteTotals()`
- Subtotal uses `QuoteLine.meta.sellTotalGBP` (or fallback to `sellUnitGBP`, `lineTotalGBP`, margin-based)
- VAT: `tenantSettings.quoteDefaults.vatRate` with `showVat`

## Runtime validation + safeguards

- Quote draft normalization: `web/src/lib/quoteDraft.ts`
- Line item param guards: `web/src/lib/scene/builder-registry.ts` (fallback to defaults)
- PDF/email validation: `api/src/services/quote-totals.ts`

## Pricing breakdown audit trail

- Stored per line item in `QuoteLine.meta.pricingBreakdown` with:
  - `method` (`Margin`, `ML`, `Supplier Markup`)
  - `inputs`, `outputs`, `assumptions`, `timestamp`
