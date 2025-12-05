-- AlterTable
ALTER TABLE "Feedback" ADD COLUMN "devResponse" TEXT,
ADD COLUMN "devScreenshotUrl" TEXT,
ADD COLUMN "emailNotificationSent" BOOLEAN NOT NULL DEFAULT false;
