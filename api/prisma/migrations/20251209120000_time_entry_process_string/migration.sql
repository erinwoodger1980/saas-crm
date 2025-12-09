-- AlterTable: Change TimeEntry.process from enum to String to support generic processes
ALTER TABLE "TimeEntry" ALTER COLUMN "process" TYPE TEXT;
