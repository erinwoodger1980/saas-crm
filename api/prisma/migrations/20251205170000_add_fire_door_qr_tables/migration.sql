-- Add QR code system for fire door workshop and maintenance tracking

-- Process QR configuration: defines what info to show for each process
CREATE TABLE IF NOT EXISTS "FireDoorProcessQRConfig" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "processName" TEXT NOT NULL,
  "displayFields" JSONB NOT NULL DEFAULT '[]',
  "instructions" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FireDoorProcessQRConfig_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "FireDoorProcessQRConfig_tenantId_processName_key" ON "FireDoorProcessQRConfig"("tenantId", "processName");

-- QR Code scans log: tracks when QR codes are scanned
CREATE TABLE IF NOT EXISTS "FireDoorQRScan" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "lineItemId" TEXT,
  "clientJobId" TEXT,
  "doorItemId" TEXT,
  "scanType" TEXT NOT NULL,
  "processName" TEXT,
  "scannedBy" TEXT,
  "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deviceInfo" TEXT,
  "notes" TEXT,
  CONSTRAINT "FireDoorQRScan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FireDoorQRScan_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "FireDoorLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FireDoorQRScan_clientJobId_fkey" FOREIGN KEY ("clientJobId") REFERENCES "FireDoorClientJob"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FireDoorQRScan_doorItemId_fkey" FOREIGN KEY ("doorItemId") REFERENCES "FireDoorClientDoorItem"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "FireDoorQRScan_scannedBy_fkey" FOREIGN KEY ("scannedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FireDoorQRScan_lineItemId_idx" ON "FireDoorQRScan"("lineItemId");
CREATE INDEX IF NOT EXISTS "FireDoorQRScan_clientJobId_idx" ON "FireDoorQRScan"("clientJobId");
CREATE INDEX IF NOT EXISTS "FireDoorQRScan_doorItemId_idx" ON "FireDoorQRScan"("doorItemId");
CREATE INDEX IF NOT EXISTS "FireDoorQRScan_scanType_idx" ON "FireDoorQRScan"("scanType");
CREATE INDEX IF NOT EXISTS "FireDoorQRScan_tenantId_idx" ON "FireDoorQRScan"("tenantId");

-- Add maintenance tracking fields to FireDoorClientDoorItem
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "installationDate" TIMESTAMP(3);
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "lastMaintenanceDate" TIMESTAMP(3);
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "nextMaintenanceDate" TIMESTAMP(3);
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "maintenanceNotes" TEXT;
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "fittingInstructions" TEXT;
ALTER TABLE "FireDoorClientDoorItem" ADD COLUMN IF NOT EXISTS "installerNotes" TEXT;

-- Maintenance history table
CREATE TABLE IF NOT EXISTS "FireDoorMaintenanceRecord" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "doorItemId" TEXT NOT NULL,
  "performedBy" TEXT,
  "performedByName" TEXT,
  "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "maintenanceType" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "findings" TEXT,
  "actionsTaken" TEXT,
  "photos" JSONB DEFAULT '[]',
  "nextDueDate" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FireDoorMaintenanceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FireDoorMaintenanceRecord_doorItemId_fkey" FOREIGN KEY ("doorItemId") REFERENCES "FireDoorClientDoorItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FireDoorMaintenanceRecord_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "FireDoorMaintenanceRecord_doorItemId_idx" ON "FireDoorMaintenanceRecord"("doorItemId");
CREATE INDEX IF NOT EXISTS "FireDoorMaintenanceRecord_performedAt_idx" ON "FireDoorMaintenanceRecord"("performedAt");
CREATE INDEX IF NOT EXISTS "FireDoorMaintenanceRecord_tenantId_idx" ON "FireDoorMaintenanceRecord"("tenantId");
