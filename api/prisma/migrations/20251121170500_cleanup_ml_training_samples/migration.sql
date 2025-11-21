-- Cleanup legacy blank MLTrainingSample rows (stale email ingest artifacts)
-- Strategy: Reject or delete rows with no quotedAt, empty url, and still PENDING beyond 30 days.
-- Conservative: move to REJECTED first so ops can review; optionally hard-delete after grace period.

-- Mark stale blanks as REJECTED
UPDATE "MLTrainingSample"
SET "status" = 'REJECTED'
WHERE ("quotedAt" IS NULL)
  AND ("url" IS NULL OR "url" = '')
  AND "status" = 'PENDING'
  AND "createdAt" < NOW() - INTERVAL '30 days';

-- OPTIONAL HARD DELETE (commented out by default)
-- DELETE FROM "MLTrainingSample"
-- WHERE "status" = 'REJECTED'
--   AND ("quotedAt" IS NULL)
--   AND ("url" IS NULL OR "url" = '')
--   AND "createdAt" < NOW() - INTERVAL '90 days';

-- Report counts (non-fatal)
DO $$ BEGIN
  BEGIN
    RAISE NOTICE 'MLTrainingSample counts after cleanup:';
    EXECUTE 'SELECT "status", COUNT(*) FROM "MLTrainingSample" GROUP BY "status"';
  EXCEPTION WHEN others THEN
    -- ignore
  END;
END $$;