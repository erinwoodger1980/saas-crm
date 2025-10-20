-- Reset the schema so the migration can run even if previous attempts left partial tables.
-- Safe at this point because the deploy script now wipes the database before rerunning when
-- necessary and production does not yet contain tenant data.
DROP SCHEMA IF EXISTS "public" CASCADE;
CREATE SCHEMA "public";
SET search_path TO "public";

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'paused');

-- CreateEnum
CREATE TYPE "Plan" AS ENUM ('monthly', 'annual');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED', 'INFO_REQUESTED', 'REJECTED', 'READY_TO_QUOTE', 'QUOTE_SENT', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "OppStage" AS ENUM ('QUALIFY', 'PROPOSE', 'NEGOTIATE', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadLabel" AS ENUM ('LEAD', 'NOT_LEAD', 'UNSURE');

-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FileKind" AS ENUM ('SUPPLIER_QUOTE', 'OTHER');

-- CreateEnum
CREATE TYPE "RelatedType" AS ENUM ('LEAD', 'PROJECT', 'QUOTE', 'EMAIL', 'QUESTIONNAIRE', 'WORKSHOP', 'OTHER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "AssigneeRole" AS ENUM ('OWNER', 'FOLLOWER');

-- CreateEnum
CREATE TYPE "SubtaskStatus" AS ENUM ('OPEN', 'DONE');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('TASK_ASSIGNED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'MENTION', 'STREAK', 'SUMMARY');

-- CreateEnum
CREATE TYPE "ActivityEntity" AS ENUM ('TASK', 'RULE', 'PROJECT');

-- CreateEnum
CREATE TYPE "ActivityVerb" AS ENUM ('CREATED', 'ASSIGNED', 'STARTED', 'COMPLETED', 'REOPENED', 'OVERDUE', 'NUDGED');

-- CreateTable
CREATE TABLE "Tenant" (
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
    "subscriptionStatus" "SubscriptionStatus",
    "plan" "Plan",

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'user',
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "email" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nextActionAt" TIMESTAMP(3),
    "nextAction" TEXT,
    "briefJson" JSONB,
    "custom" JSONB,
    "description" TEXT,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Opportunity" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "valueGBP" DECIMAL(65,30),
    "stage" "OppStage" NOT NULL DEFAULT 'QUALIFY',
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Opportunity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailIngest" (
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
CREATE TABLE "LeadFieldDef" (
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
CREATE TABLE "GmailTenantConnection" (
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
CREATE TABLE "Ms365TenantConnection" (
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
CREATE TABLE "LeadExample" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "extracted" JSONB,
    "label" "LeadLabel" NOT NULL DEFAULT 'UNSURE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadTrainingExample" (
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
CREATE TABLE "TenantSettings" (
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
    "beta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "TenantSettings_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "FollowUpLog" (
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
CREATE TABLE "LeadSourceCost" (
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
CREATE TABLE "LeadSourceSpend" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "month" TIMESTAMP(3) NOT NULL,
    "amountGBP" DECIMAL(65,30) NOT NULL DEFAULT 0,

    CONSTRAINT "LeadSourceSpend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadSourceConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "scalable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LeadSourceConfig_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "leadId" TEXT,
    "title" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
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
CREATE TABLE "QuoteLine" (
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
CREATE TABLE "UploadedFile" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT,
    "kind" "FileKind" NOT NULL,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UploadedFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "MLTrainingSample" (
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
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "feature" TEXT NOT NULL,
    "rating" INTEGER,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "relatedType" "RelatedType" NOT NULL,
    "relatedId" TEXT,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "autocreated" BOOLEAN NOT NULL DEFAULT true,
    "meta" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssigneeRole" NOT NULL DEFAULT 'OWNER',

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "Subtask" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "SubtaskStatus" NOT NULL DEFAULT 'OPEN',
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Subtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" JSONB NOT NULL,
    "conditions" JSONB,
    "actions" JSONB NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "payload" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayCount" INTEGER NOT NULL DEFAULT 0,
    "lastActivityDate" TIMESTAMP(3),

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entity" "ActivityEntity" NOT NULL,
    "entityId" TEXT NOT NULL,
    "verb" "ActivityVerb" NOT NULL,
    "actorId" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notifications" JSONB,
    "quietHours" JSONB,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Opportunity_leadId_key" ON "Opportunity"("leadId");

-- CreateIndex
CREATE INDEX "Opportunity_tenantId_stage_idx" ON "Opportunity"("tenantId", "stage");

-- CreateIndex
CREATE INDEX "EmailIngest_tenantId_idx" ON "EmailIngest"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngest_tenantId_provider_messageId_key" ON "EmailIngest"("tenantId", "provider", "messageId");

-- CreateIndex
CREATE INDEX "LeadFieldDef_tenantId_sortOrder_idx" ON "LeadFieldDef"("tenantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeadFieldDef_tenantId_key_key" ON "LeadFieldDef"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "GmailTenantConnection_tenantId_key" ON "GmailTenantConnection"("tenantId");

-- CreateIndex
CREATE INDEX "GmailTenantConnection_tenantId_idx" ON "GmailTenantConnection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Ms365TenantConnection_tenantId_key" ON "Ms365TenantConnection"("tenantId");

-- CreateIndex
CREATE INDEX "Ms365TenantConnection_tenantId_idx" ON "Ms365TenantConnection"("tenantId");

-- CreateIndex
CREATE INDEX "LeadExample_tenantId_provider_messageId_idx" ON "LeadExample"("tenantId", "provider", "messageId");

-- CreateIndex
CREATE INDEX "LeadTrainingExample_tenantId_provider_messageId_idx" ON "LeadTrainingExample"("tenantId", "provider", "messageId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSettings_slug_key" ON "TenantSettings"("slug");

-- CreateIndex
CREATE INDEX "FollowUpLog_tenantId_leadId_sentAt_idx" ON "FollowUpLog"("tenantId", "leadId", "sentAt");

-- CreateIndex
CREATE INDEX "LeadSourceCost_tenantId_source_month_idx" ON "LeadSourceCost"("tenantId", "source", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceCost_tenantId_source_month_key" ON "LeadSourceCost"("tenantId", "source", "month");

-- CreateIndex
CREATE INDEX "LeadSourceSpend_tenantId_source_month_idx" ON "LeadSourceSpend"("tenantId", "source", "month");

-- CreateIndex
CREATE UNIQUE INDEX "LeadSourceConfig_tenantId_source_key" ON "LeadSourceConfig"("tenantId", "source");

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

-- CreateIndex
CREATE INDEX "Quote_tenantId_leadId_idx" ON "Quote"("tenantId", "leadId");

-- CreateIndex
CREATE INDEX "QuoteLine_quoteId_idx" ON "QuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "UploadedFile_tenantId_quoteId_idx" ON "UploadedFile"("tenantId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "MLTrainingSample_tenantId_idx" ON "MLTrainingSample"("tenantId");

-- CreateIndex
CREATE INDEX "MLTrainingSample_messageId_idx" ON "MLTrainingSample"("messageId");

-- CreateIndex
CREATE INDEX "MLTrainingSample_attachmentId_idx" ON "MLTrainingSample"("attachmentId");

-- CreateIndex
CREATE INDEX "MLTrainingSample_quotedAt_idx" ON "MLTrainingSample"("quotedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MLTrainingSample_tenantId_messageId_attachmentId_key" ON "MLTrainingSample"("tenantId", "messageId", "attachmentId");

-- CreateIndex
CREATE INDEX "Feedback_tenantId_feature_createdAt_idx" ON "Feedback"("tenantId", "feature", "createdAt");

-- CreateIndex
CREATE INDEX "Task_tenantId_status_dueAt_idx" ON "Task"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_tenantId_relatedType_relatedId_idx" ON "Task"("tenantId", "relatedType", "relatedId");

-- CreateIndex
CREATE INDEX "Subtask_taskId_idx" ON "Subtask"("taskId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_enabled_idx" ON "AutomationRule"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "Notification_tenantId_userId_readAt_idx" ON "Notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "Streak_tenantId_userId_key" ON "Streak"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_entity_entityId_idx" ON "ActivityLog"("tenantId", "entity", "entityId");

-- CreateIndex
CREATE INDEX "ActivityLog_tenantId_verb_idx" ON "ActivityLog"("tenantId", "verb");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_tenantId_userId_key" ON "UserPreference"("tenantId", "userId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadFieldDef" ADD CONSTRAINT "LeadFieldDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ms365TenantConnection" ADD CONSTRAINT "Ms365TenantConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ms365TenantConnection" ADD CONSTRAINT "Ms365TenantConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailThread" ADD CONSTRAINT "EmailThread_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailMessage" ADD CONSTRAINT "EmailMessage_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "EmailThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UploadedFile" ADD CONSTRAINT "UploadedFile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subtask" ADD CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
