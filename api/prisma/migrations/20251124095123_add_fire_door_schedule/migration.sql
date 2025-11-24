-- CreateTable
CREATE TABLE "FireDoorScheduleProject" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT,
    "mjsNumber" TEXT,
    "jobName" TEXT,
    "clientName" TEXT,
    "dateReceived" TIMESTAMP(3),
    "dateRequired" TIMESTAMP(3),
    "poNumber" TEXT,
    "laqNumber" TEXT,
    "compOrderNumber" TEXT,
    "jobLocation" TEXT,
    "signOffStatus" TEXT,
    "signOffDate" TIMESTAMP(3),
    "scheduledBy" TEXT,
    "leadTimeWeeks" INTEGER,
    "approxDeliveryDate" TIMESTAMP(3),
    "workingDaysRemaining" INTEGER,
    "orderingStatus" TEXT,
    "blanksStatus" TEXT,
    "blanksChecked" BOOLEAN NOT NULL DEFAULT false,
    "lippingsStatus" TEXT,
    "lippingsChecked" BOOLEAN NOT NULL DEFAULT false,
    "facingsStatus" TEXT,
    "facingsChecked" BOOLEAN NOT NULL DEFAULT false,
    "glassStatus" TEXT,
    "glassChecked" BOOLEAN NOT NULL DEFAULT false,
    "cassettesStatus" TEXT,
    "cassettesChecked" BOOLEAN NOT NULL DEFAULT false,
    "timbersStatus" TEXT,
    "timbersChecked" BOOLEAN NOT NULL DEFAULT false,
    "ironmongeryStatus" TEXT,
    "ironmongeryChecked" BOOLEAN NOT NULL DEFAULT false,
    "blanksCutPercent" INTEGER,
    "edgebandPercent" INTEGER,
    "calibratePercent" INTEGER,
    "facingsPercent" INTEGER,
    "finalCncPercent" INTEGER,
    "finishPercent" INTEGER,
    "sandPercent" INTEGER,
    "sprayPercent" INTEGER,
    "cutPercent" INTEGER,
    "cncPercent" INTEGER,
    "buildPercent" INTEGER,
    "overallProgress" INTEGER,
    "hiddenStatus" TEXT,
    "paperworkStatus" TEXT,
    "doorPaperworkStatus" TEXT,
    "finalCncSheetStatus" TEXT,
    "finalChecksSheetStatus" TEXT,
    "deliveryChecklistStatus" TEXT,
    "framesPaperworkStatus" TEXT,
    "paperworkComments" TEXT,
    "certificationRequired" TEXT,
    "fscRequired" BOOLEAN NOT NULL DEFAULT false,
    "invoiceStatus" TEXT,
    "transportStatus" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "installStart" TIMESTAMP(3),
    "installEnd" TIMESTAMP(3),
    "snaggingStatus" TEXT,
    "snaggingComplete" BOOLEAN NOT NULL DEFAULT false,
    "snaggingNotes" TEXT,
    "communicationNotes" TEXT,
    "internalNotes" TEXT,
    "lastUpdatedBy" TEXT,
    "lastUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FireDoorScheduleProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FireDoorScheduleProject_tenantId_idx" ON "FireDoorScheduleProject"("tenantId");

-- CreateIndex
CREATE INDEX "FireDoorScheduleProject_tenantId_jobLocation_idx" ON "FireDoorScheduleProject"("tenantId", "jobLocation");

-- CreateIndex
CREATE INDEX "FireDoorScheduleProject_tenantId_signOffStatus_idx" ON "FireDoorScheduleProject"("tenantId", "signOffStatus");

-- CreateIndex
CREATE INDEX "FireDoorScheduleProject_tenantId_dateRequired_idx" ON "FireDoorScheduleProject"("tenantId", "dateRequired");

-- CreateIndex
CREATE INDEX "FireDoorScheduleProject_projectId_idx" ON "FireDoorScheduleProject"("projectId");

-- AddForeignKey
ALTER TABLE "FireDoorScheduleProject" ADD CONSTRAINT "FireDoorScheduleProject_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
