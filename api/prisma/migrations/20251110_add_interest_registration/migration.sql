-- Add InterestRegistration table for pre-launch waitlist
CREATE TABLE "InterestRegistration" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterestRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InterestRegistration_email_key" ON "InterestRegistration"("email");

-- CreateIndex
CREATE INDEX "InterestRegistration_createdAt_idx" ON "InterestRegistration"("createdAt");
