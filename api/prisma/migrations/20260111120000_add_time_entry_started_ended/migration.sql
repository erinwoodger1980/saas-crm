-- Add optional startedAt/endedAt timestamps to TimeEntry so timer logs can show start/end

ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "TimeEntry" ADD COLUMN IF NOT EXISTS "endedAt" TIMESTAMP(3);
