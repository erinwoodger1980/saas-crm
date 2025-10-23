-- Drop NOT NULL constraint from passwordHash to allow pending users
ALTER TABLE "User"
  ALTER COLUMN "passwordHash" DROP NOT NULL;

-- Add signupCompleted flag with default false
ALTER TABLE "User"
  ADD COLUMN     "signupCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing users as completed when they already have a password
UPDATE "User"
SET "signupCompleted" = true
WHERE "passwordHash" IS NOT NULL;

-- Create SignupToken table for onboarding tokens
CREATE TABLE "SignupToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SignupToken_pkey" PRIMARY KEY ("id")
);

-- Ensure unique token value
CREATE UNIQUE INDEX "SignupToken_token_key" ON "SignupToken"("token");

-- Foreign key with cascade delete
ALTER TABLE "SignupToken"
  ADD CONSTRAINT "SignupToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
