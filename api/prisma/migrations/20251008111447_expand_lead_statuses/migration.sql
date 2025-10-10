-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LeadStatus" ADD VALUE 'INFO_REQUESTED';
ALTER TYPE "LeadStatus" ADD VALUE 'REJECTED';
ALTER TYPE "LeadStatus" ADD VALUE 'READY_TO_QUOTE';
ALTER TYPE "LeadStatus" ADD VALUE 'QUOTE_SENT';
ALTER TYPE "LeadStatus" ADD VALUE 'WON';
ALTER TYPE "LeadStatus" ADD VALUE 'LOST';
