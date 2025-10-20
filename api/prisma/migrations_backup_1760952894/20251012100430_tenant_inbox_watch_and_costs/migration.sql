-- AlterTable
ALTER TABLE "TenantSettings" ADD COLUMN     "inbox" JSONB,
ADD COLUMN     "inboxLastRun" TIMESTAMP(3),
ADD COLUMN     "inboxWatchEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "FollowUpLog" ADD CONSTRAINT "FollowUpLog_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
