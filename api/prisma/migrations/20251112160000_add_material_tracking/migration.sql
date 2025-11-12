-- Add material tracking fields to Opportunity
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "timberOrderedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "timberExpectedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "timberReceivedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "glassOrderedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "glassExpectedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "glassReceivedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "ironmongeryOrderedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "ironmongeryExpectedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "ironmongeryReceivedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "paintOrderedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "paintExpectedAt" TIMESTAMP(3);
ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "paintReceivedAt" TIMESTAMP(3);

-- Add comments for documentation
COMMENT ON COLUMN "Opportunity"."timberOrderedAt" IS 'Date timber was ordered';
COMMENT ON COLUMN "Opportunity"."timberExpectedAt" IS 'Expected delivery date for timber';
COMMENT ON COLUMN "Opportunity"."timberReceivedAt" IS 'Date timber was received';
COMMENT ON COLUMN "Opportunity"."glassOrderedAt" IS 'Date glass was ordered';
COMMENT ON COLUMN "Opportunity"."glassExpectedAt" IS 'Expected delivery date for glass';
COMMENT ON COLUMN "Opportunity"."glassReceivedAt" IS 'Date glass was received';
COMMENT ON COLUMN "Opportunity"."ironmongeryOrderedAt" IS 'Date ironmongery was ordered';
COMMENT ON COLUMN "Opportunity"."ironmongeryExpectedAt" IS 'Expected delivery date for ironmongery';
COMMENT ON COLUMN "Opportunity"."ironmongeryReceivedAt" IS 'Date ironmongery was received';
COMMENT ON COLUMN "Opportunity"."paintOrderedAt" IS 'Date paint was ordered';
COMMENT ON COLUMN "Opportunity"."paintExpectedAt" IS 'Expected delivery date for paint';
COMMENT ON COLUMN "Opportunity"."paintReceivedAt" IS 'Date paint was received';
