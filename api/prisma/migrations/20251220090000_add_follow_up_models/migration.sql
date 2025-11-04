-- Add FollowUpTemplate, FollowUpEvent, and SourceSpend tables

CREATE TABLE "FollowUpTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "tone" TEXT,
  "delayDays" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "variant" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUpTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowUpTemplate_tenantId_key_key" ON "FollowUpTemplate"("tenantId", "key");

CREATE TABLE "FollowUpEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "quoteId" TEXT,
  "variant" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "openedAt" TIMESTAMP(3),
  "repliedAt" TIMESTAMP(3),
  "convertedAt" TIMESTAMP(3),
  "result" TEXT,
  "source" TEXT,
  "pixelToken" TEXT,
  "costPence" INTEGER,
  "meta" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FollowUpEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FollowUpEvent_pixelToken_key" ON "FollowUpEvent"("pixelToken");
CREATE INDEX "FollowUpEvent_tenantId_leadId_scheduledAt_idx" ON "FollowUpEvent"("tenantId", "leadId", "scheduledAt");

CREATE TABLE "SourceSpend" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "spendPence" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SourceSpend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SourceSpend_tenantId_source_periodStart_periodEnd_idx"
  ON "SourceSpend"("tenantId", "source", "periodStart", "periodEnd");

ALTER TABLE "FollowUpTemplate"
  ADD CONSTRAINT "FollowUpTemplate_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUpEvent"
  ADD CONSTRAINT "FollowUpEvent_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUpEvent"
  ADD CONSTRAINT "FollowUpEvent_leadId_fkey"
  FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowUpEvent"
  ADD CONSTRAINT "FollowUpEvent_quoteId_fkey"
  FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SourceSpend"
  ADD CONSTRAINT "SourceSpend_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
