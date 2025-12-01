-- AlterTable: Make projectId optional in WorkshopTimer
ALTER TABLE "WorkshopTimer" ALTER COLUMN "projectId" DROP NOT NULL;
