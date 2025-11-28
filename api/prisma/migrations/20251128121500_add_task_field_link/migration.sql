-- CreateTable
CREATE TABLE "TaskFieldLink" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "fieldPath" TEXT NOT NULL,
  "label" TEXT,
  "completionCondition" JSONB,
  "onTaskComplete" JSONB,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- AddForeignKey
ALTER TABLE "TaskFieldLink"
  ADD CONSTRAINT "TaskFieldLink_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX "TaskFieldLink_tenant_model_fieldPath_idx"
  ON "TaskFieldLink" ("tenantId", "model", "fieldPath");
