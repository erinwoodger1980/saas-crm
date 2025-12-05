-- This script resolves the failed migration issue in production
-- Run this manually on the production database before deploying

-- 1. Mark the failed migration as rolled back
DELETE FROM "_prisma_migrations" 
WHERE migration_name = '20251205163731_add_performed_by_name';

-- 2. The new migration 20251205170000_add_fire_door_qr_tables will handle everything
-- It uses IF NOT EXISTS so it's safe to run even if some objects already exist
