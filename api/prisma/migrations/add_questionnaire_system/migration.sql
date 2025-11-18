-- CreateTable
CREATE TABLE "QuestionnaireField" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "placeholder" TEXT,
    "helpText" TEXT,
    "config" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "costingInputKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionnaireAnswer" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "value" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionnaireField_tenantId_isActive_sortOrder_idx" ON "QuestionnaireField"("tenantId", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "QuestionnaireField_tenantId_costingInputKey_idx" ON "QuestionnaireField"("tenantId", "costingInputKey");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireField_tenantId_key_key" ON "QuestionnaireField"("tenantId", "key");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_tenantId_idx" ON "QuestionnaireResponse"("tenantId");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_quoteId_idx" ON "QuestionnaireResponse"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireResponse_quoteId_key" ON "QuestionnaireResponse"("quoteId");

-- CreateIndex
CREATE INDEX "QuestionnaireAnswer_responseId_idx" ON "QuestionnaireAnswer"("responseId");

-- CreateIndex
CREATE INDEX "QuestionnaireAnswer_fieldId_idx" ON "QuestionnaireAnswer"("fieldId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionnaireAnswer_responseId_fieldId_key" ON "QuestionnaireAnswer"("responseId", "fieldId");

-- AddForeignKey
ALTER TABLE "QuestionnaireField" ADD CONSTRAINT "QuestionnaireField_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireAnswer" ADD CONSTRAINT "QuestionnaireAnswer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "QuestionnaireResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionnaireAnswer" ADD CONSTRAINT "QuestionnaireAnswer_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "QuestionnaireField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
