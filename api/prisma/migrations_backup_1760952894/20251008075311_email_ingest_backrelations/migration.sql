-- AlterTable
ALTER TABLE "EmailIngest" ADD COLUMN     "aiPredictedIsLead" BOOLEAN,
ADD COLUMN     "userLabelIsLead" BOOLEAN,
ADD COLUMN     "userLabeledAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "EmailIngest_tenantId_idx" ON "EmailIngest"("tenantId");

-- AddForeignKey
ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailIngest" ADD CONSTRAINT "EmailIngest_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;
