-- CreateTable
CREATE TABLE "GridFieldConfig" (
    "id" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "inputType" TEXT NOT NULL DEFAULT 'text',
    "lookupTable" TEXT,
    "formula" TEXT,
    "componentLink" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GridFieldConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GridFieldConfig_fieldName_key" ON "GridFieldConfig"("fieldName");

-- CreateIndex
CREATE INDEX "GridFieldConfig_fieldName_idx" ON "GridFieldConfig"("fieldName");
