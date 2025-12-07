-- Delete unwanted fields that are no longer in standard field definitions
-- These were moved/updated during scope reorganization but should be removed entirely

DELETE FROM "QuestionnaireField"
WHERE key IN (
  -- Old material tracking fields (replaced by material import system)
  'timber_ordered_at',
  'timber_expected_at', 
  'timber_received_at',
  'glass_ordered_at',
  'glass_expected_at',
  'glass_received_at',
  'ironmongery_ordered_at',
  'ironmongery_expected_at',
  'ironmongery_received_at',
  'paint_ordered_at',
  'paint_expected_at',
  'paint_received_at'
);

-- Verify remaining fields by scope
SELECT scope, COUNT(*) as field_count
FROM "QuestionnaireField"
WHERE "isStandard" = true
GROUP BY scope
ORDER BY scope;
