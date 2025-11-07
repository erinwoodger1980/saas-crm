-- Add channel + scheduling metadata to FollowUpLog for multi-channel experimentation
-- NOTE: These columns are now created in migration 20250120000000_create_followup_log
-- This migration is kept for historical reference but has been neutralized

-- Original migration moved to creation script to fix shadow DB build
-- ALTER TABLE "FollowUpLog"
--   ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'email',
--   ADD COLUMN "scheduledFor" TIMESTAMP(3),
--   ADD COLUMN "metadata" JSONB;

-- Index already created in base migration
-- CREATE INDEX IF NOT EXISTS "FollowUpLog_tenantId_channel_sentAt_idx"
--   ON "FollowUpLog"("tenantId", "channel", "sentAt");
