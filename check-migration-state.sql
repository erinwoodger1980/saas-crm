-- Check current state of Lead table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Lead'
  AND column_name IN ('number', 'description')
ORDER BY column_name;

-- Check current state of Opportunity table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'Opportunity'
  AND column_name IN ('number', 'description')
ORDER BY column_name;

-- Check migration status
SELECT migration_name, started_at, finished_at, applied_steps_count
FROM "_prisma_migrations"
WHERE migration_name = '20251202083545_add_number_description';
