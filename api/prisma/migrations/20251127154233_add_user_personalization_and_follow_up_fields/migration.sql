-- AlterEnum
ALTER TYPE "OppStage" ADD VALUE 'COMPLETED';

-- AlterEnum
BEGIN;
CREATE TYPE "TaskType_new" AS ENUM ('MANUAL', 'COMMUNICATION', 'FOLLOW_UP', 'SCHEDULED', 'FORM', 'CHECKLIST');
ALTER TABLE "public"."Task" ALTER COLUMN "taskType" DROP DEFAULT;
ALTER TABLE "Task" ALTER COLUMN "taskType" TYPE "TaskType_new" USING ("taskType"::text::"TaskType_new");
ALTER TABLE "TaskTemplate" ALTER COLUMN "taskType" TYPE "TaskType_new" USING ("taskType"::text::"TaskType_new");
ALTER TYPE "TaskType" RENAME TO "TaskType_old";
ALTER TYPE "TaskType_new" RENAME TO "TaskType";
DROP TYPE "public"."TaskType_old";
ALTER TABLE "Task" ALTER COLUMN "taskType" SET DEFAULT 'MANUAL';
COMMIT;

-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "taskType" SET NOT NULL,
ALTER COLUMN "autoCompleted" SET NOT NULL,
ALTER COLUMN "requiresSignature" SET NOT NULL;

-- AlterTable
ALTER TABLE "TaskTemplate" ALTER COLUMN "defaultAssigneeIds" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailFooter" TEXT,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ALTER COLUMN "workshopProcessCodes" DROP DEFAULT;

-- CreateTable
CREATE TABLE "FollowUpRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "delayDays" INTEGER NOT NULL,
    "condition" TEXT,
    "taskTitle" TEXT NOT NULL,
    "emailSubject" TEXT NOT NULL,
    "contextTemplate" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "autoSchedule" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FollowUpRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FollowUpHistory" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "aiDraftSubject" TEXT,
    "aiDraftBody" TEXT,
    "finalSubject" TEXT,
    "finalBody" TEXT,
    "sentAt" TIMESTAMP(3),
    "messageId" TEXT,
    "threadId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "responded" BOOLEAN NOT NULL DEFAULT false,
    "respondedAt" TIMESTAMP(3),
    "responseTime" INTEGER,
    "converted" BOOLEAN NOT NULL DEFAULT false,
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "editDistance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FollowUpHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailConversation" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "threadId" TEXT,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "htmlBody" TEXT,
    "direction" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "inReplyTo" TEXT,
    "references" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailConversation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FollowUpRule_tenantId_trigger_isActive_idx" ON "FollowUpRule"("tenantId", "trigger", "isActive");

-- CreateIndex
CREATE INDEX "FollowUpHistory_tenantId_userId_idx" ON "FollowUpHistory"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "FollowUpHistory_taskId_idx" ON "FollowUpHistory"("taskId");

-- CreateIndex
CREATE INDEX "FollowUpHistory_recipientEmail_idx" ON "FollowUpHistory"("recipientEmail");

-- CreateIndex
CREATE INDEX "FollowUpHistory_responded_converted_idx" ON "FollowUpHistory"("responded", "converted");

-- CreateIndex
CREATE UNIQUE INDEX "EmailConversation_messageId_key" ON "EmailConversation"("messageId");

-- CreateIndex
CREATE INDEX "EmailConversation_taskId_idx" ON "EmailConversation"("taskId");

-- CreateIndex
CREATE INDEX "EmailConversation_tenantId_threadId_idx" ON "EmailConversation"("tenantId", "threadId");

-- CreateIndex
CREATE INDEX "EmailConversation_messageId_idx" ON "EmailConversation"("messageId");

-- AddForeignKey
ALTER TABLE "FollowUpRule" ADD CONSTRAINT "FollowUpRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FollowUpHistory" ADD CONSTRAINT "FollowUpHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConversation" ADD CONSTRAINT "EmailConversation_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailConversation" ADD CONSTRAINT "EmailConversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

