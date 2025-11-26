-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "taskType" "TaskType" NOT NULL,
    "defaultTitle" TEXT NOT NULL,
    "defaultDescription" TEXT,
    "defaultPriority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "relatedType" "RelatedType",
    "recurrencePattern" "RecurrencePattern",
    "recurrenceInterval" INTEGER DEFAULT 1,
    "formSchema" JSONB,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "checklistItems" JSONB,
    "defaultAssigneeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FormTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "formSchema" JSONB NOT NULL,
    "requiresSignature" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskTemplate_tenantId_isActive_idx" ON "TaskTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskTemplate_tenantId_taskType_idx" ON "TaskTemplate"("tenantId", "taskType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FormTemplate_tenantId_isActive_idx" ON "FormTemplate"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FormTemplate_tenantId_category_idx" ON "FormTemplate"("tenantId", "category");

-- AddForeignKey
ALTER TABLE "TaskTemplate" ADD CONSTRAINT "TaskTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
