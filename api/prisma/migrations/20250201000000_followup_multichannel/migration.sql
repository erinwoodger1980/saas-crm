-- Add channel + scheduling metadata to FollowUpLog for multi-channel experimentation
ALTER TABLE "FollowUpLog"
  ADD COLUMN "channel" TEXT NOT NULL DEFAULT 'email',
  ADD COLUMN "scheduledFor" TIMESTAMP(3),
  ADD COLUMN "metadata" JSONB;

CREATE INDEX IF NOT EXISTS "FollowUpLog_tenantId_channel_sentAt_idx"
  ON "FollowUpLog"("tenantId", "channel", "sentAt");
