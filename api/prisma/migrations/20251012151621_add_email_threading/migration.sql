-- AlterTable
ALTER TABLE "FollowUpLog" ADD COLUMN     "messageId" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "threadId" TEXT;

-- CreateTable
CREATE TABLE "FollowupExperiment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "opportunityId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "suggestedAt" TIMESTAMP(3) NOT NULL,
    "whenISO" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "replied" BOOLEAN,
    "outcome" TEXT,

    CONSTRAINT "FollowupExperiment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailThread" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "subject" TEXT,
    "leadId" TEXT,
    "opportunityId" TEXT,
    "lastInboundAt" TIMESTAMP(3),
    "lastOutboundAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT,
    "toEmail" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "direction" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadId" TEXT,
    "opportunityId" TEXT,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowupExperiment_tenantId_opportunityId_idx" ON "FollowupExperiment"("tenantId", "opportunityId");

-- CreateIndex
CREATE INDEX "EmailThread_tenantId_leadId_idx" ON "EmailThread"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "EmailThread_tenantId_opportunityId_idx" ON "EmailThread"("tenantId", "opportunityId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_tenantId_provider_threadId_key" ON "EmailThread"("tenantId", "provider", "threadId");

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_threadId_sentAt_idx" ON "EmailMessage"("tenantId", "threadId", "sentAt");

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_leadId_idx" ON "EmailMessage"("tenantId", "leadId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_tenantId_provider_messageId_key" ON "EmailMessage"("tenantId", "provider", "messageId");

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
