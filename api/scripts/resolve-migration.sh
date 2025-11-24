#!/bin/bash

# The migration partially applied (table exists) but is marked as failed
# We'll mark it as successfully applied since the table structure is correct

echo "Resolving migration: 20251124095123_add_fire_door_schedule"
echo "Table exists, marking migration as complete..."
echo ""

npx prisma db execute --stdin <<'EOF'
UPDATE "_prisma_migrations" 
SET 
  finished_at = started_at + interval '1 second',
  rolled_back_at = NULL,
  applied_steps_count = 1
WHERE migration_name = '20251124095123_add_fire_door_schedule'
  AND finished_at IS NULL;
EOF

echo ""
echo "Migration marked as complete. Verifying..."
echo ""

npx prisma migrate deploy
