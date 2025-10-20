-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."FileKind" AS ENUM ('SUPPLIER_QUOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LeadLabel" AS ENUM ('LEAD', 'NOT_LEAD', 'UNSURE');

-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'INFO_REQUESTED', 'REJECTED', 'READY_TO_QUOTE', 'QUOTE_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "public"."OppStage" AS ENUM ('QUALIFY', 'PROPOSE', 'NEGOTIATE', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "public"."Plan" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "public"."QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused');

-- CreateTable
CREATE TABLE "public"."EmailIngest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "fromEmail" TEXT,
    "subject" TEXT,
    "snippet" TEXT,
    "processedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiPredictedIsLead" BOOLEAN,
    "userLabelIsLead" BOOLEAN,
    "userLabeledAt" TIMESTAMP(3),

    CONSTRAINT "EmailIngest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailMessage" (
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

-- CreateTable
CREATE TABLE "public"."EmailThread" (
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
CREATE TABLE "public"."FollowUpLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "opened" BOOLEAN,
    "replied" BOOLEAN,
    "converted" BOOLEAN,
    "delayDays" INTEGER,
    "messageId" TEXT,
    "provider" TEXT,
    "threadId" TEXT,

    CONSTRAINT "FollowUpLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FollowupExperiment" (
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
CREATE TABLE "public"."GmailTenantConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectedById" TEXT,
    "gmailAddress" TEXT,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GmailTenantConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "briefJson" JSONB,
    "custom" JSONB,
    "description" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadExample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "extracted" JSONB,
    "label" "public"."LeadLabel" NOT NULL DEFAULT 'UNSURE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadFieldDef" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LeadFieldDef_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadSourceConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scalable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSourceConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadSourceCost" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "scalable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSourceCost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadSourceSpend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amountGBP" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "LeadSourceSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadTrainingExample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "extracted" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadTrainingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."MLTrainingSample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "attachmentId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "quotedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MLTrainingSample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ms365TenantConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "connectedById" TEXT,
    "ms365Address" TEXT,
    "refreshToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ms365TenantConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "valueGBP" DECIMAL(65,30),
    "stage" "public"."OppStage" NOT NULL DEFAULT 'QUALIFY',
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "public"."Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "status" "public"."QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "exchangeRate" DECIMAL(65,30),
    "deliveryCost" DECIMAL(65,30) DEFAULT 0,
    "markupDefault" DECIMAL(65,30) DEFAULT 0,
    "subtotalMaterialGBP" DECIMAL(65,30) DEFAULT 0,
    "subtotalLabourGBP" DECIMAL(65,30) DEFAULT 0,
    "subtotalOtherGBP" DECIMAL(65,30) DEFAULT 0,
    "totalGBP" DECIMAL(65,30) DEFAULT 0,
    "proposalPdfUrl" TEXT,
    "notes" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "supplier" TEXT,
    "sku" TEXT,
    "description" TEXT NOT NULL,
    "qty" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "deliveryShareGBP" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "lineTotalGBP" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "meta" JSONB,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "trialEndsAt" TIMESTAMP(3),
    "discountCodeUsed" TEXT,
    "seatsOffice" INTEGER NOT NULL DEFAULT 5,
    "seatsWorkshop" INTEGER NOT NULL DEFAULT 10,
    "seatsDisplay" INTEGER NOT NULL DEFAULT 2,
    "subscriptionStatus" "public"."SubscriptionStatus",
    "plan" "public"."Plan",

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TenantSettings" (
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "introHtml" TEXT,
    "website" TEXT,
    "phone" TEXT,
    "links" JSONB,
    "questionnaire" JSONB,
    "logoUrl" TEXT,
    "inbox" JSONB,
    "inboxLastRun" TIMESTAMP(3),
    "inboxWatchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quoteDefaults" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "public"."UploadedFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT,
    "kind" "public"."FileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailIngest_tenantId_idx" ON "public"."EmailIngest"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngest_tenantId_provider_messageId_key" ON "public"."EmailIngest"("tenantId" ASC, "provider" ASC, "messageId" ASC);

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_leadId_idx" ON "public"."EmailMessage"("tenantId" ASC, "leadId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailMessage_tenantId_provider_messageId_key" ON "public"."EmailMessage"("tenantId" ASC, "provider" ASC, "messageId" ASC);

-- CreateIndex
CREATE INDEX "EmailMessage_tenantId_threadId_sentAt_idx" ON "public"."EmailMessage"("tenantId" ASC, "threadId" ASC, "sentAt" ASC);

-- CreateIndex
CREATE INDEX "EmailThread_tenantId_leadId_idx" ON "public"."EmailThread"("tenantId" ASC, "leadId" ASC);

-- CreateIndex
CREATE INDEX "EmailThread_tenantId_opportunityId_idx" ON "public"."EmailThread"("tenantId" ASC, "opportunityId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EmailThread_tenantId_provider_threadId_key" ON "public"."EmailThread"("tenantId" ASC, "provider" ASC, "threadId" ASC);

-- CreateIndex
CREATE INDEX "FollowUpLog_tenantId_leadId_sentAt_idx" ON "public"."FollowUpLog"("tenantId" ASC, "leadId" ASC, "sentAt" ASC);

-- CreateIndex
CREATE INDEX "FollowupExperiment_tenantId_opportunityId_idx" ON "public"."FollowupExperiment"("tenantId" ASC, "opportunityId" ASC);

-- CreateIndex
CREATE INDEX "GmailTenantConnection_tenantId_idx" ON "public"."GmailTenantConnection"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "GmailTenantConnection_tenantId_key" ON "public"."GmailTenantConnection"("tenantId" ASC);

-- CreateIndex
CREATE INDEX "LeadExample_tenantId_provider_messageId_idx" ON "public"."LeadExample"("tenantId" ASC, "provider" ASC, "messageId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LeadFieldDef_tenantId_key_key" ON "public"."LeadFieldDef"("tenantId" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "LeadFieldDef_tenantId_sortOrder_idx" ON "public"."LeadFieldDef"("tenantId" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceConfig_tenantId_source_key" ON "public"."LeadSourceConfig"("tenantId" ASC, "source" ASC);

-- CreateIndex
CREATE INDEX "LeadSourceCost_tenantId_source_month_idx" ON "public"."LeadSourceCost"("tenantId" ASC, "source" ASC, "month" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceCost_tenantId_source_month_key" ON "public"."LeadSourceCost"("tenantId" ASC, "source" ASC, "month" ASC);

-- CreateIndex
CREATE INDEX "LeadSourceSpend_tenantId_source_month_idx" ON "public"."LeadSourceSpend"("tenantId" ASC, "source" ASC, "month" ASC);

-- CreateIndex
CREATE INDEX "LeadTrainingExample_tenantId_provider_messageId_idx" ON "public"."LeadTrainingExample"("tenantId" ASC, "provider" ASC, "messageId" ASC);

-- CreateIndex
CREATE INDEX "MLTrainingSample_attachmentId_idx" ON "public"."MLTrainingSample"("attachmentId" ASC);

-- CreateIndex
CREATE INDEX "MLTrainingSample_messageId_idx" ON "public"."MLTrainingSample"("messageId" ASC);

-- CreateIndex
CREATE INDEX "MLTrainingSample_quotedAt_idx" ON "public"."MLTrainingSample"("quotedAt" ASC);

-- CreateIndex
CREATE INDEX "MLTrainingSample_tenantId_idx" ON "public"."MLTrainingSample"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "MLTrainingSample_tenantId_messageId_attachmentId_key" ON "public"."MLTrainingSample"("tenantId" ASC, "messageId" ASC, "attachmentId" ASC);

-- CreateIndex
CREATE INDEX "Ms365TenantConnection_tenantId_idx" ON "public"."Ms365TenantConnection"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Ms365TenantConnection_tenantId_key" ON "public"."Ms365TenantConnection"("tenantId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_leadId_key" ON "public"."Opportunity"("leadId" ASC);

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "public"."Opportunity"("tenantId" ASC, "stage" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "public"."PasswordResetToken"("token" ASC);

-- CreateIndex
CREATE INDEX "Quote_tenantId_leadId_idx" ON "public"."Quote"("tenantId" ASC, "leadId" ASC);

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "public"."QuoteLine"("quoteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "public"."Tenant"("stripeCustomerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "public"."Tenant"("stripeSubscriptionId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_slug_key" ON "public"."TenantSettings"("slug" ASC);

-- CreateIndex
CREATE INDEX "UploadedFile_tenantId_quoteId_idx" ON "public"."UploadedFile"("tenantId" ASC, "quoteId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."EmailIngest" ADD CONSTRAINT "EmailIngest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailIngest" ADD CONSTRAINT "EmailIngest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "public"."EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailThread" ADD CONSTRAINT "EmailThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailThread" ADD CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "public"."Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailThread" ADD CONSTRAINT "EmailThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FollowUpLog" ADD CONSTRAINT "FollowUpLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LeadFieldDef" ADD CONSTRAINT "LeadFieldDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ms365TenantConnection" ADD CONSTRAINT "Ms365TenantConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ms365TenantConnection" ADD CONSTRAINT "Ms365TenantConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UploadedFile" ADD CONSTRAINT "UploadedFile_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "public"."Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UploadedFile" ADD CONSTRAINT "UploadedFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "public"."Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

