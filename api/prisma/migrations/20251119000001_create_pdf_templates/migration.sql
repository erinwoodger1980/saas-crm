-- Create PdfLayoutTemplate table (app-wide, not tenant-scoped)

CREATE TABLE IF NOT EXISTS "PdfLayoutTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "supplierProfileId" TEXT,
    "fileHash" TEXT,
    "pageCount" INTEGER,
    "annotations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PdfLayoutTemplate_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "PdfLayoutTemplate_supplierProfileId_idx" ON "PdfLayoutTemplate"("supplierProfileId");
CREATE INDEX IF NOT EXISTS "PdfLayoutTemplate_name_idx" ON "PdfLayoutTemplate"("name");
