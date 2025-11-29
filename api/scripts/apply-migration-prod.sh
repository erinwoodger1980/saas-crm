#!/bin/bash
# api/scripts/apply-migration-prod.sh
# Apply a specific migration to production
# Usage: ./scripts/apply-migration-prod.sh 20251129120000_add_analytics_events

set -e

MIGRATION_NAME="$1"
if [ -z "$MIGRATION_NAME" ]; then
  echo "Usage: $0 <migration_folder_name>"
  echo "Example: $0 20251129120000_add_analytics_events"
  exit 1
fi

MIGRATION_FILE="prisma/migrations/${MIGRATION_NAME}/migration.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
  echo "❌ ERROR: Migration file not found: $MIGRATION_FILE"
  exit 1
fi

# Verify DATABASE_URL is set and NOT local
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not set"
  exit 1
fi

if [[ "$DATABASE_URL" =~ localhost|127\.0\.0\.1 ]]; then
  echo "❌ ERROR: DATABASE_URL appears to be local. Use production URL."
  echo "Current: $DATABASE_URL"
  exit 1
fi

echo "🔍 Target database: ${DATABASE_URL:0:50}..."
echo "📄 Migration: $MIGRATION_FILE"
echo ""
read -p "⚠️  Apply this migration to PRODUCTION? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
  echo "❌ Aborted"
  exit 0
fi

echo ""
echo "🚀 Applying migration..."
psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "📝 Marking migration as applied in Prisma..."
npx prisma migrate resolve --applied "$MIGRATION_NAME"

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "📋 Next steps:"
echo "   1. Verify table exists: psql \"\$DATABASE_URL\" -c \"\\d \\\"TableName\\\"\""
echo "   2. Restart application: pm2 restart api (or equivalent)"
echo "   3. Test endpoints"
echo ""
