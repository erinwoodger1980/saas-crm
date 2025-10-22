-- Ensure the feedback status enum exists. Deploy environments may not have run
-- the earlier feedback table setup, so we defensively create any missing pieces
-- instead of assuming they are present.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FeedbackStatus') THEN
    CREATE TYPE "FeedbackStatus" AS ENUM ('OPEN', 'RESOLVED');
  END IF;
END
$$;

-- Add the early adopter flag without failing if the column is already present.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "isEarlyAdopter" BOOLEAN NOT NULL DEFAULT false;

-- Create the feedback table when it is missing. Render's production database was
-- missing this relation entirely which caused the original ALTER TABLE to fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND LOWER(tablename) = 'feedback'
  ) THEN
    CREATE TABLE "Feedback" (
      "id" TEXT NOT NULL,
      "tenantId" TEXT NOT NULL,
      "userId" TEXT,
      "feature" TEXT NOT NULL,
      "rating" INTEGER,
      "comment" TEXT,
      "sourceUrl" TEXT,
      "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
      "resolvedAt" TIMESTAMP(3),
      "resolvedById" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"),
      CONSTRAINT "Feedback_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
      CONSTRAINT "Feedback_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND LOWER(table_name) = 'feedback'
  ) THEN
    -- Ensure legacy installs pick up the new metadata columns.
    EXECUTE $$ALTER TABLE "Feedback"
      ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT,
      ADD COLUMN IF NOT EXISTS "status" "FeedbackStatus" NOT NULL DEFAULT 'OPEN',
      ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "resolvedById" TEXT$$;

    -- Backfill nullable values so constraint tightening succeeds.
    EXECUTE $$UPDATE "Feedback"
      SET "status" = 'OPEN'
      WHERE "status" IS NULL$$;

    EXECUTE $$UPDATE "Feedback"
      SET "feature" = 'unknown'
      WHERE "feature" IS NULL OR btrim("feature") = ''$$;

    -- Align column defaults and nullability with the Prisma schema.
    EXECUTE $$ALTER TABLE "Feedback"
      ALTER COLUMN "status" SET DEFAULT 'OPEN'$$;

    EXECUTE $$ALTER TABLE "Feedback"
      ALTER COLUMN "status" SET NOT NULL$$;

    EXECUTE $$ALTER TABLE "Feedback"
      ALTER COLUMN "feature" SET NOT NULL$$;

    -- Recreate indexes to support dashboard queries.
    EXECUTE $$CREATE INDEX IF NOT EXISTS "Feedback_tenantId_feature_createdAt_idx"
      ON "Feedback"("tenantId", "feature", "createdAt")$$;

    EXECUTE $$CREATE INDEX IF NOT EXISTS "Feedback_tenantId_status_createdAt_idx"
      ON "Feedback"("tenantId", "status", "createdAt")$$;

    -- Add missing foreign keys now that the columns exist.
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Feedback_resolvedById_fkey'
    ) THEN
      EXECUTE $$ALTER TABLE "Feedback"
        ADD CONSTRAINT "Feedback_resolvedById_fkey"
        FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE$$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Feedback_userId_fkey'
    ) THEN
      EXECUTE $$ALTER TABLE "Feedback"
        ADD CONSTRAINT "Feedback_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE$$;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'Feedback_tenantId_fkey'
    ) THEN
      EXECUTE $$ALTER TABLE "Feedback"
        ADD CONSTRAINT "Feedback_tenantId_fkey"
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE$$;
    END IF;
  END IF;
END
$$;
