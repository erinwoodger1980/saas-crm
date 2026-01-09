-- AlterTable
ALTER TABLE "Client" ADD COLUMN "linkedTenantId" TEXT;

-- CreateIndex
CREATE INDEX "Client_linkedTenantId_idx" ON "Client"("linkedTenantId");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_linkedTenantId_fkey" FOREIGN KEY ("linkedTenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
