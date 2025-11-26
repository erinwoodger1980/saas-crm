#!/bin/bash
set -e

echo "🔍 Checking for failed migrations..."

# Try to resolve the failed migration
npx prisma migrate resolve --rolled-back "20251126122031_add_task_template" 2>/dev/null || true

echo "✅ Migration state checked, proceeding with deploy..."
npx prisma migrate deploy
