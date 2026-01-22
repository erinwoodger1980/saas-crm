-- Add stable ordering for quote lines
ALTER TABLE "QuoteLine" ADD COLUMN "sortIndex" INTEGER NOT NULL DEFAULT 0;

-- Helps fetch lines in a stable order per quote
CREATE INDEX "QuoteLine_quoteId_sortIndex_idx" ON "QuoteLine"("quoteId", "sortIndex");
