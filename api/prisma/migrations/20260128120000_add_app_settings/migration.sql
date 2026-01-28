-- Create global app settings table for system-wide UI preferences
CREATE TABLE "AppSettings" (
  "id" TEXT NOT NULL DEFAULT 'global',
  "fireDoorOrderGridColumnWidths" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- Ensure a single global row exists
INSERT INTO "AppSettings" ("id")
VALUES ('global')
ON CONFLICT ("id") DO NOTHING;
