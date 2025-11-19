-- CreateTable: SoftwareProfile for managing parsing profiles via UI
CREATE TABLE IF NOT EXISTS "SoftwareProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "matchHints" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SoftwareProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SoftwareProfile_tenantId_idx" ON "SoftwareProfile"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "SoftwareProfile_tenantId_name_key" ON "SoftwareProfile"("tenantId", "name");
