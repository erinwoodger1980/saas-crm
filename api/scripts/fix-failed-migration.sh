#!/bin/bash

# Fix failed migration by marking it as rolled back
# This allows Prisma to re-apply it

echo "Fixing failed migration: 20251124095123_add_fire_door_schedule"
echo ""

# Mark the migration as rolled back in the production database
npx prisma db execute --stdin <<EOF
UPDATE "_prisma_migrations" 
SET rolled_back_at = NOW(), 
    finished_at = NULL 
WHERE migration_name = '20251124095123_add_fire_door_schedule';
EOF

echo ""
echo "Migration marked as rolled back. Now run: npx prisma migrate deploy"
