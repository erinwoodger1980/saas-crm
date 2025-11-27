-- Add email personalization fields to User table
-- Run this on production database before deploying

ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "firstName" TEXT,
ADD COLUMN IF NOT EXISTS "lastName" TEXT,
ADD COLUMN IF NOT EXISTS "emailFooter" TEXT;
