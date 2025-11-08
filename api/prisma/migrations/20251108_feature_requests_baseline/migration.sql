-- CreateEnum
CREATE TYPE "FeatureStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'READY_FOR_REVIEW', 'APPROVED', 'REJECTED', 'APPLIED', 'FAILED');

-- CreateEnum
CREATE TYPE "FeatureCategory" AS ENUM ('UI', 'COPY', 'PRICING', 'ANALYTICS', 'INTEGRATION', 'OTHER');

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_resolvedById_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Feedback" DROP CONSTRAINT "Feedback_userId_fkey";

-- DropForeignKey
ALTER TABLE "FollowUpEvent" DROP CONSTRAINT "FollowUpEvent_leadId_fkey";

-- DropForeignKey
ALTER TABLE "FollowUpEvent" DROP CONSTRAINT "FollowUpEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "FollowUpTemplate" DROP CONSTRAINT "FollowUpTemplate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ModelOverride" DROP CONSTRAINT "ModelOverride_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ProcessPlan" DROP CONSTRAINT "ProcessPlan_assignee_fkey";

-- DropForeignKey
ALTER TABLE "SourceSpend" DROP CONSTRAINT "SourceSpend_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Target" DROP CONSTRAINT "Target_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TimeEntry" DROP CONSTRAINT "TimeEntry_user_fkey";

-- DropForeignKey
ALTER TABLE "TrainingEvent" DROP CONSTRAINT "TrainingEvent_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TrainingInsights" DROP CONSTRAINT "TrainingInsights_tenantId_fkey";

-- AlterTable
ALTER TABLE "AutomationRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Estimate" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Feedback" ALTER COLUMN "resolvedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "FollowUpEvent" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FollowUpTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InferenceEvent" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "estimatedValue" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "quotedValue" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "MLTrainingSample" ADD COLUMN     "fileId" TEXT,
ADD COLUMN     "quoteId" TEXT,
ADD COLUMN     "sourceType" TEXT NOT NULL DEFAULT 'supplier_quote';

-- AlterTable
ALTER TABLE "ModelOverride" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ModelVersion" ADD COLUMN     "versionId" TEXT,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ParsedSupplierLine" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ProcessPlan" ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SignupToken" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "googleAdsCustomerId" TEXT,
ADD COLUMN     "googleAdsRefreshToken" TEXT,
ADD COLUMN     "homeUrl" TEXT,
ADD COLUMN     "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "serviceAreas" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "targetCPL" DECIMAL(65,30) DEFAULT 50,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TenantSettings" ALTER COLUMN "taskPlaybook" DROP NOT NULL;

-- AlterTable
ALTER TABLE "TimeEntry" ALTER COLUMN "date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "hours" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrainingEvent" ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrainingInsights" ALTER COLUMN "lastUpdated" SET NOT NULL,
ALTER COLUMN "lastUpdated" DROP DEFAULT,
ALTER COLUMN "lastUpdated" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "TrainingRun" ADD COLUMN     "datasetCount" INTEGER,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "startedAt" TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- DropTable
DROP TABLE "lead_classifier_retraining_log";

-- DropTable
DROP TABLE "lead_classifier_training";

-- DropTable
DROP TABLE "ml_models";

-- DropTable
DROP TABLE "ml_training_data";

-- DropTable
DROP TABLE "ml_training_history";

