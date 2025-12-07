-- Fix questionnaire field scopes
-- Move manufacturing and fire door fields from 'public' scope to their correct scopes

-- Manufacturing fields (should be scope: 'manufacturing')
UPDATE "QuestionnaireField"
SET scope = 'manufacturing'
WHERE key IN (
  'manufacturing_start_date',
  'manufacturing_end_date',
  'production_notes',
  'installation_date',
  'installation_start_date',
  'installation_end_date',
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
  'paint_received_at',
  'final_width_mm',
  'final_height_mm'
)
AND scope = 'item';

-- Fire door schedule fields (project-level)
UPDATE "QuestionnaireField"
SET scope = 'fire_door_schedule'
WHERE key IN (
  'fire_rated',
  'mjs_number',
  'job_location',
  'sign_off_status',
  'date_received',
  'date_required',
  'po_number'
)
AND scope = 'item';

-- Fire door line item fields (door-level specifications)
UPDATE "QuestionnaireField"
SET scope = 'fire_door_line_items'
WHERE key IN (
  'door_ref',
  'fire_rating',
  'door_set_type',
  'leaf_height_mm',
  'leaf_width_mm',
  'leaf_thickness_mm',
  'glazed_area',
  'acoustic_rating_db'
)
AND scope = 'item';

-- Move spec fields to quote_details scope
UPDATE "QuestionnaireField"
SET scope = 'quote_details'
WHERE key IN (
  'materials_grade',
  'glazing_type',
  'has_curves',
  'premium_hardware',
  'custom_finish',
  'fire_rated',
  'window_style',
  'door_type',
  'door_height_mm',
  'door_width_mm',
  'number_of_doors',
  'timber_type',
  'finish',
  'ironmongery_level',
  'quantity',
  'width_mm',
  'height_mm'
)
AND scope = 'item';

-- Verify the changes
SELECT scope, COUNT(*) as field_count
FROM "QuestionnaireField"
GROUP BY scope
ORDER BY scope;
