-- CreateEnum
CREATE TYPE "LeadLabel" AS ENUM ('LEAD', 'NOT_LEAD', 'UNSURE');

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "custom" JSONB;

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

-- CreateIndex
CREATE UNIQUE INDEX "EmailIngest_tenantId_provider_messageId_key" ON "EmailIngest"("tenantId", "provider", "messageId");

-- CreateIndex
CREATE INDEX "LeadFieldDef_tenantId_sortOrder_idx" ON "LeadFieldDef"("tenantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeadFieldDef_tenantId_key_key" ON "LeadFieldDef"("tenantId", "key");

-- CreateIndex
CREATE INDEX "GmailTenantConnection_tenantId_idx" ON "GmailTenantConnection"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GmailTenantConnection_tenantId_key" ON "GmailTenantConnection"("tenantId");

-- CreateIndex
CREATE INDEX "LeadExample_tenantId_provider_messageId_idx" ON "LeadExample"("tenantId", "provider", "messageId");

-- CreateIndex
CREATE INDEX "LeadTrainingExample_tenantId_provider_messageId_idx" ON "LeadTrainingExample"("tenantId", "provider", "messageId");

-- AddForeignKey
ALTER TABLE "LeadFieldDef" ADD CONSTRAINT "LeadFieldDef_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GmailTenantConnection" ADD CONSTRAINT "GmailTenantConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
