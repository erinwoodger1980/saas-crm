-- Add billing-related columns to "Tenant" if missing
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "plan" TEXT;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "discountCodeUsed" TEXT;

-- Seats defaults (align with prisma schema defaults)
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seatsOffice" INTEGER DEFAULT 5;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seatsWorkshop" INTEGER DEFAULT 10;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "seatsDisplay" INTEGER DEFAULT 2;

-- Unique indexes (won't error if they already exist)
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");