-- CreateTable
CREATE TABLE "FeatureRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "FeatureCategory" NOT NULL DEFAULT 'OTHER',
    "status" "FeatureStatus" NOT NULL DEFAULT 'OPEN',
    "allowedFiles" JSONB,
    "priority" INTEGER,
    "patchText" TEXT,
    "branchName" TEXT,
    "prUrl" TEXT,
    "checksStatus" TEXT,
    "logs" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingLead" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "projectType" TEXT NOT NULL,
    "propertyType" TEXT NOT NULL,
    "message" TEXT,
    "userAgent" TEXT,
    "ip" TEXT,

    CONSTRAINT "LandingLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTenant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT,
    "homeUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "brandColor" TEXT,
    "logoUrl" TEXT,
    "headline" TEXT,
    "subhead" TEXT,
    "urgencyBanner" TEXT,
    "ctaText" TEXT DEFAULT 'Get Your Free Quote',
    "guarantees" JSONB,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingTenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTenantContent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "headline" TEXT,
    "subhead" TEXT,
    "priceFromText" TEXT,
    "priceRange" TEXT,
    "guarantees" TEXT,
    "urgency" TEXT,
    "faqJson" TEXT,
    "leadMagnet" TEXT,
    "serviceAreas" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingTenantContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTenantImage" (
    "id" TEXT NOT NULL,
    "landingTenantId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingTenantImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingTenantReview" (
    "id" TEXT NOT NULL,
    "landingTenantId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingTenantReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordPerformance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "cost" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "ctr" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "conversionRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "cpl" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "qualityScore" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isUnderperforming" BOOLEAN NOT NULL DEFAULT false,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KeywordPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KeywordSuggestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "suggestedFor" TEXT NOT NULL,
    "oldText" TEXT,
    "newText" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "conversionRate" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "KeywordSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAdsConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "googleAdsCustomerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantAdsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeatureRequest_tenantId_status_idx" ON "FeatureRequest"("tenantId", "status");

-- CreateIndex
CREATE INDEX "LandingLead_email_source_createdAt_idx" ON "LandingLead"("email", "source", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LandingTenant_tenantId_key" ON "LandingTenant"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingTenant_slug_key" ON "LandingTenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "LandingTenantContent_tenantId_key" ON "LandingTenantContent"("tenantId");

-- CreateIndex
CREATE INDEX "LandingTenantImage_landingTenantId_order_idx" ON "LandingTenantImage"("landingTenantId", "order");

-- CreateIndex
CREATE INDEX "LandingTenantReview_landingTenantId_order_idx" ON "LandingTenantReview"("landingTenantId", "order");

-- CreateIndex
CREATE INDEX "KeywordPerformance_tenantId_isUnderperforming_idx" ON "KeywordPerformance"("tenantId", "isUnderperforming");

-- CreateIndex
CREATE INDEX "KeywordPerformance_weekStartDate_idx" ON "KeywordPerformance"("weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "KeywordPerformance_tenantId_keyword_weekStartDate_key" ON "KeywordPerformance"("tenantId", "keyword", "weekStartDate");

-- CreateIndex
CREATE INDEX "KeywordSuggestion_tenantId_status_idx" ON "KeywordSuggestion"("tenantId", "status");

-- CreateIndex
CREATE INDEX "KeywordSuggestion_createdAt_idx" ON "KeywordSuggestion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAdsConfig_tenantId_key" ON "TenantAdsConfig"("tenantId");

-- CreateIndex
CREATE INDEX "TenantAdsConfig_googleAdsCustomerId_idx" ON "TenantAdsConfig"("googleAdsCustomerId");

-- CreateIndex
CREATE INDEX "MLTrainingSample_tenantId_createdAt_idx" ON "MLTrainingSample"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MLTrainingSample_tenantId_quoteId_key" ON "MLTrainingSample"("tenantId", "quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ModelVersion_versionId_key" ON "ModelVersion"("versionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- RenameForeignKey
ALTER TABLE "ProcessPlan" RENAME CONSTRAINT "ProcessPlan_project_fkey" TO "ProcessPlan_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "ProcessPlan" RENAME CONSTRAINT "ProcessPlan_tenant_fkey" TO "ProcessPlan_tenantId_fkey";

-- RenameForeignKey
ALTER TABLE "TimeEntry" RENAME CONSTRAINT "TimeEntry_project_fkey" TO "TimeEntry_projectId_fkey";

-- RenameForeignKey
ALTER TABLE "TimeEntry" RENAME CONSTRAINT "TimeEntry_tenant_fkey" TO "TimeEntry_tenantId_fkey";

-- AddForeignKey
ALTER TABLE "FeatureRequest" ADD CONSTRAINT "FeatureRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpTemplate" ADD CONSTRAINT "FollowUpTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpEvent" ADD CONSTRAINT "FollowUpEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceSpend" ADD CONSTRAINT "SourceSpend_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingInsights" ADD CONSTRAINT "TrainingInsights_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModelOverride" ADD CONSTRAINT "ModelOverride_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEvent" ADD CONSTRAINT "TrainingEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessPlan" ADD CONSTRAINT "ProcessPlan_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeEntry" ADD CONSTRAINT "TimeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Target" ADD CONSTRAINT "Target_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingTenant" ADD CONSTRAINT "LandingTenant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingTenantContent" ADD CONSTRAINT "LandingTenantContent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "LandingTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingTenantImage" ADD CONSTRAINT "LandingTenantImage_landingTenantId_fkey" FOREIGN KEY ("landingTenantId") REFERENCES "LandingTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingTenantReview" ADD CONSTRAINT "LandingTenantReview_landingTenantId_fkey" FOREIGN KEY ("landingTenantId") REFERENCES "LandingTenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordPerformance" ADD CONSTRAINT "KeywordPerformance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KeywordSuggestion" ADD CONSTRAINT "KeywordSuggestion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "Estimate_tenant_created_idx" RENAME TO "Estimate_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "Estimate_tenant_quote_idx" RENAME TO "Estimate_tenantId_quoteId_idx";

-- RenameIndex
ALTER INDEX "InferenceEvent_tenant_created_idx" RENAME TO "InferenceEvent_tenantId_createdAt_idx";

-- RenameIndex
ALTER INDEX "InferenceEvent_tenant_model_created_idx" RENAME TO "InferenceEvent_tenantId_model_createdAt_idx";

-- RenameIndex
ALTER INDEX "ModelOverride_tenant_module_key_idx" RENAME TO "ModelOverride_tenantId_module_key_idx";

-- RenameIndex
ALTER INDEX "ParsedSupplierLine_tenant_quote_idx" RENAME TO "ParsedSupplierLine_tenantId_quoteId_idx";

-- RenameIndex
ALTER INDEX "ParsedSupplierLine_tenant_supplier_idx" RENAME TO "ParsedSupplierLine_tenantId_supplier_idx";

-- RenameIndex
ALTER INDEX "ProcessPlan_tenant_assignee_idx" RENAME TO "ProcessPlan_tenantId_assignedUserId_idx";

-- RenameIndex
ALTER INDEX "ProcessPlan_tenant_project_process_key" RENAME TO "ProcessPlan_tenantId_projectId_process_key";

-- RenameIndex
ALTER INDEX "TimeEntry_tenant_date_idx" RENAME TO "TimeEntry_tenantId_date_idx";

-- RenameIndex
ALTER INDEX "TimeEntry_tenant_project_process_idx" RENAME TO "TimeEntry_tenantId_projectId_process_idx";

-- RenameIndex
ALTER INDEX "TrainingEvent_tenant_module_kind_createdAt_idx" RENAME TO "TrainingEvent_tenantId_module_kind_createdAt_idx";

-- RenameIndex
ALTER INDEX "TrainingInsights_tenant_module_createdAt_idx" RENAME TO "TrainingInsights_tenantId_module_createdAt_idx";

-- RenameIndex
ALTER INDEX "TrainingRun_model_created_idx" RENAME TO "TrainingRun_model_createdAt_idx";

-- RenameIndex
ALTER INDEX "TrainingRun_tenant_created_idx" RENAME TO "TrainingRun_tenantId_createdAt_idx";

