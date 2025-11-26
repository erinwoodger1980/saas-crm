-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "workshopProcessCodes" TEXT[] DEFAULT ARRAY[]::TEXT[];
