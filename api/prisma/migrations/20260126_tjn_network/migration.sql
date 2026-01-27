-- CreateEnum
CREATE TYPE "NetworkMemberStatus" AS ENUM ('PENDING', 'AUTHORISED', 'REJECTED', 'SUSPENDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('TEST_REPORT', 'CERTIFICATE', 'TECHNICAL_FILE', 'SPECIFICATION', 'DECLARATION', 'PROCEDURE', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "DoPStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FpcStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('IN_PROGRESS', 'SIGNED_OFF', 'REJECTED');

-- CreateEnum
CREATE TYPE "CompliancePackStatus" AS ENUM ('GENERATED', 'ARCHIVED');

-- DropTable
DROP TABLE "lead_classifier_retraining_log";

-- CreateTable
CREATE TABLE "Network" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Network_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkMember" (
    "id" TEXT NOT NULL,
    "networkId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "NetworkMemberStatus" NOT NULL DEFAULT 'PENDING',
    "requestedByUserId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "taskId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "NetworkMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "networkId" TEXT,
    "productTypeId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "fileId" TEXT,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoP" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "productTypeId" TEXT NOT NULL,
    "status" "DoPStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "performance" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoPEvidence" (
    "dopId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "DoPEvidence_pkey" PRIMARY KEY ("dopId","evidenceId")
);

-- CreateTable
CREATE TABLE "Fpc" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "FpcStatus" NOT NULL DEFAULT 'DRAFT',
    "version" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "details" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fpc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FpcEvidence" (
    "fpcId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FpcEvidence_pkey" PRIMARY KEY ("fpcId","evidenceId")
);

-- CreateTable
CREATE TABLE "ProjectCompliance" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fpcId" TEXT,
    "status" "ComplianceStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "goodInChecks" JSONB,
    "signedOffAt" TIMESTAMP(3),
    "signedByUserId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompliancePack" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fileId" TEXT,
    "status" "CompliancePackStatus" NOT NULL DEFAULT 'GENERATED',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CompliancePack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Network_slug_key" ON "Network"("slug");

-- CreateIndex
CREATE INDEX "Network_tenantId_idx" ON "Network"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkMember_taskId_key" ON "NetworkMember"("taskId");

-- CreateIndex
CREATE INDEX "NetworkMember_networkId_status_idx" ON "NetworkMember"("networkId", "status");

-- CreateIndex
CREATE INDEX "NetworkMember_tenantId_status_idx" ON "NetworkMember"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkMember_networkId_tenantId_key" ON "NetworkMember"("networkId", "tenantId");

-- CreateIndex
CREATE INDEX "Evidence_tenantId_idx" ON "Evidence"("tenantId");

-- CreateIndex
CREATE INDEX "Evidence_networkId_idx" ON "Evidence"("networkId");

-- CreateIndex
CREATE INDEX "Evidence_productTypeId_idx" ON "Evidence"("productTypeId");

-- CreateIndex
CREATE INDEX "Evidence_kind_idx" ON "Evidence"("kind");

-- CreateIndex
CREATE INDEX "DoP_tenantId_productTypeId_status_idx" ON "DoP"("tenantId", "productTypeId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DoP_tenantId_productTypeId_version_key" ON "DoP"("tenantId", "productTypeId", "version");

-- CreateIndex
CREATE INDEX "DoPEvidence_evidenceId_idx" ON "DoPEvidence"("evidenceId");

-- CreateIndex
CREATE INDEX "Fpc_tenantId_status_idx" ON "Fpc"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Fpc_tenantId_version_key" ON "Fpc"("tenantId", "version");

-- CreateIndex
CREATE INDEX "FpcEvidence_evidenceId_idx" ON "FpcEvidence"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectCompliance_projectId_key" ON "ProjectCompliance"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCompliance_tenantId_status_idx" ON "ProjectCompliance"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ProjectCompliance_fpcId_idx" ON "ProjectCompliance"("fpcId");

-- CreateIndex
CREATE INDEX "CompliancePack_tenantId_idx" ON "CompliancePack"("tenantId");

-- CreateIndex
CREATE INDEX "CompliancePack_projectId_idx" ON "CompliancePack"("projectId");

-- AddForeignKey
ALTER TABLE "Network" ADD CONSTRAINT "Network_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMember" ADD CONSTRAINT "NetworkMember_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_networkId_fkey" FOREIGN KEY ("networkId") REFERENCES "Network"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoP" ADD CONSTRAINT "DoP_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoP" ADD CONSTRAINT "DoP_productTypeId_fkey" FOREIGN KEY ("productTypeId") REFERENCES "ProductType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoPEvidence" ADD CONSTRAINT "DoPEvidence_dopId_fkey" FOREIGN KEY ("dopId") REFERENCES "DoP"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoPEvidence" ADD CONSTRAINT "DoPEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fpc" ADD CONSTRAINT "Fpc_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpcEvidence" ADD CONSTRAINT "FpcEvidence_fpcId_fkey" FOREIGN KEY ("fpcId") REFERENCES "Fpc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FpcEvidence" ADD CONSTRAINT "FpcEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompliance" ADD CONSTRAINT "ProjectCompliance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompliance" ADD CONSTRAINT "ProjectCompliance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompliance" ADD CONSTRAINT "ProjectCompliance_fpcId_fkey" FOREIGN KEY ("fpcId") REFERENCES "Fpc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCompliance" ADD CONSTRAINT "ProjectCompliance_signedByUserId_fkey" FOREIGN KEY ("signedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePack" ADD CONSTRAINT "CompliancePack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePack" ADD CONSTRAINT "CompliancePack_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompliancePack" ADD CONSTRAINT "CompliancePack_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "UploadedFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

