-- Migration: add_architect_pack_ingestion
-- Date: 2025-12-21
-- Description: Add ArchitectPack, ArchitectPackAnalysis, and ArchitectOpening tables

-- CreateTable: ArchitectPack
CREATE TABLE IF NOT EXISTS "ArchitectPack" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "base64Data" TEXT,
    "fileHash" TEXT,
    "fileSize" INTEGER,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchitectPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ArchitectPackAnalysis
CREATE TABLE IF NOT EXISTS "ArchitectPackAnalysis" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "json" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL DEFAULT 'v1',
    "pagesAnalyzed" INTEGER,
    "totalPages" INTEGER,
    "processingTime" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArchitectPackAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ArchitectOpening
CREATE TABLE IF NOT EXISTS "ArchitectOpening" (
    "id" TEXT NOT NULL,
    "analysisId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "widthMm" INTEGER NOT NULL,
    "heightMm" INTEGER NOT NULL,
    "locationHint" TEXT,
    "pageNumber" INTEGER,
    "notes" TEXT,
    "sillHeight" INTEGER,
    "glazingType" TEXT,
    "frameType" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "userConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "userModified" BOOLEAN NOT NULL DEFAULT false,
    "quoteLineId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArchitectOpening_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: ArchitectPack indexes
CREATE INDEX IF NOT EXISTS "ArchitectPack_tenantId_idx" ON "ArchitectPack"("tenantId");
CREATE INDEX IF NOT EXISTS "ArchitectPack_fileHash_idx" ON "ArchitectPack"("fileHash");
CREATE INDEX IF NOT EXISTS "ArchitectPack_createdAt_idx" ON "ArchitectPack"("createdAt");

-- CreateIndex: ArchitectPackAnalysis indexes
CREATE INDEX IF NOT EXISTS "ArchitectPackAnalysis_packId_idx" ON "ArchitectPackAnalysis"("packId");
CREATE INDEX IF NOT EXISTS "ArchitectPackAnalysis_createdAt_idx" ON "ArchitectPackAnalysis"("createdAt");

-- CreateIndex: ArchitectOpening indexes
CREATE INDEX IF NOT EXISTS "ArchitectOpening_analysisId_idx" ON "ArchitectOpening"("analysisId");
CREATE INDEX IF NOT EXISTS "ArchitectOpening_userConfirmed_idx" ON "ArchitectOpening"("userConfirmed");
CREATE INDEX IF NOT EXISTS "ArchitectOpening_quoteLineId_idx" ON "ArchitectOpening"("quoteLineId");
CREATE UNIQUE INDEX IF NOT EXISTS "ArchitectOpening_quoteLineId_key" ON "ArchitectOpening"("quoteLineId");

-- AddForeignKey: ArchitectPack to Tenant
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ArchitectPack_tenantId_fkey'
    ) THEN
        ALTER TABLE "ArchitectPack" ADD CONSTRAINT "ArchitectPack_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: ArchitectPackAnalysis to ArchitectPack
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ArchitectPackAnalysis_packId_fkey'
    ) THEN
        ALTER TABLE "ArchitectPackAnalysis" ADD CONSTRAINT "ArchitectPackAnalysis_packId_fkey" 
        FOREIGN KEY ("packId") REFERENCES "ArchitectPack"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: ArchitectOpening to ArchitectPackAnalysis
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ArchitectOpening_analysisId_fkey'
    ) THEN
        ALTER TABLE "ArchitectOpening" ADD CONSTRAINT "ArchitectOpening_analysisId_fkey" 
        FOREIGN KEY ("analysisId") REFERENCES "ArchitectPackAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey: ArchitectOpening to QuoteLine
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'ArchitectOpening_quoteLineId_fkey'
    ) THEN
        ALTER TABLE "ArchitectOpening" ADD CONSTRAINT "ArchitectOpening_quoteLineId_fkey" 
        FOREIGN KEY ("quoteLineId") REFERENCES "QuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
