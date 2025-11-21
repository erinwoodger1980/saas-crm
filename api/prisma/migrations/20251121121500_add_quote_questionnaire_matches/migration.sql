-- Persist smart-assistant questionnaire matches per quote
CREATE TABLE IF NOT EXISTS "QuoteQuestionnaireMatch" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "leadId" TEXT,
    "questionnaireItemId" TEXT NOT NULL,
    "questionnaireLabel" TEXT,
    "description" TEXT NOT NULL,
    "matchStatus" TEXT NOT NULL DEFAULT 'unmatched',
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "parsedRowId" TEXT,
    "rowPage" INTEGER,
    "rowBBox" JSONB,
    "imageBBox" JSONB,
    "widthMm" DOUBLE PRECISION,
    "heightMm" DOUBLE PRECISION,
    "thicknessMm" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION,
    "unitPrice" DOUBLE PRECISION,
    "lineTotal" DOUBLE PRECISION,
    "currency" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuoteQuestionnaireMatch_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "QuoteQuestionnaireMatch_tenant_quote_idx"
    ON "QuoteQuestionnaireMatch" ("tenantId", "quoteId");
CREATE INDEX IF NOT EXISTS "QuoteQuestionnaireMatch_quote_idx"
    ON "QuoteQuestionnaireMatch" ("quoteId");
CREATE INDEX IF NOT EXISTS "QuoteQuestionnaireMatch_lead_idx"
    ON "QuoteQuestionnaireMatch" ("leadId");

ALTER TABLE "QuoteQuestionnaireMatch"
    ADD CONSTRAINT "QuoteQuestionnaireMatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteQuestionnaireMatch"
    ADD CONSTRAINT "QuoteQuestionnaireMatch_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuoteQuestionnaireMatch"
    ADD CONSTRAINT "QuoteQuestionnaireMatch_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
