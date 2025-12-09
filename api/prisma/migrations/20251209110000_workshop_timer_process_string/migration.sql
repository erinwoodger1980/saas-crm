-- AlterTable: Change WorkshopTimer.process from enum to String to support generic processes
ALTER TABLE "WorkshopTimer" ALTER COLUMN "process" TYPE TEXT;
